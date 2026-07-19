-- Ejecuta este archivo en el SQL Editor de Supabase después de crear
-- solicitudes_alta_taller. No elimina la política de inserción pública existente.

create table if not exists public.administradores (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.administradores enable row level security;

drop policy if exists "administradores ven su propia asignacion" on public.administradores;
create policy "administradores ven su propia asignacion"
on public.administradores for select to authenticated
using (auth.uid() = user_id);

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1 from public.administradores where user_id = auth.uid()
    );
$$;

revoke all on function public.es_administrador() from public;
grant execute on function public.es_administrador() to authenticated;

-- La tabla de solicitudes mantiene su política de INSERT para visitantes.
alter table public.solicitudes_alta_taller enable row level security;

drop policy if exists "administradores leen solicitudes" on public.solicitudes_alta_taller;
create policy "administradores leen solicitudes"
on public.solicitudes_alta_taller for select to authenticated
using (public.es_administrador());

drop policy if exists "administradores gestionan solicitudes" on public.solicitudes_alta_taller;
create policy "administradores gestionan solicitudes"
on public.solicitudes_alta_taller for update to authenticated
using (public.es_administrador())
with check (public.es_administrador());

grant select, update on public.solicitudes_alta_taller to authenticated;
revoke select, update, delete on public.solicitudes_alta_taller from anon;

-- Añade al directorio los datos necesarios para conservar la solicitud aprobada.
alter table public.talleres
    add column if not exists propietario text,
    add column if not exists cif text,
    add column if not exists email text,
    add column if not exists direccion text,
    add column if not exists codigo_postal text;

-- Estos índices impiden duplicados incluso con dos aprobaciones simultáneas.
create unique index if not exists talleres_cif_unico
on public.talleres (upper(btrim(cif)))
where nullif(btrim(cif), '') is not null;

create unique index if not exists talleres_nombre_direccion_unico
on public.talleres (lower(btrim(nombre)), lower(btrim(direccion)))
where nullif(btrim(nombre), '') is not null and nullif(btrim(direccion), '') is not null;

create or replace function public.aprobar_solicitud(solicitud_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    solicitud public.solicitudes_alta_taller%rowtype;
    nuevo_taller_id uuid;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado';
    end if;

    select * into solicitud
    from public.solicitudes_alta_taller
    where id = solicitud_id and estado = 'pendiente'
    for update;

    if not found then
        raise exception 'Solicitud no disponible';
    end if;

if exists (
    select 1
    from public.talleres
    where upper(btrim(cif)) = upper(btrim(solicitud.cif))
       or (
            lower(btrim(nombre)) =
                lower(btrim(solicitud.nombre_taller))
            and
            lower(btrim(direccion)) =
                lower(btrim(solicitud.direccion))
       )
) then
    raise exception 'Taller duplicado por CIF o nombre y dirección';
end if;
    insert into public.talleres (
        nombre, propietario, cif, email, telefono, direccion, codigo_postal,
        ciudad, provincia, descripcion, activo, verificado
    ) values (
        solicitud.nombre_taller, solicitud.propietario, solicitud.cif, solicitud.email,
        solicitud.telefono, solicitud.direccion, solicitud.codigo_postal,
        solicitud.ciudad, solicitud.provincia, solicitud.descripcion, true, false
    ) returning id into nuevo_taller_id;

    update public.solicitudes_alta_taller
    set estado = 'aprobada'
    where id = solicitud.id;

    return jsonb_build_object('solicitud_id', solicitud.id, 'taller_id', nuevo_taller_id);
end;
$$;

create or replace function public.rechazar_solicitud(solicitud_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    solicitud public.solicitudes_alta_taller%rowtype;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado';
    end if;

    select * into solicitud
    from public.solicitudes_alta_taller
    where id = solicitud_id and estado = 'pendiente'
    for update;

    if not found then
        raise exception 'Solicitud no disponible';
    end if;

    update public.solicitudes_alta_taller
    set estado = 'rechazada'
    where id = solicitud.id;

    return jsonb_build_object('solicitud_id', solicitud.id);
end;
$$;

revoke all on function public.aprobar_solicitud(bigint) from public;
revoke all on function public.rechazar_solicitud(bigint) from public;
grant execute on function public.aprobar_solicitud(bigint) to authenticated;
grant execute on function public.rechazar_solicitud(bigint) to authenticated;
