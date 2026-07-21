-- TallerMap: plan Destacado de 1,21 EUR/mes (IVA incluido) y rotación de 20 puestos.
-- Ejecuta este archivo completo en Supabase > SQL Editor antes de desplegar las Edge Functions.

begin;

alter table public.solicitudes_alta_taller
    add column if not exists plan_publicacion text not null default 'gratis';
alter table public.solicitudes_alta_taller
    add column if not exists acepta_condiciones_destacado boolean not null default false;
alter table public.solicitudes_alta_taller
    add column if not exists acepta_condiciones_destacado_at timestamptz;
alter table public.solicitudes_alta_taller
    add column if not exists version_condiciones_destacado text;
alter table public.solicitudes_alta_taller
    add column if not exists token_gestion uuid;

-- No se actualizan filas históricas: algunas pueden conservar nombres de
-- provincia anteriores (por ejemplo, "Valencia" en vez de "Valencia/València")
-- y cualquier UPDATE volvería a comprobar sus restricciones modernas.
-- El valor predeterminado se aplica únicamente a las altas creadas desde ahora.
alter table public.solicitudes_alta_taller
    alter column token_gestion set default gen_random_uuid();

create unique index if not exists solicitudes_token_gestion_unico
    on public.solicitudes_alta_taller (token_gestion);

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_plan_publicacion_valido;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_plan_publicacion_valido
    check (
        plan_publicacion in ('gratis', 'destacado')
        and (
            plan_publicacion = 'gratis'
            or (
                acepta_condiciones_destacado = true
                and acepta_condiciones_destacado_at is not null
                and nullif(btrim(version_condiciones_destacado), '') is not null
            )
        )
    ) not valid;

