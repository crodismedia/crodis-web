-- TallerMap: corrige el filtro global por servicio.
--
-- La migracion 20260807_normalizar_busqueda_talleres.sql consultaba por error
-- public.taller_servicios (singular). Las relaciones reales se almacenan en
-- public.talleres_servicios (plural), por lo que URLs como
-- ?servicio=neumaticos devolvian cero resultados.

begin;

create or replace function public.buscar_talleres_profesional(
    p_ubicacion text default null,
    p_servicio text default null,
    p_limite integer default 20,
    p_desde integer default 0
)
returns table(
    id uuid,
    nombre text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    telefono text,
    slug text,
    verificado boolean,
    coincidencia integer,
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
    with parametros as (
        select public.normalizar_busqueda(p_ubicacion) as ubicacion,
               public.normalizar_busqueda(p_servicio) as servicio
    ),
    resultados as (
        select t.id,t.nombre,t.direccion,t.codigo_postal::text,t.ciudad,t.provincia,
               t.telefono,t.slug,coalesce(t.verificado,false) as verificado,
               (
                 case when public.normalizar_busqueda(t.codigo_postal::text)=(select ubicacion from parametros) then 100 else 0 end +
                 case when public.normalizar_busqueda(t.ciudad)=(select ubicacion from parametros) then 90 else 0 end +
                 case when public.normalizar_busqueda(t.provincia)=(select ubicacion from parametros) then 70 else 0 end +
                 case when public.normalizar_busqueda(t.nombre) like '%'||(select ubicacion from parametros)||'%' then 50 else 0 end +
                 case when public.normalizar_busqueda(t.direccion) like '%'||(select ubicacion from parametros)||'%' then 40 else 0 end +
                 case when coalesce(t.verificado,false) then 10 else 0 end
               )::integer as coincidencia
        from public.talleres t
        cross join parametros p
        where t.activo = true
          and (
            p.ubicacion=''
            or public.normalizar_busqueda(t.codigo_postal::text)=p.ubicacion
            or public.normalizar_busqueda(t.ciudad) like '%'||p.ubicacion||'%'
            or public.normalizar_busqueda(t.provincia) like '%'||p.ubicacion||'%'
            or public.normalizar_busqueda(t.nombre) like '%'||p.ubicacion||'%'
            or public.normalizar_busqueda(t.direccion) like '%'||p.ubicacion||'%'
          )
          and (
            p.servicio=''
            or exists (
                select 1
                from public.talleres_servicios ts
                join public.servicios s on s.id=ts.servicio_id
                where ts.taller_id=t.id
                  and coalesce(s.activo, true) = true
                  and (
                      public.normalizar_busqueda(s.nombre) like '%'||p.servicio||'%'
                      or public.normalizar_busqueda(s.slug) like '%'||p.servicio||'%'
                  )
            )
          )
    )
    select r.id,r.nombre,r.direccion,r.codigo_postal,r.ciudad,r.provincia,
           r.telefono,r.slug,r.verificado,r.coincidencia,count(*) over() as total_resultados
    from resultados r
    order by r.coincidencia desc,r.ciudad asc nulls last,r.nombre asc
    limit greatest(1,least(coalesce(p_limite,20),50))
    offset greatest(coalesce(p_desde,0),0);
$function$;

revoke all on function public.buscar_talleres_profesional(
    text, text, integer, integer
) from public;

grant execute on function public.buscar_talleres_profesional(
    text, text, integer, integer
) to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobacion manual tras aplicar la migracion:
-- select nombre, ciudad, total_resultados
-- from public.buscar_talleres_profesional('', 'neumaticos', 5, 0);
