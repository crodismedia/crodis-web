-- TallerMap · Fase 8: reclamación de fichas por propietarios
-- Ejecutar completo en Supabase > SQL Editor después de edicion_propietario_taller.sql.

begin;

create table if not exists public.reclamaciones_taller (
    id bigserial primary key,
    taller_id uuid not null references public.talleres(id) on delete cascade,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    email text not null,
    nombre_contacto text not null,
    telefono_contacto text,
    mensaje text,
    estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
    revisado_por uuid references auth.users(id),
    revisado_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists reclamaciones_taller_estado_created_idx
    on public.reclamaciones_taller (estado, created_at desc);
create index if not exists reclamaciones_taller_usuario_idx
    on public.reclamaciones_taller (usuario_id, created_at desc);
create unique index if not exists reclamaciones_taller_pendiente_unica_idx
    on public.reclamaciones_taller (taller_id, usuario_id)
    where estado = 'pendiente';

alter table public.reclamaciones_taller enable row level security;

drop policy if exists "usuario ve sus reclamaciones" on public.reclamaciones_taller;
create policy "usuario ve sus reclamaciones"
on public.reclamaciones_taller
for select
to authenticated
using (usuario_id = auth.uid() or public.es_administrador());

drop policy if exists "admin actualiza reclamaciones" on public.reclamaciones_taller;
create policy "admin actualiza reclamaciones"
on public.reclamaciones_taller
for update
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create or replace function public.crear_reclamacion_taller(
    p_taller_id uuid,
    p_nombre_contacto text,
    p_telefono_contacto text default null,
    p_mensaje text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_id bigint;
    v_email text;
begin
    if auth.uid() is null then
        raise exception 'sesion_requerida' using errcode = '42501';
    end if;

    v_email := nullif(lower(btrim(coalesce(auth.jwt()->>'email',''))), '');
    if v_email is null then
        raise exception 'email_no_disponible' using errcode = '23514';
    end if;

    if char_length(btrim(coalesce(p_nombre_contacto,''))) not between 2 and 120 then
        raise exception 'nombre_contacto_no_valido' using errcode = '23514';
    end if;
    if p_telefono_contacto is not null and char_length(btrim(p_telefono_contacto)) not between 7 and 30 then
        raise exception 'telefono_contacto_no_valido' using errcode = '23514';
    end if;
    if p_mensaje is not null and char_length(btrim(p_mensaje)) > 1200 then
        raise exception 'mensaje_demasiado_largo' using errcode = '23514';
    end if;

    if not exists (select 1 from public.talleres where id = p_taller_id and activo = true) then
        raise exception 'taller_no_disponible' using errcode = 'P0002';
    end if;

    if exists (select 1 from public.taller_propietarios where taller_id = p_taller_id) then
        raise exception 'taller_ya_reclamado' using errcode = '23505';
    end if;

    insert into public.reclamaciones_taller (
        taller_id, usuario_id, email, nombre_contacto, telefono_contacto, mensaje
    ) values (
        p_taller_id,
        auth.uid(),
        v_email,
        btrim(p_nombre_contacto),
        nullif(btrim(coalesce(p_telefono_contacto,'')),''),
        nullif(btrim(coalesce(p_mensaje,'')),'')
    )
    returning id into v_id;

    return v_id;
exception
    when unique_violation then
        raise exception 'reclamacion_pendiente_existente' using errcode = '23505';
end;
$$;

create or replace function public.resolver_reclamacion_taller(
    p_reclamacion_id bigint,
    p_aprobar boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_reclamacion public.reclamaciones_taller%rowtype;
begin
    if auth.uid() is null or not public.es_administrador() then
        raise exception 'acceso_denegado' using errcode = '42501';
    end if;

    select * into v_reclamacion
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
        if exists (
            select 1 from public.taller_propietarios
            where taller_id = v_reclamacion.taller_id
              and usuario_id <> v_reclamacion.usuario_id
        ) then
            raise exception 'taller_ya_asignado' using errcode = '23505';
        end if;

        insert into public.taller_propietarios (taller_id, usuario_id)
        values (v_reclamacion.taller_id, v_reclamacion.usuario_id)
        on conflict (taller_id) do update
        set usuario_id = excluded.usuario_id;

        update public.reclamaciones_taller
        set estado = 'aprobada', revisado_por = auth.uid(), revisado_at = now(), updated_at = now()
        where id = p_reclamacion_id;

        update public.reclamaciones_taller
        set estado = 'rechazada', revisado_por = auth.uid(), revisado_at = now(), updated_at = now()
        where taller_id = v_reclamacion.taller_id
          and id <> p_reclamacion_id
          and estado = 'pendiente';
    else
        update public.reclamaciones_taller
        set estado = 'rechazada', revisado_por = auth.uid(), revisado_at = now(), updated_at = now()
        where id = p_reclamacion_id;
    end if;
end;
$$;

revoke all on table public.reclamaciones_taller from public, anon;
grant select on table public.reclamaciones_taller to authenticated;

revoke all on function public.crear_reclamacion_taller(uuid,text,text,text) from public, anon;
grant execute on function public.crear_reclamacion_taller(uuid,text,text,text) to authenticated;

revoke all on function public.resolver_reclamacion_taller(bigint,boolean) from public, anon;
grant execute on function public.resolver_reclamacion_taller(bigint,boolean) to authenticated;

commit;
