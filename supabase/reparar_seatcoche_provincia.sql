-- Reparación puntual de la provincia del registro histórico #14.
-- Ejecuta este archivo completo una sola vez en Supabase > SQL Editor.

begin;

update public.solicitudes_alta_taller
set provincia = public.provincia_de_codigo_postal(codigo_postal)
where id = 14
  and codigo_postal = '46460'
  and provincia is distinct from public.provincia_de_codigo_postal(codigo_postal);

update public.talleres
set provincia = public.provincia_de_codigo_postal(codigo_postal),
    updated_at = now()
where solicitud_id = 14
  and codigo_postal = '46460'
  and provincia is distinct from public.provincia_de_codigo_postal(codigo_postal);

commit;

-- Debe mostrar Valencia/València:
select id, nombre_taller, codigo_postal, provincia
from public.solicitudes_alta_taller
where id = 14;
