-- TallerMap: búsqueda pública tolerante a acentos, mayúsculas y espacios.
-- Ejecutar completo en Supabase > SQL Editor.
-- No modifica ni elimina talleres.

begin;

create or replace function public.normalizar_busqueda_publica(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select regexp_replace(
        translate(
            lower(btrim(coalesce(valor, ''))),
            'áàäâãåéèëêíìïîóòöôõúùüûñç',
            'aaaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
    );
$$;

revoke all on function public.normalizar_busqueda_publica(text) from public;
grant execute on function public.normalizar_busqueda_publica(text) to anon, authenticated;

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
            btrim(coalesce(p_servicio, '')) as servicio
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
            coalesce(t.servicios, '{}'::text[]) as servicios,
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
              or p.servicio = any(coalesce(t.servicios, '{}'::text[]))
          )
    ),
    contados as (
        select f.*, count(*) over () as total_resultados
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
        c.servicios,
        c.fotos,
        c.horarios,
        c.total_resultados
    from contados c
    order by
        case
            when public.normalizar_busqueda_publica(c.codigo_postal) = public.normalizar_busqueda_publica(p_poblacion) then 0
            when public.normalizar_busqueda_publica(c.ciudad) = public.normalizar_busqueda_publica(p_poblacion) then 1
            when public.normalizar_busqueda_publica(c.provincia) = public.normalizar_busqueda_publica(p_poblacion) then 2
            else 3
        end,
        c.created_at desc nulls last,
        c.nombre,
        c.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

revoke all on function public.buscar_talleres_publicos(text, text, integer, integer) from public;
grant execute on function public.buscar_talleres_publicos(text, text, integer, integer)
to anon, authenticated;

commit;
