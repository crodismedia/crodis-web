begin;

create table if not exists public.talleres_propietarios (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solicitud_id uuid references public.solicitudes_propiedad_taller(id) on delete set null,
  activo boolean not null default true,
  verificado_at timestamptz not null default now(),
  verificado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (taller_id, user_id)
);

alter table public.talleres_propietarios enable row level security;

drop policy if exists "propietario lee sus vinculaciones" on public.talleres_propietarios;
create policy "propietario lee sus vinculaciones"
on public.talleres_propietarios for select
to authenticated
using (user_id = auth.uid() or public.es_administrador());

drop policy if exists "solo admin gestiona vinculaciones" on public.talleres_propietarios;
create policy "solo admin gestiona vinculaciones"
on public.talleres_propietarios for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create or replace function public.aprobar_solicitud_propiedad(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_propiedad_taller%rowtype;
begin
  if not public.es_administrador() then
    raise exception 'Acceso no autorizado';
  end if;

  select * into v_solicitud
  from public.solicitudes_propiedad_taller
  where id = p_solicitud_id
  for update;

  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_solicitud.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta'; end if;

  insert into public.talleres_propietarios(taller_id,user_id,solicitud_id,verificado_por)
  values(v_solicitud.taller_id,v_solicitud.solicitante_user_id,v_solicitud.id,auth.uid())
  on conflict (taller_id,user_id) do update
    set activo=true, solicitud_id=excluded.solicitud_id,
        verificado_at=now(), verificado_por=auth.uid();

  update public.solicitudes_propiedad_taller
  set estado='aprobada', resuelto_at=now(), resuelto_por=auth.uid()
  where id=p_solicitud_id;
end;
$$;

create or replace function public.rechazar_solicitud_propiedad(p_solicitud_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if length(trim(coalesce(p_motivo,''))) < 10 then raise exception 'Motivo insuficiente'; end if;
  update public.solicitudes_propiedad_taller
  set estado='rechazada', motivo_resolucion=trim(p_motivo), resuelto_at=now(), resuelto_por=auth.uid()
  where id=p_solicitud_id and estado='pendiente';
  if not found then raise exception 'Solicitud no encontrada o ya resuelta'; end if;
end;
$$;

alter table public.solicitudes_propiedad_taller
  add column if not exists resuelto_at timestamptz,
  add column if not exists resuelto_por uuid references auth.users(id),
  add column if not exists motivo_resolucion text;

-- El propietario verificado puede leer y actualizar exclusivamente su taller.
drop policy if exists "propietario lee su taller" on public.talleres;
create policy "propietario lee su taller"
on public.talleres for select
to authenticated
using (
  exists(select 1 from public.talleres_propietarios tp
         where tp.taller_id=talleres.id and tp.user_id=auth.uid() and tp.activo)
  or public.es_administrador()
);

drop policy if exists "propietario actualiza su taller" on public.talleres;
create policy "propietario actualiza su taller"
on public.talleres for update
to authenticated
using (
  exists(select 1 from public.talleres_propietarios tp
         where tp.taller_id=talleres.id and tp.user_id=auth.uid() and tp.activo)
  or public.es_administrador()
)
with check (
  exists(select 1 from public.talleres_propietarios tp
         where tp.taller_id=talleres.id and tp.user_id=auth.uid() and tp.activo)
  or public.es_administrador()
);

commit;