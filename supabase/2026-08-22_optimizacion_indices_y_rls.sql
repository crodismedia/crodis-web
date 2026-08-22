-- TallerMap · 2026-08-22
-- Optimización conservadora de índices relacionales y políticas RLS.
-- Cambios ya aplicados en producción en Supabase.

-- Índices de soporte para claves foráneas.
create index if not exists desguace_usuarios_aprobado_por_idx on public.desguace_usuarios (aprobado_por);
create index if not exists desguace_usuarios_user_id_idx on public.desguace_usuarios (user_id);
create index if not exists favoritos_taller_id_idx on public.favoritos (taller_id);
create index if not exists municipio_aliases_codigo_municipal_idx on public.municipio_aliases (codigo_municipal);
create index if not exists reclamaciones_taller_reviewed_by_idx on public.reclamaciones_taller (reviewed_by);
create index if not exists reclamaciones_taller_revoked_by_idx on public.reclamaciones_taller (revoked_by);
create index if not exists solicitudes_piezas_ficha_desguace_id_idx on public.solicitudes_piezas (ficha_desguace_id);
create index if not exists taller_marcas_marca_id_idx on public.taller_marcas (marca_id);
create index if not exists talleres_duplicados_revision_taller_id_2_idx on public.talleres_duplicados_revision (taller_id_2);

-- Índices redundantes: la unicidad ya está cubierta por una constraint/PK.
drop index if exists public.municipios_codigo_municipal_uidx;
drop index if exists public.talleres_servicios_unico;

-- Evitar reevaluar auth.uid()/auth.jwt() por cada fila en RLS.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to public
using ((select auth.uid()) = id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to public
using ((select auth.uid()) = id);

drop policy if exists "administradores ven su propia asignacion" on public.administradores;
create policy "administradores ven su propia asignacion"
on public.administradores
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "propietarios ven sus asignaciones" on public.taller_propietarios;
create policy "propietarios ven sus asignaciones"
on public.taller_propietarios
for select
to authenticated
using ((usuario_id = (select auth.uid())) or public.es_administrador());

drop policy if exists "usuarios crean sus reclamaciones" on public.reclamaciones_taller;
create policy "usuarios crean sus reclamaciones"
on public.reclamaciones_taller
for insert
to authenticated
with check (
  usuario_id = (select auth.uid())
  and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  and estado = 'pendiente'
  and reviewed_at is null
  and reviewed_by is null
);

drop policy if exists "usuarios ven sus reclamaciones" on public.reclamaciones_taller;
create policy "usuarios ven sus reclamaciones"
on public.reclamaciones_taller
for select
to authenticated
using ((usuario_id = (select auth.uid())) or public.es_administrador());
