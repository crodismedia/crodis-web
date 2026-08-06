begin;

create table if not exists public.solicitudes_propiedad_taller (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  solicitante_user_id uuid not null references auth.users(id) on delete cascade,
  nombre_responsable text not null check (char_length(btrim(nombre_responsable)) between 5 and 120),
  relacion_taller text not null check (relacion_taller in ('propietario','administrador','representante')),
  email_contacto text not null check (email_contacto ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  telefono_contacto text not null,
  metodo_verificacion text not null check (metodo_verificacion in ('telefono_taller','email_taller','dominio_web','documento')),
  estado text not null default 'pendiente' check (estado in ('pendiente','verificando','aprobada','rechazada','cancelada')),
  declaracion_veracidad boolean not null default false,
  notas_revision text,
  revisado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taller_id, solicitante_user_id, estado)
);

alter table public.solicitudes_propiedad_taller enable row level security;

create policy "solicitante_crea_su_solicitud"
on public.solicitudes_propiedad_taller
for insert
to authenticated
with check (
  auth.uid() = solicitante_user_id
  and declaracion_veracidad = true
  and estado = 'pendiente'
);

create policy "solicitante_lee_sus_solicitudes"
on public.solicitudes_propiedad_taller
for select
to authenticated
using (auth.uid() = solicitante_user_id);

create policy "administrador_gestiona_solicitudes"
on public.solicitudes_propiedad_taller
for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create index if not exists solicitudes_propiedad_taller_taller_idx
  on public.solicitudes_propiedad_taller(taller_id);
create index if not exists solicitudes_propiedad_taller_usuario_idx
  on public.solicitudes_propiedad_taller(solicitante_user_id);
create index if not exists solicitudes_propiedad_taller_estado_idx
  on public.solicitudes_propiedad_taller(estado);

commit;
