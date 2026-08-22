-- TallerMap · 2026-08-22
-- Endurecimiento de solicitudes de piezas, tablas internas y RPC administrativas.
-- Estos cambios ya fueron aplicados en producción en Supabase y se registran
-- aquí para mantener el esquema reproducible y versionado junto al código.

-- 1) Tablas que no deben quedar accesibles directamente desde el cliente.
alter table public.fichas_desguaces enable row level security;
alter table public.solicitudes_piezas enable row level security;
alter table public.registro_tratos_desguaces enable row level security;
alter table public.cola_horarios_google enable row level security;

revoke all on table public.fichas_desguaces from anon, authenticated;
revoke all on table public.solicitudes_piezas from anon, authenticated;
revoke all on table public.registro_tratos_desguaces from anon, authenticated;
revoke all on table public.cola_horarios_google from anon, authenticated;

-- 2) Las RPC administrativas siguen disponibles para usuarios autenticados,
-- pero dejan de heredarse por PUBLIC/anon. Cada función mantiene además su
-- comprobación interna public.es_administrador().
revoke execute on function public.admin_cambiar_estado_desguace_usuario(uuid, text, text) from public, anon;
revoke execute on function public.admin_listar_desguace_usuarios() from public, anon;
revoke execute on function public.admin_ranking_interacciones(integer, integer) from public, anon;
revoke execute on function public.admin_resumen_interacciones(integer) from public, anon;

-- 3) Fijar search_path de la función pública de municipios.
alter function public.listar_municipios_publicos(text)
  set search_path = public, pg_temp;
