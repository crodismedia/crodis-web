create or replace function public.buscar_talleres_provincia(
  p_provincia text,
  p_desde integer default 0,
  p_limite integer default 30
)
returns table(
  id uuid,
  slug text,
  nombre text,
  telefono text,
  web text,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  descripcion text,
  verificado boolean,
  servicios text[],
  fotos text[],
  horarios jsonb,
  updated_at timestamptz,
  total_resultados bigint
)
language sql
stable
set search_path to 'public','pg_temp'
as $function$
  with parametros as materialized (
    select public.directorio_codigo_provincia(p_provincia) as codigo
  ),
  total as materialized (
    select count(*)::bigint as total_resultados
    from public.talleres t
    cross join parametros p
    where t.activo = true
      and p.codigo is not null
      and t.directorio_provincia_cod = p.codigo
  ),
  pagina as materialized (
    select
      t.id,
      t.slug,
      t.nombre,
      t.telefono,
      t.web,
      t.direccion,
      t.codigo_postal,
      t.ciudad,
      t.provincia,
      t.descripcion,
      t.verificado,
      t.servicios,
      t.fotos,
      t.horarios,
      t.updated_at
    from public.talleres t
    cross join parametros p
    where t.activo = true
      and p.codigo is not null
      and t.directorio_provincia_cod = p.codigo
    order by t.directorio_nombre_norm, t.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100)
  )
  select
    p.id,
    p.slug,
    p.nombre,
    p.telefono,
    p.web,
    p.direccion,
    p.codigo_postal,
    p.ciudad,
    p.provincia,
    p.descripcion,
    p.verificado,
    coalesce(p.servicios, '{}'::text[]),
    coalesce(p.fotos, '{}'::text[]),
    p.horarios,
    p.updated_at,
    t.total_resultados
  from pagina p
  cross join total t;
$function$;
