create or replace function public.listar_municipios_publicos(p_provincia text)
returns table(codigo_municipal text, municipio text, total_talleres bigint)
language sql
stable
set search_path to 'public','pg_temp'
as $function$
  with parametros as materialized (
    select public.directorio_codigo_provincia(p_provincia) as codigo
  ),
  catalogo as materialized (
    select
      m.codigo_municipal::text as codigo_municipal,
      m.nombre::text as nombre,
      p.codigo as codigo_provincia
    from public.municipios m
    cross join parametros p
    where m.activo = true
      and left(m.codigo_municipal, 2) = p.codigo
  ),
  formas as materialized (
    select
      c.codigo_municipal,
      c.nombre,
      c.codigo_provincia,
      public.directorio_normalizar(c.nombre) as municipio_normalizado
    from catalogo c

    union

    select
      c.codigo_municipal,
      c.nombre,
      c.codigo_provincia,
      public.directorio_normalizar(parte.nombre)
    from catalogo c
    cross join lateral unnest(string_to_array(c.nombre, '/')) as parte(nombre)

    union

    select
      c.codigo_municipal,
      c.nombre,
      c.codigo_provincia,
      a.alias_normalizado
    from catalogo c
    join public.municipio_aliases a
      on a.codigo_municipal = c.codigo_municipal
     and a.codigo_provincia = c.codigo_provincia
  )
  select
    f.codigo_municipal,
    f.nombre as municipio,
    count(distinct t.id)::bigint as total_talleres
  from formas f
  join public.talleres t
    on t.activo = true
   and t.directorio_provincia_cod = f.codigo_provincia
   and t.directorio_ciudad_norm = f.municipio_normalizado
  where nullif(f.municipio_normalizado, '') is not null
  group by f.codigo_municipal, f.nombre
  having count(distinct t.id) > 0
  order by public.directorio_normalizar(f.nombre), f.codigo_municipal;
$function$;
