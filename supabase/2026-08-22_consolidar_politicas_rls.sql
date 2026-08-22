-- TallerMap · 2026-08-22
-- Consolidación conservadora de políticas RLS permisivas.
-- Mantiene la misma lógica de acceso reduciendo evaluaciones redundantes.
-- Cambios ya aplicados en producción en Supabase.

-- HORARIOS: SELECT ya es público; separar las escrituras del antiguo ALL.
drop policy if exists "Propietarios gestionan horarios" on public.horarios;
create policy "Propietarios insertan horarios" on public.horarios
for insert to authenticated
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = horarios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios actualizan horarios" on public.horarios
for update to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = horarios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
))
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = horarios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios eliminan horarios" on public.horarios
for delete to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = horarios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));

-- IMÁGENES: lectura pública de activas y lectura de inactivas para su propietario.
drop policy if exists "Imagenes visibles" on public.imagenes_taller;
drop policy if exists "Propietarios gestionan imagenes" on public.imagenes_taller;
create policy "Imagenes visibles anon" on public.imagenes_taller
for select to anon using (activo = true);
create policy "Imagenes visibles autenticados" on public.imagenes_taller
for select to authenticated
using (
  activo = true
  or exists (
    select 1 from public.taller_usuarios tu
    where tu.taller_id = imagenes_taller.taller_id
      and tu.usuario_id = (select auth.uid())
      and tu.activo = true
      and tu.rol = any (array['propietario'::text,'administrador'::text])
  )
);
create policy "Propietarios insertan imagenes" on public.imagenes_taller
for insert to authenticated
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = imagenes_taller.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios actualizan imagenes" on public.imagenes_taller
for update to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = imagenes_taller.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
))
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = imagenes_taller.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios eliminan imagenes" on public.imagenes_taller
for delete to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = imagenes_taller.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));

-- SOLICITUDES: unificar las dos vías de lectura autenticada con OR.
drop policy if exists "Talleres consultan solicitudes recibidas" on public.solicitudes;
drop policy if exists "Usuarios consultan sus solicitudes" on public.solicitudes;
create policy "Usuarios y talleres consultan solicitudes" on public.solicitudes
for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1 from public.taller_usuarios tu
    where tu.taller_id = solicitudes.taller_id
      and tu.usuario_id = (select auth.uid())
      and tu.activo = true
      and tu.rol = any (array['propietario'::text,'administrador'::text,'empleado'::text])
  )
);

-- MARCAS: SELECT ya es público; separar escrituras.
drop policy if exists "Propietarios gestionan marcas" on public.taller_marcas;
create policy "Propietarios insertan marcas" on public.taller_marcas
for insert to authenticated
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_marcas.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios actualizan marcas" on public.taller_marcas
for update to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_marcas.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
))
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_marcas.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios eliminan marcas" on public.taller_marcas
for delete to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_marcas.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));

-- SERVICIOS DE TALLER: SELECT ya es público; separar escrituras.
drop policy if exists "Propietarios gestionan servicios" on public.taller_servicios;
create policy "Propietarios insertan servicios" on public.taller_servicios
for insert to authenticated
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_servicios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios actualizan servicios" on public.taller_servicios
for update to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_servicios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
))
with check (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_servicios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));
create policy "Propietarios eliminan servicios" on public.taller_servicios
for delete to authenticated
using (exists (
  select 1 from public.taller_usuarios tu
  where tu.taller_id = taller_servicios.taller_id
    and tu.usuario_id = (select auth.uid())
    and tu.activo = true
    and tu.rol = any (array['propietario'::text,'administrador'::text])
));

-- TALLERES: unificar propietario/administrador manteniendo la misma lógica OR.
drop policy if exists "Propietarios eliminan taller" on public.talleres;
drop policy if exists "administradores eliminan talleres" on public.talleres;
create policy "Propietarios o administradores eliminan talleres" on public.talleres
for delete to authenticated
using (
  public.es_administrador()
  or exists (
    select 1 from public.taller_usuarios tu
    where tu.taller_id = talleres.id
      and tu.usuario_id = (select auth.uid())
      and tu.activo = true
      and tu.rol = 'propietario'
  )
);

drop policy if exists "Talleres activos visibles" on public.talleres;
drop policy if exists "administradores consultan todos los talleres" on public.talleres;
create policy "Talleres activos visibles anon" on public.talleres
for select to anon using (activo = true);
create policy "Talleres visibles autenticados" on public.talleres
for select to authenticated
using (activo = true or public.es_administrador());

drop policy if exists "Administradores pueden actualizar talleres" on public.talleres;
drop policy if exists "Propietarios actualizan taller" on public.talleres;
create policy "Propietarios o administradores actualizan talleres" on public.talleres
for update to authenticated
using (
  public.es_administrador()
  or exists (
    select 1 from public.taller_usuarios tu
    where tu.taller_id = talleres.id
      and tu.usuario_id = (select auth.uid())
      and tu.activo = true
      and tu.rol = any (array['propietario'::text,'administrador'::text])
  )
)
with check (
  public.es_administrador()
  or exists (
    select 1 from public.taller_usuarios tu
    where tu.taller_id = talleres.id
      and tu.usuario_id = (select auth.uid())
      and tu.activo = true
      and tu.rol = any (array['propietario'::text,'administrador'::text])
  )
);

-- VALORACIONES: lectura pública para anon; autenticados ven públicas o todo si son admin.
drop policy if exists "Valoraciones aprobadas visibles" on public.valoraciones;
drop policy if exists "valoraciones_select_admin" on public.valoraciones;
create policy "Valoraciones aprobadas visibles anon" on public.valoraciones
for select to anon
using (aprobada = true and activa = true);
create policy "Valoraciones visibles autenticados" on public.valoraciones
for select to authenticated
using ((aprobada = true and activa = true) or public.es_administrador());
