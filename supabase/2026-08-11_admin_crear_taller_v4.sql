begin;

create or replace function public.admin_crear_taller_editor_v4(
  p_nombre text,p_telefono text,p_web text,p_direccion text,p_codigo_postal text,
  p_ciudad text,p_provincia text,p_descripcion text,p_servicios text[],p_horarios jsonb,
  p_cerrado_temporalmente boolean,p_motivo_cierre_temporal text,p_fecha_reapertura_prevista date,
  p_tipo_negocio text,p_servicio_oficial boolean,p_marcas_servicio_oficial text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo_provincia text;
  v_municipio public.municipios%rowtype;
  v_taller_id uuid;
begin
  if not public.es_administrador() then raise exception 'No autorizado' using errcode='42501'; end if;
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
  if exists (
    select 1 from public.talleres t
    where t.activo=true
      and public.directorio_normalizar(t.nombre)=public.directorio_normalizar(p_nombre)
      and public.directorio_normalizar(coalesce(t.direccion,''))=public.directorio_normalizar(coalesce(p_direccion,''))
      and public.directorio_normalizar(t.ciudad)=public.directorio_normalizar(v_municipio.nombre)
  ) then raise exception 'duplicado_nombre_direccion' using errcode='23505'; end if;

  insert into public.talleres (
    nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,pais,descripcion,servicios,horarios,
    cerrado_temporalmente,motivo_cierre_temporal,fecha_reapertura_prevista,tipo_negocio,
    servicio_oficial,marcas_servicio_oficial,estado,activo,updated_at
  ) values (
    trim(p_nombre),nullif(trim(coalesce(p_telefono,'')),''),nullif(trim(coalesce(p_web,'')),''),
    nullif(trim(coalesce(p_direccion,'')),''),trim(p_codigo_postal),v_municipio.nombre,trim(p_provincia),'España',
    nullif(p_descripcion,''),coalesce(p_servicios,'{}'::text[]),p_horarios,
    coalesce(p_cerrado_temporalmente,false),
    case when coalesce(p_cerrado_temporalmente,false) then nullif(trim(coalesce(p_motivo_cierre_temporal,'')),'') else null end,
    case when coalesce(p_cerrado_temporalmente,false) then p_fecha_reapertura_prevista else null end,
    coalesce(nullif(trim(coalesce(p_tipo_negocio,'')),''),'taller'),coalesce(p_servicio_oficial,false),
    case when coalesce(p_servicio_oficial,false) then nullif(trim(coalesce(p_marcas_servicio_oficial,'')),'') else null end,
    'publicado',true,now()
  ) returning id into v_taller_id;

  insert into public.talleres_servicios (taller_id,servicio_id,confirmado)
  select v_taller_id,s.id,true
  from unnest(coalesce(p_servicios,'{}'::text[])) solicitado(slug)
  join public.servicios s on s.slug=solicitado.slug and coalesce(s.activo,true)=true
  on conflict (taller_id,servicio_id) do update set confirmado=excluded.confirmado;

  return v_taller_id;
end;
$$;

revoke all on function public.admin_crear_taller_editor_v4(text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_crear_taller_editor_v4(text,text,text,text,text,text,text,text,text[],jsonb,boolean,text,date,text,boolean,text) to authenticated;

commit;
