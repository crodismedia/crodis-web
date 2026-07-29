-- TallerMap: cierre de datos privados y funciones reproducibles.
-- Ejecutar COMPLETO y como último paso en Supabase > SQL Editor.
--
-- Objetivos:
--   1. Impedir que visitantes consulten directamente public.talleres.
--   2. Exponer únicamente campos públicos mediante RPC.
--   3. Versionar la búsqueda por distancia que utiliza la portada.
--   4. Versionar el guardado de coordenadas utilizado por el administrador.

begin;

-- La política anterior permitía leer todas las columnas de una ficha activa,
-- incluidas propietario, CIF y correo. El acceso público se realiza desde ahora
-- exclusivamente mediante las funciones de campos limitados de este archivo.
drop policy if exists "publico consulta talleres activos" on public.talleres;
revoke select on table public.talleres from anon;

-- Los usuarios autenticados solo obtienen filas si son administradores, gracias
-- a la política "administradores consultan todos los talleres" ya instalada.
grant select on table public.talleres to authenticated;

-- Elimina cualquier versión anterior para poder fijar también el tipo devuelto.
do $$
declare
    v_funcion record;
begin
    for v_funcion in
        select p.oid::regprocedure::text as firma
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'buscar_talleres_publicos',
              'buscar_talleres_cercanos',
              'admin_guardar_ubicacion_taller'
          )
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
    order by c.created_at desc nulls last, c.id
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
    order by d.distancia_km, d.nombre
    limit least(greatest(coalesce(p_limite, 50), 1), 100);
$$;

revoke all on function public.buscar_talleres_cercanos(
    double precision, double precision, double precision, text, integer
) from public;
grant execute on function public.buscar_talleres_cercanos(
    double precision, double precision, double precision, text, integer
) to anon, authenticated;

create function public.admin_guardar_ubicacion_taller(
    p_taller_id uuid,
    p_latitud double precision,
    p_longitud double precision
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_id uuid;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;
    if p_latitud is null or p_latitud not between -90 and 90
       or p_longitud is null or p_longitud not between -180 and 180 then
        raise exception 'coordenadas_no_validas' using errcode = '23514';
    end if;

    update public.talleres
    set latitud = p_latitud,
        longitud = p_longitud,
        updated_at = now()
    where id = p_taller_id
    returning id into v_id;

    if v_id is null then
        raise exception 'Taller no encontrado' using errcode = 'P0002';
    end if;

    return v_id;
end;
$$;

revoke all on function public.admin_guardar_ubicacion_taller(
    uuid, double precision, double precision
) from public, anon;
grant execute on function public.admin_guardar_ubicacion_taller(
    uuid, double precision, double precision
) to authenticated;

commit;
