-- TallerMap: horario semanal obligatorio y publicación automática gratuita.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

begin;

alter table public.solicitudes_alta_taller
    add column if not exists horarios jsonb;
alter table public.talleres
    add column if not exists horarios jsonb;

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_horarios_obligatorios;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_horarios_obligatorios
    check (
        horarios is not null
        and jsonb_typeof(horarios) = 'object'
        and horarios ?& array[
            'lunes', 'martes', 'miercoles', 'jueves',
            'viernes', 'sabado', 'domingo'
        ]
    ) not valid;

alter table public.solicitudes_alta_taller
    alter column estado set default 'aprobada';

create or replace function public.preparar_estado_solicitud()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.estado := 'aprobada';
    new.revisada_at := now();
    new.revisada_por := null;
    return new;
end;
$$;

create or replace function public.publicar_solicitud_automatica()
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
        descripcion, horarios, servicios, fotos, verificado, activo
    ) values (
        new.id, new.nombre_taller, new.propietario, new.cif,
        new.email, new.telefono, new.web, new.direccion,
        new.codigo_postal, new.ciudad, new.provincia, 'España',
        new.descripcion, new.horarios, new.servicios, new.fotos, false, true
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
drop trigger if exists publicar_solicitud_automatica_al_insertar
    on public.solicitudes_alta_taller;
create trigger publicar_solicitud_automatica_al_insertar
after insert on public.solicitudes_alta_taller
for each row
when (new.estado = 'aprobada')
execute function public.publicar_solicitud_automatica();

drop policy if exists "visitantes pueden enviar solicitudes"
    on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert
to anon, authenticated
with check (
    estado = 'aprobada'
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
    and horarios is not null
    and jsonb_typeof(horarios) = 'object'
    and horarios ?& array[
        'lunes', 'martes', 'miercoles', 'jueves',
        'viernes', 'sabado', 'domingo'
    ]
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

drop function if exists public.aprobar_solicitud(bigint);

revoke all on function public.preparar_estado_solicitud()
    from public, anon, authenticated;
revoke all on function public.publicar_solicitud_automatica()
    from public, anon, authenticated;

commit;

-- Después de publicar un taller nuevo puedes comprobarlo con:
-- select nombre_taller, estado, horarios from public.solicitudes_alta_taller order by created_at desc limit 5;
-- select nombre, activo, horarios from public.talleres order by created_at desc limit 5;
