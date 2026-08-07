-- TallerMap · Fase 8: reclamación segura de fichas por propietarios
-- Ejecutar en Supabase SQL Editor antes de probar la interfaz de reclamaciones.
-- Incluye asociación de propietarios, moderación y registro de actividad.

begin;

create table if not exists public.taller_propietarios (
    taller_id uuid primary key references public.talleres(id) on delete cascade,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists taller_propietarios_usuario_idx
    on public.taller_propietarios (usuario_id);

create table if not exists public.reclamaciones_taller (
    id uuid primary key default gen_random_uuid(),
    taller_id uuid not null references public.talleres(id) on delete cascade,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    email text not null,
    nombre_solicitante text not null,
    telefono text,
    relacion text not null default 'propietario',
    mensaje text,
    estado text not null default 'pendiente',
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null,
    constraint reclamaciones_taller_estado_chk
        check (estado in ('pendiente','aprobada','rechazada')),
    constraint reclamaciones_taller_nombre_chk
        check (char_length(btrim(nombre_solicitante)) between 2 and 120),
    constraint reclamaciones_taller_telefono_chk
        check (telefono is null or char_length(btrim(telefono)) between 6 and 30),
    constraint reclamaciones_taller_relacion_chk
        check (relacion in ('propietario','responsable','empleado','otro')),
    constraint reclamaciones_taller_mensaje_chk
        check (mensaje is null or char_length(btrim(mensaje)) <= 1500)
);

create index if not exists reclamaciones_taller_estado_created_idx
    on public.reclamaciones_taller (estado, created_at desc);
create index if not exists reclamaciones_taller_usuario_idx
    on public.reclamaciones_taller (usuario_id, created_at desc);
create index if not exists reclamaciones_taller_taller_idx
    on public.reclamaciones_taller (taller_id, created_at desc);

create unique index if not exists reclamaciones_taller_pendiente_unica_idx
    on public.reclamaciones_taller (taller_id, usuario_id)
    where estado = 'pendiente';

alter table public.taller_propietarios enable row level security;
alter table public.reclamaciones_taller enable row level security;

drop policy if exists "propietarios ven sus asignaciones"
    on public.taller_propietarios;
create policy "propietarios ven sus asignaciones"
on public.taller_propietarios
for select
to authenticated
using (
    usuario_id = auth.uid()
    or public.es_administrador()
);

drop policy if exists "usuarios crean sus reclamaciones"
    on public.reclamaciones_taller;
create policy "usuarios crean sus reclamaciones"
on public.reclamaciones_taller
for insert
to authenticated
with check (
    usuario_id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and estado = 'pendiente'
    and reviewed_at is null
    and reviewed_by is null
);

drop policy if exists "usuarios ven sus reclamaciones"
    on public.reclamaciones_taller;
create policy "usuarios ven sus reclamaciones"
on public.reclamaciones_taller
for select
to authenticated
using (
    usuario_id = auth.uid()
    or public.es_administrador()
);

-- Registra la creación de una reclamación en el historial general si existe.
create or replace function public.registrar_reclamacion_taller()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if to_regclass('public.registro_actividad') is not null then
        insert into public.registro_actividad (
            taller_id,
            usuario_id,
            accion,
            origen,
            datos_anteriores,
            datos_nuevos,
            campos_modificados
        ) values (
            new.taller_id,
            new.usuario_id,
            'reclamar_taller',
            'propietario',
            null,
            jsonb_build_object(
                'reclamacion_id', new.id,
                'estado', new.estado,
                'relacion', new.relacion,
                'email', new.email
            ),
            array['estado','relacion','email']::text[]
        );
    end if;
    return new;
end;
$$;

drop trigger if exists trg_registrar_reclamacion_taller
    on public.reclamaciones_taller;
create trigger trg_registrar_reclamacion_taller
after insert on public.reclamaciones_taller
for each row execute function public.registrar_reclamacion_taller();

-- Las resoluciones administrativas se hacen exclusivamente mediante RPC.
-- No se concede UPDATE directo a usuarios autenticados.
create or replace function public.resolver_reclamacion_taller(
    p_reclamacion_id uuid,
    p_aprobar boolean
)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_reclamacion public.reclamaciones_taller%rowtype;
    v_propietario uuid;
    v_estado text;
begin
    if auth.uid() is null or not public.es_administrador() then
        raise exception 'administrador_requerido' using errcode = '42501';
    end if;

    select *
      into v_reclamacion
      from public.reclamaciones_taller
     where id = p_reclamacion_id
     for update;

    if not found then
        raise exception 'reclamacion_no_encontrada' using errcode = 'P0002';
    end if;

    if v_reclamacion.estado <> 'pendiente' then
        raise exception 'reclamacion_ya_resuelta' using errcode = '23514';
    end if;

    if p_aprobar then
        select usuario_id
          into v_propietario
          from public.taller_propietarios
         where taller_id = v_reclamacion.taller_id;

        if found and v_propietario <> v_reclamacion.usuario_id then
            raise exception 'taller_ya_tiene_propietario' using errcode = '23505';
        end if;

        insert into public.taller_propietarios (taller_id, usuario_id)
        values (v_reclamacion.taller_id, v_reclamacion.usuario_id)
        on conflict (taller_id) do update
            set usuario_id = excluded.usuario_id;

        update public.reclamaciones_taller
           set estado = 'aprobada',
               reviewed_at = now(),
               reviewed_by = auth.uid()
         where id = p_reclamacion_id;

        v_estado := 'aprobada';
    else
        update public.reclamaciones_taller
           set estado = 'rechazada',
               reviewed_at = now(),
               reviewed_by = auth.uid()
         where id = p_reclamacion_id;

        v_estado := 'rechazada';
    end if;

    if to_regclass('public.registro_actividad') is not null then
        insert into public.registro_actividad (
            taller_id,
            usuario_id,
            accion,
            origen,
            datos_anteriores,
            datos_nuevos,
            campos_modificados
        ) values (
            v_reclamacion.taller_id,
            auth.uid(),
            case when p_aprobar then 'aprobar_reclamacion' else 'rechazar_reclamacion' end,
            'administracion',
            jsonb_build_object(
                'reclamacion_id', v_reclamacion.id,
                'estado', v_reclamacion.estado,
                'usuario_id', v_reclamacion.usuario_id
            ),
            jsonb_build_object(
                'reclamacion_id', v_reclamacion.id,
                'estado', v_estado,
                'usuario_id', v_reclamacion.usuario_id
            ),
            array['estado']::text[]
        );
    end if;

    return v_estado;
end;
$$;

revoke all on table public.reclamaciones_taller from public, anon;
grant select, insert on table public.reclamaciones_taller to authenticated;

revoke all on table public.taller_propietarios from public, anon;
grant select on table public.taller_propietarios to authenticated;

revoke all on function public.resolver_reclamacion_taller(uuid, boolean)
    from public, anon;
grant execute on function public.resolver_reclamacion_taller(uuid, boolean)
    to authenticated;

revoke all on function public.registrar_reclamacion_taller()
    from public, anon, authenticated;

commit;

-- El acceso de propietario usa Supabase Auth con enlace mágico.
-- shouldCreateUser=true crea la cuenta si no existe y accede si ya existe.
-- Los cambios posteriores realizados desde actualizar_mi_taller() quedan
-- registrados por el trigger general de public.talleres en registro_actividad.
