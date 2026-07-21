-- TallerMap: configuración completa de solicitudes, talleres, administración y RLS.
-- Ejecuta el archivo completo una sola vez en Supabase > SQL Editor.

begin;

-- Permite volver a ejecutar el archivo aunque existan versiones antiguas
-- con un tipo de retorno diferente.
drop function if exists public.aprobar_solicitud(bigint);
drop function if exists public.rechazar_solicitud(bigint);

create table if not exists public.solicitudes_alta_taller (
    id bigint generated always as identity primary key,
    nombre_taller text not null check (char_length(trim(nombre_taller)) between 2 and 120),
    propietario text not null check (char_length(trim(propietario)) between 2 and 120),
    cif text not null check (char_length(trim(cif)) between 7 and 20),
    email text not null check (char_length(trim(email)) between 5 and 255),
    telefono text not null check (char_length(trim(telefono)) between 9 and 30),
    direccion text not null check (char_length(trim(direccion)) between 5 and 255),
    codigo_postal text not null check (codigo_postal ~ '^[0-9]{5}$'),
    ciudad text not null check (char_length(trim(ciudad)) between 2 and 100),
    provincia text not null check (char_length(trim(provincia)) between 2 and 100),
    servicios text[] not null default '{}',
    descripcion text not null check (char_length(trim(descripcion)) between 10 and 1500),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
    acepta_responsabilidad boolean not null default false,
    acepta_terminos_at timestamptz,
    version_terminos text,
    revisada_at timestamptz,
    revisada_por uuid,
    created_at timestamptz not null default now()
);

-- Completa instalaciones anteriores sin borrar solicitudes existentes.
alter table public.solicitudes_alta_taller add column if not exists servicios text[] not null default '{}';
alter table public.solicitudes_alta_taller add column if not exists acepta_responsabilidad boolean not null default false;
alter table public.solicitudes_alta_taller add column if not exists acepta_terminos_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists version_terminos text;
alter table public.solicitudes_alta_taller add column if not exists revisada_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists revisada_por uuid;

create index if not exists solicitudes_estado_created_idx
    on public.solicitudes_alta_taller (estado, created_at);

