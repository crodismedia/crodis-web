create or replace function public.obtener_contexto_taller(
  p_id uuid default null::uuid,
  p_slug text default null::text
)
returns table(
  taller_id uuid,
  codigo_municipal text,
  municipio text,
  total_municipio bigint,
  provincia_slug text
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
with actual as (
  select
    t.id,
    t.ciudad,
    t.provincia,
    t.directorio_ciudad_norm,
    t.directorio_provincia_cod
  from public.talleres t
  where t.activo = true
    and (
      (p_id is not null and t.id = p_id)
      or
      (p_slug is not null and t.slug = p_slug)
    )
  order by
    case
      when p_id is not null and t.id = p_id then 0
      else 1
    end
  limit 1
)
select
  a.id as taller_id,
  me.codigo_municipal,
  coalesce(me.municipio, a.ciudad) as municipio,
  coalesce(
    nullif(
      (
        select count(*)::bigint
        from public.talleres x
        where x.activo = true
          and x.directorio_provincia_cod = left(me.codigo_municipal, 2)
          and x.directorio_ciudad_norm in (
            select public.directorio_normalizar(m.nombre)
            from public.municipios m
            where m.activo = true
              and m.codigo_municipal = me.codigo_municipal

            union

            select public.directorio_normalizar(parte.nombre)
            from public.municipios m
            cross join lateral unnest(string_to_array(m.nombre, '/')) as parte(nombre)
            where m.activo = true
              and m.codigo_municipal = me.codigo_municipal

            union

            select ma.alias_normalizado
            from public.municipio_aliases ma
            join public.municipios m
              on m.codigo_municipal = ma.codigo_municipal
             and m.activo = true
            where ma.codigo_municipal = me.codigo_municipal
          )
      ),
      0
    ),
    (
      select count(*)::bigint
      from public.talleres x
      where x.activo = true
        and x.directorio_provincia_cod = a.directorio_provincia_cod
        and x.directorio_ciudad_norm = a.directorio_ciudad_norm
    )
  ) as total_municipio,
  case a.directorio_provincia_cod
    when '03' then 'alicante'
    when '12' then 'castellon'
    when '46' then 'valencia'
    else public.directorio_slug(a.provincia)
  end as provincia_slug
from actual a
left join lateral (
  select z.codigo_municipal, z.municipio
  from (
    select
      m.codigo_municipal,
      m.nombre as municipio,
      1 as prioridad
    from public.municipios m
    where m.activo = true
      and m.codigo_provincia = a.directorio_provincia_cod
      and m.directorio_nombre_norm = a.directorio_ciudad_norm

    union all

    select
      m.codigo_municipal,
      m.nombre as municipio,
      2 as prioridad
    from public.municipios m
    where m.activo = true
      and m.codigo_provincia = a.directorio_provincia_cod
      and m.nombre like '%/%'
      and exists (
        select 1
        from unnest(string_to_array(m.nombre, '/')) as parte(nombre)
        where public.directorio_normalizar(parte.nombre) = a.directorio_ciudad_norm
      )

    union all

    select
      m.codigo_municipal,
      m.nombre as municipio,
      3 as prioridad
    from public.municipio_aliases ma
    join public.municipios m
      on m.codigo_municipal = ma.codigo_municipal
     and m.activo = true
    where ma.codigo_provincia = a.directorio_provincia_cod
      and ma.alias_normalizado = a.directorio_ciudad_norm
  ) z
  order by z.prioridad, z.codigo_municipal
  limit 1
) me on true;
$function$;
