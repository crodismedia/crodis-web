begin;

create table if not exists public.suscripciones_taller (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('mensual','anual')),
  importe_cents integer not null check (importe_cents in (100,1100)),
  estado text not null default 'pendiente' check (estado in ('pendiente','activa','vencida','cancelada')),
  referencia text not null unique,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagos_bizum_taller (
  id uuid primary key default gen_random_uuid(),
  suscripcion_id uuid not null references public.suscripciones_taller(id) on delete cascade,
  taller_id uuid not null references public.talleres(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  referencia text not null unique,
  importe_cents integer not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','rechazado')),
  identificador_operacion text,
  confirmado_at timestamptz,
  confirmado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.suscripciones_taller enable row level security;
alter table public.pagos_bizum_taller enable row level security;

create policy "propietario lee sus suscripciones" on public.suscripciones_taller
for select to authenticated using (usuario_id=auth.uid() or public.es_administrador());
create policy "propietario lee sus pagos" on public.pagos_bizum_taller
for select to authenticated using (usuario_id=auth.uid() or public.es_administrador());
create policy "solo admin gestiona suscripciones" on public.suscripciones_taller
for all to authenticated using (public.es_administrador()) with check (public.es_administrador());
create policy "solo admin gestiona pagos" on public.pagos_bizum_taller
for all to authenticated using (public.es_administrador()) with check (public.es_administrador());

create or replace function public.crear_pago_bizum_taller(p_taller_id uuid,p_plan text)
returns table(suscripcion_id uuid,referencia text,importe_cents integer)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_importe integer; v_ref text; v_sid uuid;
begin
  if auth.uid() is null then raise exception 'sesion_requerida' using errcode='42501'; end if;
  if not exists(select 1 from public.taller_propietarios where taller_id=p_taller_id and usuario_id=auth.uid()) then
    raise exception 'taller_no_autorizado' using errcode='42501';
  end if;
  if p_plan not in ('mensual','anual') then raise exception 'plan_no_valido' using errcode='23514'; end if;
  v_importe:=case when p_plan='mensual' then 100 else 1100 end;
  v_ref:='TM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.suscripciones_taller(taller_id,usuario_id,plan,importe_cents,referencia)
  values(p_taller_id,auth.uid(),p_plan,v_importe,v_ref) returning id into v_sid;
  insert into public.pagos_bizum_taller(suscripcion_id,taller_id,usuario_id,referencia,importe_cents)
  values(v_sid,p_taller_id,auth.uid(),v_ref,v_importe);
  return query select v_sid,v_ref,v_importe;
end;$$;

create or replace function public.confirmar_pago_bizum_taller(p_referencia text,p_identificador text default null)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_pago public.pagos_bizum_taller%rowtype; v_plan text;
begin
  if not public.es_administrador() then raise exception 'Acceso no autorizado'; end if;
  select * into v_pago from public.pagos_bizum_taller where referencia=p_referencia for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if v_pago.estado='confirmado' then return; end if;
  select plan into v_plan from public.suscripciones_taller where id=v_pago.suscripcion_id;
  update public.pagos_bizum_taller set estado='confirmado',identificador_operacion=nullif(trim(p_identificador),''),confirmado_at=now(),confirmado_por=auth.uid() where id=v_pago.id;
  update public.suscripciones_taller set estado='activa',fecha_inicio=now(),fecha_fin=case when v_plan='mensual' then now()+interval '1 month' else now()+interval '1 year' end,updated_at=now() where id=v_pago.suscripcion_id;
end;$$;

revoke all on function public.crear_pago_bizum_taller(uuid,text) from public,anon;
grant execute on function public.crear_pago_bizum_taller(uuid,text) to authenticated;
revoke all on function public.confirmar_pago_bizum_taller(text,text) from public,anon;
grant execute on function public.confirmar_pago_bizum_taller(text,text) to authenticated;

commit;