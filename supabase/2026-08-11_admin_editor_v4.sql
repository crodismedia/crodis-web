begin;

alter table public.talleres
  add column if not exists cerrado_temporalmente boolean not null default false,
  add column if not exists motivo_cierre_temporal text,
  add column if not exists fecha_reapertura_prevista date,
  add column if not exists tipo_negocio text not null default 'taller',
  add column if not exists servicio_oficial boolean not null default false,
  add column if not exists marcas_servicio_oficial text;

alter table public.talleres
  drop constraint if exists talleres_tipo_negocio_valido;

alter table public.talleres
  add constraint talleres_tipo_negocio_valido
  check (tipo_negocio in ('taller','concesionario','concesionario-oficial','compraventa'));

alter table public.talleres
  drop constraint if exists talleres_cierre_temporal_coherente;

alter table public.talleres
  add constraint talleres_cierre_temporal_coherente
  check (
    cerrado_temporalmente = true
    or (motivo_cierre_temporal is null and fecha_reapertura_prevista is null)
  );

alter table public.talleres
  drop constraint if exists talleres_servicio_oficial_coherente;

alter table public.talleres
  add constraint talleres_servicio_oficial_coherente
  check (servicio_oficial = true or marcas_servicio_oficial is null);

create or replace function public.admin_actualizar_taller_editor_v4(
  p_taller_id uuid,
  p_nombre text,
  p_telefono text,
  p_web text,
  p_direccion text,
  p_codigo_postal text,
  p_ciudad text,
  p_provincia text,
  p_descripcion text,
  p_servicios text[],
  p_horarios jsonb,
  p_cerrado_temporalmente boolean,
  p_motivo_cierre_temporal text,
  p_fecha_reapertura_prevista date,
  p_tipo_negocio text,
  p_servicio_oficial boolean,
  p_marcas_servicio_oficial text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_administrador() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if p_taller_id is null then
    raise exception 'Falta p_taller_id' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_nombre,''))) < 2 then
    raise exception 'nombre_no_valido' using errcode = '23514';
  end if;

  if p_codigo_postal is not null and p_codigo_postal !~ '^\d{5}$' then
    raise exception 'codigo_postal_no_valido' using errcode = '23514';
  end if;

  if coalesce(p_tipo_negocio,'taller') not in ('taller','concesionario','concesionario-oficial','compraventa') then
    raise exception 'tipo_negocio_no_valido' using errcode = '23514';
  end if;

  update public.talleres
  set
    nombre = trim(p_nombre),
    telefono = nullif(trim(coalesce(p_telefono,'')),''),
    web = nullif(trim(coalesce(p_web,'')),''),
    direccion = nullif(trim(coalesce(p_direccion,'')),''),
    codigo_postal = nullif(trim(coalesce(p_codigo_postal,'')),''),
    ciudad = nullif(trim(coalesce(p_ciudad,'')),''),
    provincia = nullif(trim(coalesce(p_provincia,'')),''),
    descripcion = nullif(p_descripcion,''),
    servicios = coalesce(p_servicios,'{}'::text[]),
    horarios = p_horarios,
    cerrado_temporalmente = coalesce(p_cerrado_temporalmente,false),
    motivo_cierre_temporal = case when coalesce(p_cerrado_temporalmente,false) then nullif(trim(coalesce(p_motivo_cierre_temporal,'')),'') else null end,
    fecha_reapertura_prevista = case when coalesce(p_cerrado_temporalmente,false) then p_fecha_reapertura_prevista else null end,
    tipo_negocio = coalesce(nullif(trim(coalesce(p_tipo_negocio,'')),''),'taller'),
    servicio_oficial = coalesce(p_servicio_oficial,false),
    marcas_servicio_oficial = case when coalesce(p_servicio_oficial,false) then nullif(trim(coalesce(p_marcas_servicio_oficial,'')),'') else null end
  where id = p_taller_id;

  if not found then
    raise exception 'taller_no_encontrado' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_actualizar_taller_editor_v4(uuid,text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) from public;
grant execute on function public.admin_actualizar_taller_editor_v4(uuid,text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) to authenticated;

commit;
