-- TallerMap: priorizar talleres recién modificados/guardados en los listados públicos.
-- Ejecutar este archivo COMPLETO en Supabase > SQL Editor.
-- Fecha: 2026-08-09
--
-- Regla:
--   1. El taller con updated_at más reciente aparece primero.
--   2. Si se modifican varios, quedan 1.º, 2.º, 3.º según la última actualización.
--   3. En búsqueda por cercanía, updated_at manda y la distancia desempata.

begin;

-- Eliminamos únicamente las funciones públicas de listado que vamos a redefinir.
do $$
declare
    v_funcion record;
begin
    for v_funcion in
        select p.oid::regprocedure::text as firma
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('buscar_talleres_publicos', 'buscar_talleres_cercanos')
    loop
        execute format('drop function %s', v_funcion.firma);
    end loop;
end;
$$;

create function public.buscar_talleres_publicos(
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
    with filtrados as (
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
            t.updated_at,
            t.created_at
        from public.talleres t
        where t.activo = true
          and (
              nullif(btrim(coalesce(p_poblacion, '')), '') is null
              or exists (
                  select 1
                  from unnest(string_to_array(p_poblacion, '|')) as termino(valor)
                  where nullif(btrim(termino.valor), '') is not null
                    and (
                        strpos(lower(coalesce(t.nombre, '')), lower(btrim(termino.valor))) > 0
                        or strpos(lower(coalesce(t.ciudad, '')), lower(btrim(termino.valor))) > 0
                        or strpos(lower(coalesce(t.provincia, '')), lower(btrim(termino.valor))) > 0
                        or strpos(lower(coalesce(t.codigo_postal, '')), lower(btrim(termino.valor))) > 0
                    )
              )
          )
          and (
              nullif(btrim(coalesce(p_servicio, '')), '') is null
              or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
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
        coalesce(c.updated_at, c.created_at) desc nulls last,
        c.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

revoke all on function public.buscar_talleres_publicos(
    text, text, integer, integer
) from public;

grant execute on function public.buscar_talleres_publicos(
    text, text, integer, integer
) to anon, authenticated;

create function public.buscar_talleres_cercanos(
    p_latitud double precision,
    p_longitud double precision,
    p_radio_km double precision default 50,
    p_servicio text default null,
    p_limite integer default 50
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
    latitud double precision,
    longitud double precision,
    distancia_km double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with distancias as (
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
            t.latitud::double precision as latitud,
            t.longitud::double precision as longitud,
            t.updated_at,
            t.created_at,
            6371.0088 * acos(
                least(
                    1.0,
                    greatest(
                        -1.0,
                        sin(radians(p_latitud))
                            * sin(radians(t.latitud::double precision))
                        + cos(radians(p_latitud))
                            * cos(radians(t.latitud::double precision))
                            * cos(
                                radians(t.longitud::double precision)
                                - radians(p_longitud)
                            )
                    )
                )
            ) as distancia_km
        from public.talleres t
        where t.activo = true
          and t.latitud is not null
          and t.longitud is not null
          and p_latitud between -90 and 90
          and p_longitud between -180 and 180
          and (
              nullif(btrim(coalesce(p_servicio, '')), '') is null
              or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
          )
    )
    select
        d.id,
        d.nombre,
        d.telefono,
        d.web,
        d.direccion,
        d.codigo_postal,
        d.ciudad,
        d.provincia,
        d.descripcion,
        d.verificado,
        d.servicios,
        d.fotos,
        d.horarios,
        d.latitud,
        d.longitud,
        d.distancia_km
    from distancias d
    where d.distancia_km <= least(greatest(coalesce(p_radio_km, 50), 1), 200)
    order by
        coalesce(d.updated_at, d.created_at) desc nulls last,
        d.distancia_km,
        d.nombre
    limit least(greatest(coalesce(p_limite, 50), 1), 100);
$$;

revoke all on function public.buscar_talleres_cercanos(
    double precision, double precision, double precision, text, integer
) from public;

grant execute on function public.buscar_talleres_cercanos(
    double precision, double precision, double precision, text, integer
) to anon, authenticated;

-- Índice útil para ordenar rápidamente talleres activos por última actualización.
create index if not exists talleres_activo_updated_at_idx
on public.talleres (activo, updated_at desc);

notify pgrst, 'reload schema';

commit;

-- COMPROBACIÓN:
-- Los últimos talleres modificados deben aparecer arriba.
-- select id, nombre, ciudad, updated_at
-- from public.talleres
-- where activo = true
-- order by coalesce(updated_at, created_at) desc nulls last
-- limit 10;
