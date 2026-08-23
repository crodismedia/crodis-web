create or replace function public.buscar_talleres_municipio(
  p_codigo_municipal text,
  p_servicio text default ''::text,
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
  with objetivo as materialized (
    select
      m.codigo_municipal,
      left(m.codigo_municipal, 2) as codigo_provincia,
      m.nombre
    from public.municipios m
    where m.activo = true
      and m.codigo_municipal = p_codigo_municipal
  ),
  formas as materialized (
    select public.directorio_normalizar(o.nombre) as municipio_normalizado
    from objetivo o

    union

    select public.directorio_normalizar(parte.nombre)
    from objetivo o
    cross join lateral unnest(string_to_array(o.nombre, '/')) as parte(nombre)

    union

    select a.alias_normalizado
    from public.municipio_aliases a
    join objetivo o
      on o.codigo_municipal = a.codigo_municipal
  ),
  filtrados as (
    select t.*
    from objetivo o
    join formas f
      on nullif(f.municipio_normalizado, '') is not null
    join public.talleres t
      on t.activo = true
     and t.directorio_provincia_cod = o.codigo_provincia
     and t.directorio_ciudad_norm = f.municipio_normalizado
    where nullif(btrim(coalesce(p_servicio, '')), '') is null
       or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
  ),
  contados as (
    select f.*, count(*) over () as total_resultados
    from filtrados f
  )
  select
    c.id,
    c.slug,
    c.nombre,
    c.telefono,
    c.web,
    c.direccion,
    c.codigo_postal,
    c.ciudad,
    c.provincia,
    c.descripcion,
    c.verificado,
    coalesce(c.servicios, '{}'::text[]),
    coalesce(c.fotos, '{}'::text[]),
    c.horarios,
    c.updated_at,
    c.total_resultados
  from contados c
  order by public.directorio_normalizar(c.nombre), c.id
  offset greatest(coalesce(p_desde, 0), 0)
  limit least(greatest(coalesce(p_limite, 30), 1), 100);
$function$;
