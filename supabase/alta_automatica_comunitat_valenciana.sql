-- TallerMap: publicación automática de altas de la Comunitat Valenciana.
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

-- El estado se decide en Supabase y nunca se confía en el valor enviado
-- desde el navegador. Los prefijos provinciales son 03, 12 y 46.
create or replace function public.preparar_estado_solicitud()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if left(new.codigo_postal, 2) in ('03', '12', '46') then
        new.estado := 'aprobada';
        new.revisada_at := now();
        new.revisada_por := null;
    else
        new.estado := 'pendiente';
        new.revisada_at := null;
        new.revisada_por := null;
    end if;

    return new;
end;
$$;

-- Crea la ficha pública inmediatamente, conservando la diferencia entre
-- "Publicado" y "Verificado" porque no ha existido revisión administrativa.
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

drop trigger if exists preparar_estado_solicitud_al_insertar
    on public.solicitudes_alta_taller;
create trigger preparar_estado_solicitud_al_insertar
before insert on public.solicitudes_alta_taller
for each row execute function public.preparar_estado_solicitud();

drop trigger if exists publicar_solicitud_valenciana_al_insertar
    on public.solicitudes_alta_taller;
create trigger publicar_solicitud_valenciana_al_insertar
after insert on public.solicitudes_alta_taller
for each row
when (new.estado = 'aprobada')
execute function public.publicar_solicitud_valenciana();

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

revoke all on function public.preparar_estado_solicitud()
    from public, anon, authenticated;
revoke all on function public.publicar_solicitud_valenciana()
    from public, anon, authenticated;

commit;

-- Comprobación opcional después de realizar un alta de prueba:
-- select nombre, codigo_postal, provincia, activo, verificado
-- from public.talleres order by created_at desc limit 5;
