-- TallerMap: contadores públicos basados en datos reales de talleres activos.
-- Ejecuta este archivo una vez en Supabase > SQL Editor si el proyecto ya existe.

begin;

create or replace function public.estadisticas_publicas()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'talleres_activos', count(*),
        'provincias_disponibles', count(distinct nullif(trim(t.provincia), '')),
        'servicios_disponibles', (
            select count(distinct s.servicio)
            from public.talleres ts
            cross join lateral unnest(coalesce(ts.servicios, '{}'::text[])) as s(servicio)
            where ts.activo = true
              and nullif(trim(s.servicio), '') is not null
        )
    )
    from public.talleres t
    where t.activo = true;
$$;

revoke all on function public.estadisticas_publicas() from public;
grant execute on function public.estadisticas_publicas() to anon, authenticated;

commit;

