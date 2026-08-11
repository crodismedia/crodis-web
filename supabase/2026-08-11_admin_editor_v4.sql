begin;

alter table public.talleres
  add column if not exists cerrado_temporalmente boolean not null default false,
  add column if not exists motivo_cierre_temporal text,
  add column if not exists fecha_reapertura_prevista date,
  add column if not exists tipo_negocio text not null default 'taller',
  add column if not exists servicio_oficial boolean not null default false,
  add column if not exists marcas_servicio_oficial text;

alter table public.talleres drop constraint if exists talleres_tipo_negocio_valido;
alter table public.talleres add constraint talleres_tipo_negocio_valido
  check (tipo_negocio in ('taller','concesionario','concesionario-oficial','compraventa'));

alter table public.talleres drop constraint if exists talleres_cierre_temporal_coherente;
alter table public.talleres add constraint talleres_cierre_temporal_coherente
  check (cerrado_temporalmente = true or (motivo_cierre_temporal is null and fecha_reapertura_prevista is null));

alter table public.talleres drop constraint if exists talleres_servicio_oficial_coherente;
alter table public.talleres add constraint talleres_servicio_oficial_coherente
  check (servicio_oficial = true or marcas_servicio_oficial is null);

create or replace function public.admin_codigo_provincia_v4(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  with x as (select public.directorio_normalizar(valor) n)
  select case
    when n in ('araba alava','alava','araba') then '01' when n='albacete' then '02'
    when n in ('alicante alacant','alicante','alacant') then '03' when n='almeria' then '04'
    when n='avila' then '05' when n='badajoz' then '06' when n in ('illes balears','baleares') then '07'
    when n='barcelona' then '08' when n='burgos' then '09' when n='caceres' then '10'
    when n='cadiz' then '11' when n in ('castellon castello','castellon','castello') then '12'
    when n='ciudad real' then '13' when n='cordoba' then '14' when n in ('a coruna','coruna') then '15'
    when n='cuenca' then '16' when n='girona' then '17' when n='granada' then '18'
    when n='guadalajara' then '19' when n='gipuzkoa' then '20' when n='huelva' then '21'
    when n='huesca' then '22' when n='jaen' then '23' when n='leon' then '24' when n='lleida' then '25'
    when n='la rioja' then '26' when n='lugo' then '27' when n='madrid' then '28' when n='malaga' then '29'
    when n='murcia' then '30' when n='navarra' then '31' when n='ourense' then '32' when n='asturias' then '33'
    when n='palencia' then '34' when n='las palmas' then '35' when n='pontevedra' then '36'
    when n='salamanca' then '37' when n='santa cruz de tenerife' then '38' when n='cantabria' then '39'
    when n='segovia' then '40' when n='sevilla' then '41' when n='soria' then '42' when n='tarragona' then '43'
    when n='teruel' then '44' when n='toledo' then '45' when n in ('valencia valencia','valencia') then '46'
    when n='valladolid' then '47' when n='bizkaia' then '48' when n='zamora' then '49'
    when n='zaragoza' then '50' when n='ceuta' then '51' when n='melilla' then '52' else null end
  from x;
$$;

create or replace function public.admin_obtener_taller_editor_v4(p_taller_id uuid)
returns setof public.talleres
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_administrador() then raise exception 'No autorizado' using errcode='42501'; end if;
  return query select t.* from public.talleres t where t.id=p_taller_id limit 1;
end;
$$;
revoke all on function public.admin_obtener_taller_editor_v4(uuid) from public;
grant execute on function public.admin_obtener_taller_editor_v4(uuid) to authenticated;

create or replace function public.admin_actualizar_taller_editor_v4(
  p_taller_id uuid,p_nombre text,p_telefono text,p_web text,p_direccion text,p_codigo_postal text,
  p_ciudad text,p_provincia text,p_descripcion text,p_servicios text[],p_horarios jsonb,
  p_cerrado_temporalmente boolean,p_motivo_cierre_temporal text,p_fecha_reapertura_prevista date,
  p_tipo_negocio text,p_servicio_oficial boolean,p_marcas_servicio_oficial text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo_provincia text;
  v_municipio public.municipios%rowtype;
begin
  if not public.es_administrador() then raise exception 'No autorizado' using errcode='42501'; end if;
  if p_taller_id is null then raise exception 'Falta p_taller_id' using errcode='22023'; end if;
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_no_valido' using errcode='23514'; end if;
  if coalesce(trim(p_codigo_postal),'') !~ '^\d{5}$' then raise exception 'codigo_postal_no_valido' using errcode='23514'; end if;

  v_codigo_provincia := left(trim(p_codigo_postal),2);
  if public.admin_codigo_provincia_v4(p_provincia) is distinct from v_codigo_provincia then
    raise exception 'provincia_codigo_postal_no_coinciden' using errcode='23514';
  end if;

  select m.* into v_municipio
  from public.municipios m
  where m.activo=true and left(m.codigo_municipal,2)=v_codigo_provincia
    and exists (
      select 1 from unnest(string_to_array(m.nombre,'/')) a(nombre)
      where public.directorio_normalizar(a.nombre)=public.directorio_normalizar(p_ciudad)
    )
  order by m.codigo_municipal limit 1;
  if not found then raise exception 'municipio_codigo_postal_no_coinciden' using errcode='23514'; end if;

  if coalesce(p_tipo_negocio,'taller') not in ('taller','concesionario','concesionario-oficial','compraventa') then
    raise exception 'tipo_negocio_no_valido' using errcode='23514';
  end if;
  if p_horarios is not null and jsonb_typeof(p_horarios)<>'object' then raise exception 'horarios_no_validos' using errcode='23514'; end if;

  update public.talleres set
    nombre=trim(p_nombre), telefono=nullif(trim(coalesce(p_telefono,'')),''), web=nullif(trim(coalesce(p_web,'')),''),
    direccion=nullif(trim(coalesce(p_direccion,'')),''), codigo_postal=trim(p_codigo_postal), ciudad=v_municipio.nombre,
    provincia=trim(p_provincia), descripcion=nullif(p_descripcion,''), servicios=coalesce(p_servicios,'{}'::text[]), horarios=p_horarios,
    cerrado_temporalmente=coalesce(p_cerrado_temporalmente,false),
    motivo_cierre_temporal=case when coalesce(p_cerrado_temporalmente,false) then nullif(trim(coalesce(p_motivo_cierre_temporal,'')),'') else null end,
    fecha_reapertura_prevista=case when coalesce(p_cerrado_temporalmente,false) then p_fecha_reapertura_prevista else null end,
    tipo_negocio=coalesce(nullif(trim(coalesce(p_tipo_negocio,'')),''),'taller'), servicio_oficial=coalesce(p_servicio_oficial,false),
    marcas_servicio_oficial=case when coalesce(p_servicio_oficial,false) then nullif(trim(coalesce(p_marcas_servicio_oficial,'')),'') else null end
  where id=p_taller_id;
  if not found then raise exception 'taller_no_encontrado' using errcode='P0002'; end if;
  return true;
end;
$$;

revoke all on function public.admin_actualizar_taller_editor_v4(uuid,text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) from public;
grant execute on function public.admin_actualizar_taller_editor_v4(uuid,text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) to authenticated;

commit;