create table if not exists public.talleres (
    id uuid primary key default gen_random_uuid(),
    solicitud_id bigint,
    nombre text not null,
    propietario text,
    cif text,
    email text,
    telefono text,
    movil text,
    whatsapp text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    pais text not null default 'España',
    latitud double precision,
    longitud double precision,
    descripcion text,
    web text,
    facebook text,
    instagram text,
    linkedin text,
    horario text,
    logo text,
    portada text,
    servicios text[] not null default '{}',
    verificado boolean not null default false,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Completa una tabla talleres ya existente sin cambiar sus datos actuales.
alter table public.talleres add column if not exists solicitud_id bigint;
alter table public.talleres add column if not exists nombre text;
alter table public.talleres add column if not exists propietario text;
alter table public.talleres add column if not exists cif text;
alter table public.talleres add column if not exists email text;
alter table public.talleres add column if not exists telefono text;
alter table public.talleres add column if not exists movil text;
alter table public.talleres add column if not exists whatsapp text;
alter table public.talleres add column if not exists direccion text;
alter table public.talleres add column if not exists codigo_postal text;
alter table public.talleres add column if not exists ciudad text;
alter table public.talleres add column if not exists provincia text;
alter table public.talleres add column if not exists pais text default 'España';
alter table public.talleres add column if not exists latitud double precision;
alter table public.talleres add column if not exists longitud double precision;
alter table public.talleres add column if not exists descripcion text;
alter table public.talleres add column if not exists web text;
alter table public.talleres add column if not exists facebook text;
alter table public.talleres add column if not exists instagram text;
alter table public.talleres add column if not exists linkedin text;
alter table public.talleres add column if not exists horario text;
alter table public.talleres add column if not exists logo text;
alter table public.talleres add column if not exists portada text;
alter table public.talleres add column if not exists servicios text[] not null default '{}';
alter table public.talleres add column if not exists verificado boolean not null default false;
alter table public.talleres add column if not exists activo boolean not null default true;
alter table public.talleres add column if not exists created_at timestamptz not null default now();
alter table public.talleres add column if not exists updated_at timestamptz not null default now();

create unique index if not exists talleres_solicitud_id_unica
    on public.talleres (solicitud_id)
    where solicitud_id is not null;
create index if not exists talleres_publicos_ubicacion_idx
    on public.talleres (activo, provincia, ciudad, codigo_postal);
create index if not exists talleres_servicios_gin_idx
    on public.talleres using gin (servicios);

create table if not exists public.administradores (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from public.administradores
        where user_id = auth.uid()
    );
$$;

alter table public.solicitudes_alta_taller enable row level security;
alter table public.talleres enable row level security;
alter table public.administradores enable row level security;

drop policy if exists "visitantes pueden enviar solicitudes" on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert
to anon, authenticated
with check (
    estado = 'pendiente'
    and acepta_responsabilidad = true
    and acepta_terminos_at is not null
    and char_length(trim(nombre_taller)) between 2 and 120
    and char_length(trim(propietario)) between 2 and 120
    and char_length(trim(cif)) between 7 and 20
    and char_length(trim(email)) between 5 and 255
    and char_length(trim(telefono)) between 9 and 30
    and char_length(trim(direccion)) between 5 and 255
    and codigo_postal ~ '^[0-9]{5}$'
    and char_length(trim(ciudad)) between 2 and 100
    and char_length(trim(provincia)) between 2 and 100
    and char_length(trim(descripcion)) between 10 and 1500
);

drop policy if exists "administradores leen solicitudes" on public.solicitudes_alta_taller;
create policy "administradores leen solicitudes"
on public.solicitudes_alta_taller
for select
to authenticated
using (public.es_administrador());

drop policy if exists "publico consulta talleres activos" on public.talleres;
create policy "publico consulta talleres activos"
on public.talleres
for select
to anon, authenticated
using (activo = true);

drop policy if exists "administradores consultan todos los talleres" on public.talleres;
create policy "administradores consultan todos los talleres"
on public.talleres
for select
to authenticated
using (public.es_administrador());

drop policy if exists "administradores ven su propia asignacion" on public.administradores;
create policy "administradores ven su propia asignacion"
on public.administradores
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.aprobar_solicitud(p_solicitud_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_solicitud public.solicitudes_alta_taller%rowtype;
    v_taller_id uuid;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    select *
    into v_solicitud
    from public.solicitudes_alta_taller
    where id = p_solicitud_id
    for update;

    if not found then
        raise exception 'Solicitud no encontrada';
    end if;
    if v_solicitud.estado <> 'pendiente' then
        raise exception 'La solicitud ya ha sido procesada';
    end if;

    if exists (
        select 1
        from public.talleres t
        where t.activo = true
          and (
              lower(coalesce(t.cif, '')) = lower(v_solicitud.cif)
              or (
                  lower(coalesce(t.nombre, '')) = lower(v_solicitud.nombre_taller)
                  and lower(coalesce(t.direccion, '')) = lower(v_solicitud.direccion)
              )
          )
    ) then
        raise exception 'duplicado: ya existe un taller con el mismo CIF o nombre y dirección';
    end if;

    select id into v_taller_id
    from public.talleres
    where solicitud_id = p_solicitud_id
    limit 1;

    if v_taller_id is null then
        insert into public.talleres (
            solicitud_id, nombre, propietario, cif, email, telefono,
            direccion, codigo_postal, ciudad, provincia, pais,
            descripcion, servicios, verificado, activo
        ) values (
            v_solicitud.id, v_solicitud.nombre_taller, v_solicitud.propietario,
            v_solicitud.cif, v_solicitud.email, v_solicitud.telefono,
            v_solicitud.direccion, v_solicitud.codigo_postal, v_solicitud.ciudad,
            v_solicitud.provincia, 'España', v_solicitud.descripcion,
            v_solicitud.servicios, true, true
        )
        returning id into v_taller_id;
    else
        update public.talleres
        set nombre = v_solicitud.nombre_taller,
            propietario = v_solicitud.propietario,
            cif = v_solicitud.cif,
            email = v_solicitud.email,
            telefono = v_solicitud.telefono,
            direccion = v_solicitud.direccion,
            codigo_postal = v_solicitud.codigo_postal,
            ciudad = v_solicitud.ciudad,
            provincia = v_solicitud.provincia,
            descripcion = v_solicitud.descripcion,
            servicios = v_solicitud.servicios,
            verificado = true,
            activo = true,
            updated_at = now()
        where id = v_taller_id;
    end if;

    update public.solicitudes_alta_taller
    set estado = 'aprobada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id;

    return v_taller_id;
end;
$$;

create or replace function public.rechazar_solicitud(p_solicitud_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    update public.solicitudes_alta_taller
    set estado = 'rechazada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id
      and estado = 'pendiente';

    if not found then
        raise exception 'Solicitud no encontrada o ya procesada';
    end if;
end;
$$;

revoke all on table public.solicitudes_alta_taller from anon, authenticated;
grant insert on table public.solicitudes_alta_taller to anon, authenticated;
grant select on table public.solicitudes_alta_taller to authenticated;
grant usage on sequence public.solicitudes_alta_taller_id_seq to anon, authenticated;

revoke insert, update, delete on table public.talleres from anon, authenticated;
grant select on table public.talleres to anon, authenticated;

grant select on table public.administradores to authenticated;

revoke all on function public.es_administrador() from public, anon;
grant execute on function public.es_administrador() to authenticated;
revoke all on function public.aprobar_solicitud(bigint) from public, anon;
grant execute on function public.aprobar_solicitud(bigint) to authenticated;
revoke all on function public.rechazar_solicitud(bigint) from public, anon;
grant execute on function public.rechazar_solicitud(bigint) to authenticated;

commit;

-- Después de crear un usuario en Authentication > Users, conviértelo en administrador:
-- insert into public.administradores (user_id) values ('UUID-DEL-USUARIO');
