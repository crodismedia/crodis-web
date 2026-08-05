-- TallerMap: conecta el buscador público con el catálogo normalizado de servicios.
-- Ejecutar completo en Supabase > SQL Editor.
-- Mantiene compatibilidad con el array antiguo talleres.servicios.

begin;

create or replace function public.buscar_talleres_publicos(
    p_poblacion text default '',
    p_servicio text default '',
    p_desde integer default 0,
    p_limite integer default 30
)
returns table (
    id uuid,
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
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with parametros as (
        select
            public.normalizar_busqueda_publica(p_poblacion) as ubicacion,
            btrim(coalesce(p_servicio, '')) as servicio,
            greatest(coalesce(p_desde, 0), 0) as desde,
            least(greatest(coalesce(p_limite, 30), 1), 100) as limite
    ),
    filtrados as (
        select
            t.id,
            t.nombre,
            t.telefono,
            t.web,
            t.direccion,
            t.codigo_postal,
            t.ciudad,
            t.provincia,
            t.descripcion,
            t.verificado,
            coalesce(
                array(
                    select distinct s.slug
                    from public.talleres_servicios ts
                    join public.servicios s on s.id = ts.servicio_id
                    where ts.taller_id = t.id
                      and coalesce(s.activo, true) = true
                    order by s.slug
                ),
                '{}'::text[]
            ) as servicios_normalizados,
            coalesce(t.servicios, '{}'::text[]) as servicios_antiguos,
            coalesce(t.fotos, '{}'::text[]) as fotos,
            t.horarios,
            t.created_at
        from public.talleres t
        cross join parametros p
        where t.activo = true
          and (
              p.ubicacion = ''
              or public.normalizar_busqueda_publica(t.ciudad) like '%' || p.ubicacion || '%'
              or public.normalizar_busqueda_publica(t.provincia) like '%' || p.ubicacion || '%'
              or public.normalizar_busqueda_publica(t.codigo_postal) like '%' || p.ubicacion || '%'
              or public.normalizar_busqueda_publica(t.nombre) like '%' || p.ubicacion || '%'
              or public.normalizar_busqueda_publica(t.direccion) like '%' || p.ubicacion || '%'
          )
          and (
              p.servicio = ''
              or exists (
                  select 1
                  from public.talleres_servicios tsf
                  join public.servicios sf on sf.id = tsf.servicio_id
                  where tsf.taller_id = t.id
                    and sf.slug = p.servicio
                    and coalesce(sf.activo, true) = true
              )
              or p.servicio = any(coalesce(t.servicios, '{}'::text[]))
          )
    ),
    contados as (
        select
            f.*,
            count(*) over () as total_resultados
        from filtrados f
    )
    select
        c.id,
        c.nombre,
        c.telefono,
        c.web,
        c.direccion,
        c.codigo_postal,
        c.ciudad,
        c.provincia,
        c.descripcion,
        c.verificado,
        case
            when cardinality(c.servicios_normalizados) > 0
                then c.servicios_normalizados
            else c.servicios_antiguos
        end as servicios,
        c.fotos,
        c.horarios,
        c.total_resultados
    from contados c
    cross join parametros p
    order by
        case
            when public.normalizar_busqueda_publica(c.codigo_postal) = p.ubicacion then 0
            when public.normalizar_busqueda_publica(c.ciudad) = p.ubicacion then 1
            when public.normalizar_busqueda_publica(c.provincia) = p.ubicacion then 2
            else 3
        end,
        c.verificado desc nulls last,
        c.created_at desc nulls last,
        c.nombre,
        c.id
    offset (select desde from parametros)
    limit (select limite from parametros);
$$;

revoke all on function public.buscar_talleres_publicos(text, text, integer, integer) from public;
grant execute on function public.buscar_talleres_publicos(text, text, integer, integer)
to anon, authenticated;

commit;

select id, nombre, ciudad, provincia, servicios, total_resultados
from public.buscar_talleres_publicos('', 'mecanica-general', 0, 5);
