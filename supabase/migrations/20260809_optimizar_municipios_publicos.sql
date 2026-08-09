-- TallerMap: acelera los listados municipales sin cambiar su contrato público.
-- Aprovecha el índice territorial existente evitando subconsultas correlacionadas.

begin;

create or replace function public.listar_municipios_publicos(p_provincia text)
returns table (
    codigo_municipal text,
    municipio text,
    total_talleres bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with parametros as (
        select public.directorio_codigo_provincia(p_provincia) as codigo
    ),
    catalogo_aliases as materialized (
        select distinct
            m.codigo_municipal,
            m.nombre,
            p.codigo as codigo_provincia,
            public.directorio_normalizar(alias.nombre) as municipio_normalizado
        from public.municipios m
        cross join parametros p
        cross join lateral unnest(string_to_array(m.nombre, '/')) as alias(nombre)
        where m.activo = true
          and left(m.codigo_municipal, 2) = p.codigo
    )
    select
        c.codigo_municipal,
        c.nombre as municipio,
        count(distinct t.id) as total_talleres
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

create or replace function public.buscar_talleres_municipio(
    p_codigo_municipal text,
    p_servicio text default '',
    p_desde integer default 0,
    p_limite integer default 30
)
returns table (
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
security definer
set search_path = public, pg_temp
as $$
    with municipio_aliases as materialized (
        select distinct
            left(m.codigo_municipal, 2) as codigo_provincia,
            public.directorio_normalizar(alias.nombre) as municipio_normalizado
        from public.municipios m
        cross join lateral unnest(string_to_array(m.nombre, '/')) as alias(nombre)
        where m.activo = true
          and m.codigo_municipal = p_codigo_municipal
    ),
    filtrados as (
        select t.*
        from municipio_aliases m
        join public.talleres t
          on t.activo = true
         and coalesce(
                nullif(left(t.codigo_postal, 2), ''),
                public.directorio_codigo_provincia(t.provincia)
             ) = m.codigo_provincia
         and public.directorio_normalizar(t.ciudad) = m.municipio_normalizado
        where nullif(btrim(coalesce(p_servicio, '')), '') is null
           or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
    ),
    contados as (
        select f.*, count(*) over () as total_resultados
        from filtrados f
    )
    select
        c.id, c.slug, c.nombre, c.telefono, c.web, c.direccion,
        c.codigo_postal, c.ciudad, c.provincia, c.descripcion,
        c.verificado, coalesce(c.servicios, '{}'::text[]),
        coalesce(c.fotos, '{}'::text[]), c.horarios, c.updated_at,
        c.total_resultados
    from contados c
    order by public.directorio_normalizar(c.nombre), c.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

revoke all on function public.listar_municipios_publicos(text) from public;
revoke all on function public.buscar_talleres_municipio(text, text, integer, integer)
    from public;

grant execute on function public.listar_municipios_publicos(text)
    to anon, authenticated;
grant execute on function public.buscar_talleres_municipio(text, text, integer, integer)
    to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales después de ejecutar:
-- select count(*) from public.listar_municipios_publicos('Alicante/Alacant');
-- select count(*) from public.listar_municipios_publicos('Valencia/València');
-- select count(*) from public.buscar_talleres_municipio('46250', '', 0, 30);
