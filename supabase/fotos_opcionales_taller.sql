-- TallerMap: fotografías opcionales, privadas y con aceptación adicional.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

begin;

alter table public.solicitudes_alta_taller
    add column if not exists fotos text[] not null default '{}';
alter table public.solicitudes_alta_taller
    add column if not exists acepta_condiciones_fotos boolean not null default false;
alter table public.solicitudes_alta_taller
    add column if not exists acepta_condiciones_fotos_at timestamptz;
alter table public.solicitudes_alta_taller
    add column if not exists version_condiciones_fotos text;
alter table public.talleres
    add column if not exists fotos text[] not null default '{}';

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_maximo_cinco_fotos;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_maximo_cinco_fotos
    check (
        cardinality(fotos) <= 5
        and (
            cardinality(fotos) = 0
            or (
                acepta_condiciones_fotos = true
                and acepta_condiciones_fotos_at is not null
                and nullif(btrim(version_condiciones_fotos), '') is not null
            )
        )
    )
    not valid;

alter table public.talleres
    drop constraint if exists talleres_maximo_cinco_fotos;
alter table public.talleres
    add constraint talleres_maximo_cinco_fotos
    check (cardinality(fotos) <= 5)
    not valid;

create or replace function public.puede_subir_foto_solicitud(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        p_ruta ~ '^solicitudes/[0-9a-f-]{36}/[0-9]{2}-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
        and exists (
            select 1
            from public.solicitudes_alta_taller s
            where p_ruta = any(s.fotos)
              and s.acepta_condiciones_fotos = true
              and s.acepta_condiciones_fotos_at is not null
        );
$$;

-- Mantiene la publicación automática valenciana y copia sus fotografías.
create or replace function public.publicar_solicitud_valenciana()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if exists (
        select 1
        from public.talleres t
        where t.activo = true
          and (
              lower(coalesce(t.cif, '')) = lower(new.cif)
              or (
                  lower(coalesce(t.nombre, '')) = lower(new.nombre_taller)
                  and lower(coalesce(t.direccion, '')) = lower(new.direccion)
              )
          )
    ) then
        raise exception 'duplicado: ya existe un taller con el mismo CIF o nombre y dirección'
            using errcode = '23505';
    end if;

    insert into public.talleres (
        solicitud_id, nombre, propietario, cif, email, telefono, web,
        direccion, codigo_postal, ciudad, provincia, pais,
        descripcion, servicios, fotos, verificado, activo
    ) values (
        new.id, new.nombre_taller, new.propietario, new.cif,
        new.email, new.telefono, new.web, new.direccion,
        new.codigo_postal, new.ciudad, new.provincia, 'España',
        new.descripcion, new.servicios, new.fotos, false, true
    );

    return new;
end;
$$;

-- Conserva las fotografías cuando el administrador aprueba otra provincia.
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

    select * into v_solicitud
    from public.solicitudes_alta_taller
    where id = p_solicitud_id
    for update;

    if not found then raise exception 'Solicitud no encontrada'; end if;
    if v_solicitud.estado <> 'pendiente' then
        raise exception 'La solicitud ya ha sido procesada';
    end if;

    if exists (
        select 1 from public.talleres t
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
            solicitud_id, nombre, propietario, cif, email, telefono, web,
            direccion, codigo_postal, ciudad, provincia, pais,
            descripcion, servicios, fotos, verificado, activo
        ) values (
            v_solicitud.id, v_solicitud.nombre_taller, v_solicitud.propietario,
            v_solicitud.cif, v_solicitud.email, v_solicitud.telefono, v_solicitud.web,
            v_solicitud.direccion, v_solicitud.codigo_postal, v_solicitud.ciudad,
            v_solicitud.provincia, 'España', v_solicitud.descripcion,
            v_solicitud.servicios, v_solicitud.fotos, true, true
        )
        returning id into v_taller_id;
    else
        update public.talleres
        set nombre = v_solicitud.nombre_taller,
            propietario = v_solicitud.propietario,
            cif = v_solicitud.cif,
            email = v_solicitud.email,
            telefono = v_solicitud.telefono,
            web = v_solicitud.web,
            direccion = v_solicitud.direccion,
            codigo_postal = v_solicitud.codigo_postal,
            ciudad = v_solicitud.ciudad,
            provincia = v_solicitud.provincia,
            descripcion = v_solicitud.descripcion,
            servicios = v_solicitud.servicios,
            fotos = v_solicitud.fotos,
            verificado = true,
            activo = true,
            updated_at = now()
        where id = v_taller_id;
    end if;

    update public.solicitudes_alta_taller
    set estado = 'aprobada', revisada_at = now(), revisada_por = auth.uid()
    where id = p_solicitud_id;

    return v_taller_id;
end;
$$;

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
    and char_length(trim(descripcion)) between 10 and 1500
);

insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
) values (
    'fotos-talleres', 'fotos-talleres', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "solicitudes suben sus fotos autorizadas" on storage.objects;
create policy "solicitudes suben sus fotos autorizadas"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'fotos-talleres'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
    and public.puede_subir_foto_solicitud(name)
);

drop policy if exists "publico ve fotos de talleres activos" on storage.objects;
create policy "publico ve fotos de talleres activos"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'fotos-talleres'
    and exists (
        select 1 from public.talleres t
        where t.activo = true
          and name = any(t.fotos)
    )
);

drop policy if exists "administradores ven fotos de solicitudes" on storage.objects;
create policy "administradores ven fotos de solicitudes"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'fotos-talleres'
    and public.es_administrador()
);

revoke all on function public.puede_subir_foto_solicitud(text) from public;
grant execute on function public.puede_subir_foto_solicitud(text) to anon, authenticated;

commit;

-- Comprobación opcional:
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'fotos-talleres';
