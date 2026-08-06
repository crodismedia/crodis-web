begin;

-- Amplía la solicitud antes de crear las funciones que usan estos campos.
alter table public.solicitudes_propiedad_taller
  add column if not exists resuelto_at timestamptz,
  add column if not exists resuelto_por uuid references auth.users(id),
  add column if not exists motivo_resolucion text;

-- TallerMap ya utiliza taller_propietarios y las funciones mis_talleres / actualizar_mi_taller.
create table if not exists public.taller_propietarios (
  taller_id uuid primary key references public.talleres(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists taller_propietarios_usuario_idx
  on public.taller_propietarios(usuario_id);
alter table public.taller_propietarios enable row level security;

drop policy if exists "propietarios ven sus asignaciones" on public.taller_propietarios;
create policy "propietarios ven sus asignaciones"
on public.taller_propietarios for select to authenticated
using (usuario_id=auth.uid() or public.es_administrador());

drop policy if exists "solo admin gestiona propietarios" on public.taller_propietarios;
create policy "solo admin gestiona propietarios"
on public.taller_propietarios for all to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create or replace function public.aprobar_solicitud_propiedad(p_solicitud_id uuid)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v public.solicitudes_propiedad_taller%rowtype;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  select * into v from public.solicitudes_propiedad_taller where id=p_solicitud_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta'; end if;

  insert into public.taller_propietarios(taller_id,usuario_id)
  values(v.taller_id,v.solicitante_user_id)
  on conflict (taller_id) do update set usuario_id=excluded.usuario_id,created_at=now();

  update public.solicitudes_propiedad_taller
  set estado='aprobada',resuelto_at=now(),resuelto_por=auth.uid(),motivo_resolucion=null
  where id=p_solicitud_id;
end;$$;

create or replace function public.rechazar_solicitud_propiedad(p_solicitud_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  if length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Motivo insuficiente'; end if;
  update public.solicitudes_propiedad_taller
  set estado='rechazada',motivo_resolucion=trim(p_motivo),resuelto_at=now(),resuelto_por=auth.uid()
  where id=p_solicitud_id and estado='pendiente';
  if not found then raise exception 'Solicitud no encontrada o ya resuelta'; end if;
end;$$;

revoke all on function public.aprobar_solicitud_propiedad(uuid) from public,anon;
grant execute on function public.aprobar_solicitud_propiedad(uuid) to authenticated;
revoke all on function public.rechazar_solicitud_propiedad(uuid,text) from public,anon;
grant execute on function public.rechazar_solicitud_propiedad(uuid,text) to authenticated;

commit;