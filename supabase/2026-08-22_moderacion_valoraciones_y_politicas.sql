-- TallerMap · 2026-08-22
-- Endurecimiento del flujo de valoraciones y eliminación de políticas RLS duplicadas.
-- Cambios ya aplicados en producción en Supabase.

-- Duplicados exactos: conservar una sola política equivalente.
drop policy if exists "publico consulta municipios activos" on public.municipios;
drop policy if exists "Servicios visibles" on public.servicios;
drop policy if exists "valoraciones_select_publicas" on public.valoraciones;

-- Visitantes anónimos: solo reseñas pendientes, activas y con contenido válido.
drop policy if exists "valoraciones_insert_publico" on public.valoraciones;
create policy "valoraciones_insert_publico"
on public.valoraciones
for insert
to anon
with check (
  usuario_id is null
  and aprobada = false
  and activa = true
  and puntuacion between 1 and 5
  and char_length(coalesce(comentario,'')) between 20 and 1500
);

-- Usuarios autenticados: pueden enviar anónimamente o vinculando su propio usuario,
-- pero nunca autoaprobar una reseña ni saltarse los límites de contenido.
drop policy if exists "Usuarios crean valoraciones" on public.valoraciones;
create policy "Usuarios crean valoraciones"
on public.valoraciones
for insert
to authenticated
with check (
  (usuario_id is null or usuario_id = (select auth.uid()))
  and aprobada = false
  and activa = true
  and puntuacion between 1 and 5
  and char_length(coalesce(comentario,'')) between 20 and 1500
);

-- La interfaz pública no ofrece edición de reseñas. Las modificaciones quedan
-- únicamente bajo la política administrativa existente.
drop policy if exists "Usuarios actualizan sus valoraciones" on public.valoraciones;
