-- Ejecuta este archivo en el SQL Editor de Supabase.
-- Las solicitudes no se insertan ni publican en la tabla "talleres".
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
    descripcion text not null check (char_length(trim(descripcion)) between 10 and 1500),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
    created_at timestamptz not null default now()
);

alter table public.solicitudes_alta_taller enable row level security;

-- No hay política SELECT para anon/authenticated: visitantes no pueden leer solicitudes.
drop policy if exists "visitantes pueden enviar solicitudes" on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert to anon, authenticated
with check (
    estado = 'pendiente'
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

grant insert on table public.solicitudes_alta_taller to anon, authenticated;
grant usage on sequence public.solicitudes_alta_taller_id_seq to anon, authenticated;
