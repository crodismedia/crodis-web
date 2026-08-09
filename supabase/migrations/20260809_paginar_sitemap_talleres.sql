-- TallerMap: pagina el sitemap con parámetros explícitos.
-- PostgREST limita cada respuesta a 1.000 filas e ignora Range en esta RPC.

begin;

drop function if exists public.listar_talleres_sitemap();

create function public.listar_talleres_sitemap(
    p_limite integer default 1000,
    p_desde integer default 0
)
returns table (
    slug text,
    updated_at timestamptz,
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        t.slug,
        t.updated_at,
        count(*) over () as total_resultados
    from public.talleres t
    where t.activo = true
      and nullif(btrim(t.slug), '') is not null
      and nullif(btrim(t.nombre), '') is not null
      and nullif(btrim(t.ciudad), '') is not null
    order by t.updated_at desc nulls last, t.slug
    limit greatest(1, least(coalesce(p_limite, 1000), 1000))
    offset greatest(coalesce(p_desde, 0), 0);
$$;

revoke all on function public.listar_talleres_sitemap(integer, integer)
    from public;
grant execute on function public.listar_talleres_sitemap(integer, integer)
    to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales después de ejecutar:
-- select count(*) from public.listar_talleres_sitemap(1000, 0);
-- select count(*) from public.listar_talleres_sitemap(1000, 1000);
-- select * from public.listar_talleres_sitemap(1, 0);
