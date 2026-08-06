begin;

create table if not exists public.bajas_taller (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete restrict,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  motivo text not null check (motivo in ('cierre_definitivo','duplicado','cambio_propietario','no_desea_aparecer','datos_incorrectos','otro')),
  explicacion text not null check (char_length(btrim(explicacion)) between 20 and 800),
  created_at timestamptz not null default now()
);

alter table public.bajas_taller enable row level security;

drop policy if exists "propietario ve sus bajas" on public.bajas_taller;
create policy "propietario ve sus bajas" on public.bajas_taller
for select to authenticated
using (usuario_id=auth.uid() or public.es_administrador());

alter table public.talleres
  add column if not exists fecha_baja timestamptz,
  add column if not exists motivo_baja text,
  add column if not exists detalle_baja text,
  add column if not exists baja_solicitada_por uuid references auth.users(id);

create or replace function public.mi_taller_verificado(p_taller_id uuid default null)
returns table(id uuid,nombre text,direccion text,codigo_postal text,ciudad text,activo boolean)
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select t.id,t.nombre,t.direccion,t.codigo_postal,t.ciudad,t.activo
  from public.talleres t
  join public.taller_propietarios tp on tp.taller_id=t.id
  where tp.usuario_id=auth.uid()
    and (p_taller_id is null or t.id=p_taller_id)
  order by t.created_at desc
  limit 1;
$$;

create or replace function public.dar_baja_inmediata_mi_taller(p_taller_id uuid,p_motivo text,p_explicacion text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_motivo not in ('cierre_definitivo','duplicado','cambio_propietario','no_desea_aparecer','datos_incorrectos','otro') then raise exception 'Motivo no válido' using errcode='23514'; end if;
  if char_length(btrim(coalesce(p_explicacion,''))) not between 20 and 800 then raise exception 'Explicación insuficiente' using errcode='23514'; end if;
  if not exists(select 1 from public.taller_propietarios tp where tp.taller_id=p_taller_id and tp.usuario_id=auth.uid()) then raise exception 'Taller no autorizado' using errcode='42501'; end if;

  insert into public.bajas_taller(taller_id,usuario_id,motivo,explicacion)
  values(p_taller_id,auth.uid(),p_motivo,btrim(p_explicacion));

  update public.talleres
  set activo=false,
      fecha_baja=now(),
      motivo_baja=p_motivo,
      detalle_baja=btrim(p_explicacion),
      baja_solicitada_por=auth.uid(),
      updated_at=now()
  where id=p_taller_id;
end;$$;

revoke all on table public.bajas_taller from public,anon;
grant select on table public.bajas_taller to authenticated;
revoke all on function public.mi_taller_verificado(uuid) from public,anon;
grant execute on function public.mi_taller_verificado(uuid) to authenticated;
revoke all on function public.dar_baja_inmediata_mi_taller(uuid,text,text) from public,anon;
grant execute on function public.dar_baja_inmediata_mi_taller(uuid,text,text) to authenticated;

commit;