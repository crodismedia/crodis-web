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
set search_path to 'public', 'pg_temp'
as $function$
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
    nombre=trim(p_nombre),
    telefono=nullif(trim(coalesce(p_telefono,'')),''),
    web=nullif(trim(coalesce(p_web,'')),''),
    direccion=nullif(trim(coalesce(p_direccion,'')),''),
    codigo_postal=trim(p_codigo_postal),
    ciudad=v_municipio.nombre,
    provincia=trim(p_provincia),
    descripcion=nullif(p_descripcion,''),
    servicios=coalesce(p_servicios,'{}'::text[]),
    horarios=p_horarios,
    cerrado_temporalmente=coalesce(p_cerrado_temporalmente,false),
    motivo_cierre_temporal=case when coalesce(p_cerrado_temporalmente,false) then nullif(trim(coalesce(p_motivo_cierre_temporal,'')),'') else null end,
    fecha_reapertura_prevista=case when coalesce(p_cerrado_temporalmente,false) then p_fecha_reapertura_prevista else null end,
    tipo_negocio=coalesce(nullif(trim(coalesce(p_tipo_negocio,'')),''),'taller'),
    servicio_oficial=coalesce(p_servicio_oficial,false),
    marcas_servicio_oficial=case when coalesce(p_servicio_oficial,false) then nullif(trim(coalesce(p_marcas_servicio_oficial,'')),'') else null end,
    updated_at=now()
  where id=p_taller_id;
  if not found then raise exception 'taller_no_encontrado' using errcode='P0002'; end if;
  return true;
end;
$function$;
