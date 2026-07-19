-- Migración aditiva: no elimina datos ni políticas existentes.
-- Ejecuta este archivo después de solicitudes_alta_taller.sql.

alter table public.solicitudes_alta_taller
    add column if not exists acepta_responsabilidad boolean,
    add column if not exists acepta_terminos_at timestamptz,
    add column if not exists version_terminos text;

-- Las solicitudes anteriores se conservan y quedan marcadas como no aceptadas.
update public.solicitudes_alta_taller
set acepta_responsabilidad = false
where acepta_responsabilidad is null;

alter table public.solicitudes_alta_taller
    alter column acepta_responsabilidad set default false,
    alter column acepta_responsabilidad set not null;

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_aceptacion_condiciones_valida;

alter table public.solicitudes_alta_taller
    add constraint solicitudes_aceptacion_condiciones_valida
    check (
        not acepta_responsabilidad
        or (acepta_terminos_at is not null and version_terminos = '1.0')
    );

-- La base de datos fija la fecha y versión al crear nuevas solicitudes aceptadas.
create or replace function public.registrar_aceptacion_condiciones()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if new.acepta_responsabilidad is distinct from true then
        raise exception 'Debes aceptar las Condiciones de publicación';
    end if;

    new.acepta_terminos_at := now();
    new.version_terminos := '1.0';
    return new;
end;
$$;

drop trigger if exists establecer_aceptacion_condiciones on public.solicitudes_alta_taller;
create trigger establecer_aceptacion_condiciones
before insert on public.solicitudes_alta_taller
for each row execute function public.registrar_aceptacion_condiciones();

-- Se conserva la misma política pública y se añade la exigencia de aceptación.
alter policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
with check (
    estado = 'pendiente'
    and acepta_responsabilidad = true
    and acepta_terminos_at is not null
    and version_terminos = '1.0'
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
