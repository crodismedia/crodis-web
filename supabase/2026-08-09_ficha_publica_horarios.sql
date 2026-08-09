-- TallerMap: asegurar que la ficha pública devuelve los horarios guardados.
-- Ejecutar este archivo COMPLETO en Supabase > SQL Editor.
-- Fecha: 2026-08-09

begin;

-- Eliminar cualquier versión anterior de obtener_taller_publico para fijar
-- una única firma y un conjunto estable de campos públicos.
do $$
declare
    v_funcion record;
begin
    for v_funcion in
        select p.oid::regprocedure::text as firma
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'obtener_taller_publico'
    loop
        execute format('drop function %s', v_funcion.firma);
    end loop;
end;
$$;

create function public.obtener_taller_publico(
    p_id uuid default null,
    p_slug text default null
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
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        t.id,
        t.slug,
        t.nombre,
        t.telefono,
        t.web,
        t.direccion,
        t.codigo_postal,
        t.ciudad,
        t.provincia,
        t.descripcion,
        coalesce(t.verificado, false) as verificado,
        coalesce(t.servicios, '{}'::text[]) as servicios,
        coalesce(t.fotos, '{}'::text[]) as fotos,
        t.horarios,
        t.updated_at
    from public.talleres t
    where t.activo = true
      and (
          (p_id is not null and t.id = p_id)
          or (
              nullif(btrim(coalesce(p_slug, '')), '') is not null
              and t.slug = btrim(p_slug)
          )
      )
    order by
        case when p_id is not null and t.id = p_id then 0 else 1 end,
        t.updated_at desc nulls last,
        t.id
    limit 1;
$$;

revoke all on function public.obtener_taller_publico(uuid, text)
from public;

grant execute on function public.obtener_taller_publico(uuid, text)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- COMPROBACIÓN OPCIONAL:
-- Sustituye el slug por el de una ficha real:
-- select id, nombre, slug, horarios
-- from public.obtener_taller_publico(null, 'slug-de-la-ficha');
-- La columna horarios debe devolver el JSON semanal guardado en public.talleres.
