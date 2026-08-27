create or replace function public.listar_cambios_talleres_estaticos(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns table (
  slug text,
  operacion text,
  cambiado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  select x.slug, x.operacion, x.cambiado_en
  from (
    select distinct on (l.slug)
      l.slug,
      l.operacion,
      l.cambiado_en,
      l.id
    from public.talleres_static_change_log l
    where l.cambiado_en > coalesce(p_desde, '1970-01-01 00:00:00+00'::timestamptz)
      and l.cambiado_en <= coalesce(p_hasta, now())
    order by l.slug, l.cambiado_en desc, l.id desc
  ) x
  order by x.cambiado_en asc, x.slug asc;
$function$;
