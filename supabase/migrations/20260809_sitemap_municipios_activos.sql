-- TallerMap: expone solo municipios que tienen al menos un taller activo.

begin;

create or replace function public.listar_municipios_sitemap()
returns table (
    codigo_municipal text,
    municipio text,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with catalogo_aliases as materialized (
        select distinct
            m.codigo_municipal,
            m.nombre,
            left(m.codigo_municipal, 2) as codigo_provincia,
            public.directorio_normalizar(alias.nombre) as municipio_normalizado
        from public.municipios m
        cross join lateral unnest(string_to_array(m.nombre, '/')) as alias(nombre)
        where m.activo = true

        union

        select
            m.codigo_municipal,
            m.nombre,
            a.codigo_provincia,
            a.alias_normalizado
        from public.municipio_aliases a
        join public.municipios m
          on m.codigo_municipal = a.codigo_municipal
         and m.activo = true
    )
    select
        c.codigo_municipal,
        c.nombre as municipio,
        max(t.updated_at) as updated_at
    from catalogo_aliases c
    join public.talleres t
      on t.activo = true
     and coalesce(
            nullif(left(t.codigo_postal, 2), ''),
            public.directorio_codigo_provincia(t.provincia)
         ) = c.codigo_provincia
     and public.directorio_normalizar(t.ciudad) = c.municipio_normalizado
    group by c.codigo_municipal, c.nombre
    having count(distinct t.id) > 0
    order by public.directorio_normalizar(c.nombre), c.codigo_municipal;
$$;

revoke all on function public.listar_municipios_sitemap() from public;
grant execute on function public.listar_municipios_sitemap()
    to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobación opcional: debe devolver actualmente 336 filas.
-- select count(*) from public.listar_municipios_sitemap();