create table if not exists public.suscripciones_destacadas (
    id uuid primary key default gen_random_uuid(),
    solicitud_id bigint not null unique
        references public.solicitudes_alta_taller(id) on delete cascade,
    stripe_customer_id text,
    stripe_subscription_id text unique,
    estado text not null default 'incomplete',
    destacado_activo boolean not null default false,
    cancelar_fin_periodo boolean not null default false,
    periodo_actual_fin timestamptz,
    ultimo_evento_stripe text,
    ultimo_evento_creado bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.suscripciones_destacadas
    add column if not exists ultimo_evento_creado bigint not null default 0;

create index if not exists suscripciones_destacadas_activas_idx
    on public.suscripciones_destacadas (destacado_activo, solicitud_id);

alter table public.suscripciones_destacadas enable row level security;

drop policy if exists "administradores consultan suscripciones destacadas"
    on public.suscripciones_destacadas;
create policy "administradores consultan suscripciones destacadas"
on public.suscripciones_destacadas
for select
to authenticated
using (public.es_administrador());

-- Stripe puede entregar eventos fuera de orden. Esta función conserva siempre
-- el estado procedente del evento más reciente y hace que los reintentos sean idempotentes.
create or replace function public.registrar_estado_suscripcion_destacada(
    p_solicitud_id bigint,
    p_stripe_customer_id text,
    p_stripe_subscription_id text,
    p_estado text,
    p_destacado_activo boolean,
    p_cancelar_fin_periodo boolean,
    p_periodo_actual_fin timestamptz,
    p_evento text,
    p_evento_creado bigint
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
    insert into public.suscripciones_destacadas (
        solicitud_id, stripe_customer_id, stripe_subscription_id, estado,
        destacado_activo, cancelar_fin_periodo, periodo_actual_fin,
        ultimo_evento_stripe, ultimo_evento_creado, updated_at
    ) values (
        p_solicitud_id, p_stripe_customer_id, p_stripe_subscription_id, p_estado,
        p_destacado_activo, p_cancelar_fin_periodo, p_periodo_actual_fin,
        p_evento, p_evento_creado, now()
    )
    on conflict (solicitud_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        estado = excluded.estado,
        destacado_activo = excluded.destacado_activo,
        cancelar_fin_periodo = excluded.cancelar_fin_periodo,
        periodo_actual_fin = excluded.periodo_actual_fin,
        ultimo_evento_stripe = excluded.ultimo_evento_stripe,
        ultimo_evento_creado = excluded.ultimo_evento_creado,
        updated_at = now()
    where public.suscripciones_destacadas.ultimo_evento_creado <= excluded.ultimo_evento_creado;
$$;

revoke all on function public.registrar_estado_suscripcion_destacada(
    bigint, text, text, text, boolean, boolean, timestamptz, text, bigint
) from public, anon, authenticated;
grant execute on function public.registrar_estado_suscripcion_destacada(
    bigint, text, text, text, boolean, boolean, timestamptz, text, bigint
) to service_role;

-- Devuelve únicamente datos públicos. Los pagos activos ocupan como máximo
-- 20 puestos por búsqueda y su orden cambia cada día de forma determinista.
create or replace function public.buscar_talleres_publicos(
    p_poblacion text default '',
    p_servicio text default '',
    p_desde integer default 0,
    p_limite integer default 30
)
returns table (
    id uuid,
    nombre text,
    telefono text,
    web text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    descripcion text,
    verificado boolean,
    servicios text[],
    fotos text[],
    destacado boolean,
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with filtrados as (
        select
            t.*,
            exists (
                select 1
                from public.suscripciones_destacadas s
                where s.solicitud_id = t.solicitud_id
                  and s.destacado_activo = true
                  and s.estado in ('active', 'trialing')
            ) as pago_activo
        from public.talleres t
        where t.activo = true
          and (
              nullif(btrim(coalesce(p_poblacion, '')), '') is null
              or t.ciudad ilike '%' || btrim(p_poblacion) || '%'
          )
          and (
              nullif(btrim(coalesce(p_servicio, '')), '') is null
              or btrim(p_servicio) = any(coalesce(t.servicios, '{}'))
          )
    ), turnos as (
        select
            f.*,
            case when f.pago_activo then
                row_number() over (
                    partition by f.pago_activo
                    order by md5(f.id::text)
                )
            end as turno_pago,
            count(*) filter (where f.pago_activo) over () as total_pagos
        from filtrados f
    ), rotados as (
        select
            t.*,
            case
                when t.pago_activo and t.total_pagos > 0 then
                    mod(
                        mod(
                            (t.turno_pago - 1)
                            - mod((current_date - date '2026-01-01')::bigint * 20, t.total_pagos),
                            t.total_pagos
                        ) + t.total_pagos,
                        t.total_pagos
                    ) + 1
            end as posicion_rotada
        from turnos t
    ), visibles as (
        select
            r.*,
            (r.pago_activo and r.posicion_rotada <= 20) as es_destacado,
            count(*) over () as total_coincidencias
        from rotados r
    )
    select
        v.id,
        v.nombre,
        v.telefono,
        v.web,
        v.direccion,
        v.codigo_postal,
        v.ciudad,
        v.provincia,
        v.descripcion,
        v.verificado,
        coalesce(v.servicios, '{}'),
        coalesce(v.fotos, '{}'),
        v.es_destacado,
        v.total_coincidencias
    from visibles v
    order by
        v.es_destacado desc,
        case when v.es_destacado then v.posicion_rotada end,
        v.created_at desc,
        v.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

revoke all on function public.buscar_talleres_publicos(text, text, integer, integer)
    from public;
grant execute on function public.buscar_talleres_publicos(text, text, integer, integer)
    to anon, authenticated;

-- Conserva todas las validaciones públicas existentes y añade las del plan.
drop policy if exists "visitantes pueden enviar solicitudes"
    on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert
to anon, authenticated
with check (
    estado = case
        when left(codigo_postal, 2) in ('03', '12', '46') then 'aprobada'
        else 'pendiente'
    end
    and acepta_responsabilidad = true
    and acepta_terminos_at is not null
    and char_length(trim(nombre_taller)) between 2 and 120
    and char_length(trim(propietario)) between 2 and 120
    and char_length(trim(cif)) between 7 and 20
    and char_length(trim(email)) between 5 and 255
    and char_length(trim(telefono)) between 9 and 30
    and char_length(trim(direccion)) between 5 and 255
    and codigo_postal ~ '^[0-9]{5}$'
    and public.provincia_de_codigo_postal(codigo_postal) = provincia
    and char_length(trim(ciudad)) between 2 and 100
    and char_length(trim(provincia)) between 2 and 100
    and cardinality(fotos) <= 5
    and (
        cardinality(fotos) = 0
        or (
            acepta_condiciones_fotos = true
            and acepta_condiciones_fotos_at is not null
            and nullif(btrim(version_condiciones_fotos), '') is not null
        )
    )
    and plan_publicacion in ('gratis', 'destacado')
    and token_gestion is not null
    and (
        plan_publicacion = 'gratis'
        or (
            acepta_condiciones_destacado = true
            and acepta_condiciones_destacado_at is not null
            and version_condiciones_destacado = '1.0'
        )
    )
    and char_length(trim(descripcion)) between 10 and 1500
);

commit;

-- Comprobación opcional:
-- select * from public.buscar_talleres_publicos('', '', 0, 30);
