-- TallerMap: importación de 21 talleres de Silla (Valencia)
-- Fecha de recopilación: 23/07/2026
-- Autorizado por el responsable de TallerMap.
-- Ejecutar completo en Supabase > SQL Editor.
--
-- Los registros se publican como activos y NO verificados.
-- Se actualizan coincidencias por nombre + dirección y se insertan los que falten.

begin;

create temporary table importar_talleres_silla (
    nombre text not null,
    telefono text,
    movil text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    descripcion text,
    web text,
    horario text,
    servicios text[],
    fuente text,
    observaciones text
) on commit drop;

insert into importar_talleres_silla (
    nombre, telefono, movil, direccion, codigo_postal, ciudad, provincia,
    descripcion, web, horario, servicios, fuente, observaciones
) values
('TAKUMISAN', '961 11 53 56', null, 'Av. de Picassent, 19', '46460', 'Silla', 'Valencia/València', 'Mecánica de automóviles y camiones. Servicios públicos localizados: Reparación de automóviles; reparación y mantenimiento de camiones', 'https://takumisan.com', 'L-V 08:30-14:00 y 15:30-18:30; S-D cerrado', array['mecanica-general', 'mantenimiento-programado', 'vehiculos-industriales']::text[], 'https://www.cylex.es/silla/takumisan-13060076.html', 'Datos recientes; contactar antes de publicar. Ficha actualizada en julio de 2026.'),
('Silla Neumáticos José Berruezo e Hijos (Euromaster)', '961 20 07 05', null, 'Carrer de Massanassa, 5', '46460', 'Silla', 'Valencia/València', 'Neumáticos y mecánica rápida. Servicios públicos localizados: Neumáticos; mantenimiento; mecánica rápida; aceite; baterías; vehículos y camiones', 'https://www.euromaster-neumaticos.es/centros/comunidad-valenciana/silla/euromaster-silla-neumaticos-jose-berruezo-e-hijos-1', 'L-V 08:30-13:30 y 15:30-19:00; S-D cerrado', array['mecanica-general', 'mantenimiento-programado', 'cambio-aceite-filtros', 'neumaticos', 'baterias', 'vehiculos-industriales']::text[], 'https://www.cylex.es/silla/silla-neum%C3%A1ticos-jose-berruezo-e-hijos-2-11484230.html', 'Datos recientes; contactar antes de publicar. Aparecía duplicado en el directorio; consolidado en una sola ficha.'),
('Electro Coher', '961 20 06 15', null, 'Avinguda d''Alacant, 126', '46460', 'Silla', 'Valencia/València', 'Electricidad y electromecánica del automóvil. Servicios públicos localizados: Electricidad de vehículos; reparación de automóviles', null, 'L-J 08:00-14:00 y 16:00-18:30; V 08:00-14:00; S-D cerrado', array['mecanica-general', 'diagnosis-electronica', 'electricidad-automovil']::text[], 'https://www.cylex.es/silla/electro-coher-11478873.html', 'Datos recientes; contactar antes de publicar. Ficha actualizada en julio de 2026.'),
('Xvenir Carrera S.L.U.', '961 11 66 00', '692 49 22 11', 'Av. Alborache, 13', '46460', 'Silla', 'Valencia/València', 'Chapa, pintura y mecánica. Servicios públicos localizados: Chapa; pintura; mecánica; gestión de reparaciones con aseguradoras', 'https://www.xvenircarrera.com', 'L-J 08:30-14:00 y 15:30-18:30; V 08:30-15:30; S-D cerrado', array['mecanica-general', 'chapa-pintura', 'carroceria']::text[], 'https://www.xvenircarrera.com/', 'Datos recientes; contactar antes de publicar. Web propia y teléfono móvil público.'),
('Auto-Taller Silla C.B.', '961 20 13 52', '636 16 40 75', 'Carrer del Molinell, 7', '46460', 'Silla', 'Valencia/València', 'Mecánica, electricidad, chapa y pintura. Servicios públicos localizados: Mecánica; electricidad; plancha y pintura', null, 'L-V 08:30-14:00 y 15:30-19:00; S-D cerrado', array['mecanica-general', 'diagnosis-electronica', 'electricidad-automovil', 'chapa-pintura', 'carroceria']::text[], 'https://www.cylex.es/silla/auto-taller-silla-c-b--11508855.html', 'Datos recientes; confirmar móvil. El móvil procede del directorio empresarial municipal; el fijo y horario, de Cylex.'),
('Crisentimotor', '961 20 06 57', null, 'Carrer de la Santíssima Trinitat, 12', '46460', 'Silla', 'Valencia/València', 'Taller mecánico multimarca. Servicios públicos localizados: Mecánica general y reparación de automóviles', 'https://crisentimotor.lawebdetutaller.com', 'L-V 08:30-14:00 y 16:00-19:00; S-D cerrado', array['mecanica-general']::text[], 'https://www.cylex.es/silla/crisentimotor-13549037.html', 'Datos recientes; contactar antes de publicar. Posible relación o sustitución del antiguo registro Talleres Bartom.'),
('Talleres Juan Simarro', '961 20 09 27', '663 98 30 84', 'Av. d''Ausiàs March, 9', '46460', 'Silla', 'Valencia/València', 'Mecánica general. Servicios públicos localizados: Reparación de automóviles; mecánica general', null, 'L-J 08:00-14:00 y 16:00-19:30; V 08:00-14:00 y 16:00-19:00; S-D cerrado', array['mecanica-general']::text[], 'https://www.cylex.es/silla/talleres-juan-simarro-11834297.html', 'Datos recientes; contactar antes de publicar. No confundir con el registro Simarro Gascón, J. de otra dirección.'),
('Francisco Morilla S.L.', '961 20 17 39', null, 'Avinguda d''Alacant, 134', '46460', 'Silla', 'Valencia/València', 'Taller mecánico multimarca / Eurorepar. Servicios públicos localizados: Mecánica general; mantenimiento y reparación de automóviles', 'https://www.eurorepar.es', 'L-V 08:00-14:00 y 15:30-19:30; S-D cerrado', array['mecanica-general', 'mantenimiento-programado']::text[], 'https://www.cylex.es/silla/francisco-morilla-s-l--12386756.html', 'Datos recientes; localizar ficha web exacta. El enlace web publicado lleva a la red Eurorepar, no necesariamente a una ficha individual.'),
('Joicar Multiauto', '961 21 87 85', null, 'Carrer del Primer de Maig, 6', '46460', 'Silla', 'Valencia/València', 'Taller, neumáticos y lavado. Servicios públicos localizados: Mecánica; neumáticos; bombas inyectoras; frenos; distribución; aceite; lavado y tapicerías', null, 'L-V 08:00-14:00 y 16:00-19:00; S-D cerrado', array['mecanica-general', 'cambio-aceite-filtros', 'frenos', 'correa-distribucion', 'neumaticos', 'lavado-detailing', 'tapiceria']::text[], 'https://www.cylex.es/silla/joicar-multiauto-13301025.html', 'Datos recientes; contactar antes de publicar. Los servicios se han contrastado con QDQ y Talleres.biz.'),
('Tainivol S.L.', '961 21 18 72', null, 'Avinguda d''Alacant, 22', '46460', 'Silla', 'Valencia/València', 'Taller mecánico y reparación de remolques. Servicios públicos localizados: Mecánica; reparación de remolques', null, 'L-V 08:30-15:00; S-D cerrado', array['mecanica-general', 'vehiculos-industriales']::text[], 'https://www.cylex.es/silla/tainivol--s-l--12435073.html', 'Datos recientes; confirmar tipo de cliente. Otra fuente indica horario partido 08:00-14:00 y 15:00-18:00; conviene confirmar.'),
('Talleres Voramar', '635 68 56 60', '635 68 56 60', 'Carrer d''Alfafar, 1', '46460', 'Silla', 'Valencia/València', 'Taller de automóviles. Servicios públicos localizados: Reparación de automóviles', null, 'L-V 09:00-14:00 y 16:00-20:00; S 09:00-13:30; D cerrado', array['mecanica-general']::text[], 'https://www.cylex.es/silla/talleres-voramar-13091132.html', 'Datos recientes; contactar antes de publicar. Móvil público; posible uso de WhatsApp no confirmado.'),
('Boni Reparación', '687 69 11 19', '687 69 11 19', 'Servicio móvil / dirección no publicada', '46460', 'Silla', 'Valencia/València', 'Vehículos industriales y maquinaria. Servicios públicos localizados: Reparación de vehículos industriales, agrícolas y maquinaria de obra pública', 'https://bonireparacion.es', '24 horas, todos los días (según directorio)', array['vehiculos-industriales']::text[], 'https://www.cylex.es/silla/boni-reparaci%C3%B3n-14509486.html', 'Confirmar dirección y disponibilidad 24 h. Parece servicio móvil; no consta domicilio público exacto.'),
('Inrema S.L.', '961 21 95 70', null, 'Carrer del Molinell, 8-10', '46460', 'Silla', 'Valencia/València', 'Mantenimiento y reparación industrial / taller. Servicios públicos localizados: Mantenimiento y suministros industriales; figura también como taller mecánico', 'http://inrema.es', 'L-V 08:30-13:30 y 15:00-18:00; S-D cerrado', array['mecanica-general', 'mantenimiento-programado']::text[], 'https://www.cylex.es/silla/inrema-s-l--11673050.html', 'Confirmar que atiende automóviles particulares. Puede ser principalmente industrial; no publicar como taller de coches sin confirmación.'),
('Rafael Albert Tormos', '961 20 27 08', null, 'Plaça del Mercat Nou, 5', '46460', 'Silla', 'Valencia/València', 'Reparación de automóviles. Servicios públicos localizados: Reparación de automóviles', null, null, array['mecanica-general']::text[], 'https://www.cylex.es/silla/rafael-albert-tormos-11801404.html', 'Verificar existencia y horario. Ficha sin horario y con actualización antigua.'),
('Electromecánica Ibáñez S.L.', '961 20 01 73', null, 'Avinguda d''Alacant, 102', '46460', 'Silla', 'Valencia/València', 'Electromecánica y reparación de automóviles. Servicios públicos localizados: Electromecánica; reparación de automóviles', null, null, array['mecanica-general', 'diagnosis-electronica', 'electricidad-automovil']::text[], 'https://www.cylex.es/silla/electromec%C3%A1nica-ib%C3%A1%C3%B1ez-s-l--12099847.html', 'Verificar existencia y horario. Ficha sin horario y con actualización antigua.'),
('Talleres Els Barqueres', '961 20 07 32', '699 47 00 28', 'Av. de la Séquia Real del Xúquer, 40', '46460', 'Silla', 'Valencia/València', 'Chapa, pintura y reparación de automóviles. Servicios públicos localizados: Chapa; pintura; reparación de automóviles', null, null, array['mecanica-general', 'chapa-pintura', 'carroceria']::text[], 'https://www.cylex.es/silla/talleres-mec%C3%A1nicos/?p=2', 'Confirmar teléfonos y horario. Dos teléfonos aparecen en directorios distintos.'),
('Ferto S.A. (Silla)', '961 21 43 09', null, 'Carrer del Penyagolosa, 11 (P.I. Pla dels Olivars)', '46460', 'Silla', 'Valencia/València', 'Mecánica, chapa y pintura. Servicios públicos localizados: Mantenimiento; mecánica; inyección gasolina y diésel; chapa y pintura; aire acondicionado; neumáticos; pre-ITV; cajas automáticas', null, null, array['mecanica-general', 'mantenimiento-programado', 'pre-itv', 'caja-cambios', 'neumaticos', 'chapa-pintura', 'carroceria', 'aire-acondicionado']::text[], 'https://www.autingo.es/taller-mecanico/valencia/silla', 'Confirmar horario y web. Dirección y teléfono aparecen en directorios de talleres y documentos de aseguradoras.'),
('Silla Motors', '961 20 02 66', null, 'Av. de la Séquia Real del Xúquer, 16', '46460', 'Silla', 'Valencia/València', 'Taller de automóviles. Servicios públicos localizados: Reparación y mantenimiento de automóviles', null, null, array['mecanica-general', 'mantenimiento-programado']::text[], 'https://www.tallerity.com/info/silla-motors-silla', 'Confirmar dirección exacta. QDQ muestra una dirección diferente (Av. País Valencià, 126); la dirección seleccionada coincide con dos directorios y el portal municipal.'),
('Talleres Bartom', '961 20 06 57', null, 'Carrer de la Santíssima Trinitat, 16', '46460', 'Silla', 'Valencia/València', 'Taller mecánico (registro antiguo). Servicios públicos localizados: Taller mecánico', null, null, array['mecanica-general']::text[], 'https://www.cylex.es/silla/talleres-bartom-12435078.html', 'Posible duplicado; no publicar. Comparte teléfono con Crisentimotor y está a pocos metros; probablemente registro antiguo o duplicado.'),
('Hermanos Celda Ferrer C.B.', null, null, 'Av. País Valencià, 6', '46460', 'Silla', 'Valencia/València', 'Taller mecánico. Servicios públicos localizados: Taller mecánico', null, null, array['mecanica-general']::text[], 'https://www.autingo.es/taller-mecanico/valencia/silla/hermanos-celda-ferrer-c-b', 'Verificar teléfono, horario y actividad. Directorio indica que no pertenece a su red; datos limitados.'),
('Ximo Magallo y Cía. S.A.', null, null, 'Av. dels Reis Catòlics, 4', '46460', 'Silla', 'Valencia/València', 'Taller mecánico. Servicios públicos localizados: Taller mecánico', null, null, array['mecanica-general']::text[], 'https://www.autingo.es/taller-mecanico/valencia/silla', 'Verificar existencia, teléfono y horario. Solo localizado en un directorio de talleres.');

-- Actualiza fichas coincidentes sin convertirlas en verificadas.
update public.talleres as t
set
    telefono = coalesce(nullif(d.telefono, ''), t.telefono),
    movil = coalesce(nullif(d.movil, ''), t.movil),
    whatsapp = coalesce(nullif(d.movil, ''), t.whatsapp),
    codigo_postal = d.codigo_postal,
    ciudad = d.ciudad,
    provincia = d.provincia,
    pais = 'España',
    descripcion = d.descripcion,
    web = coalesce(nullif(d.web, ''), t.web),
    horario = coalesce(nullif(d.horario, ''), t.horario),
    servicios = d.servicios,
    activo = true,
    verificado = false,
    updated_at = now()
from importar_talleres_silla as d
where lower(btrim(t.nombre)) = lower(btrim(d.nombre))
  and lower(btrim(coalesce(t.direccion, ''))) = lower(btrim(coalesce(d.direccion, '')));

-- Inserta las fichas que todavía no existen.
insert into public.talleres (
    nombre, telefono, movil, whatsapp, direccion, codigo_postal,
    ciudad, provincia, pais, descripcion, web, horario, servicios,
    fotos, verificado, activo, created_at, updated_at
)
select
    d.nombre,
    nullif(d.telefono, ''),
    nullif(d.movil, ''),
    nullif(d.movil, ''),
    d.direccion,
    d.codigo_postal,
    d.ciudad,
    d.provincia,
    'España',
    d.descripcion,
    nullif(d.web, ''),
    nullif(d.horario, ''),
    d.servicios,
    '{}'::text[],
    false,
    true,
    now(),
    now()
from importar_talleres_silla as d
where not exists (
    select 1
    from public.talleres as t
    where lower(btrim(t.nombre)) = lower(btrim(d.nombre))
      and lower(btrim(coalesce(t.direccion, ''))) = lower(btrim(coalesce(d.direccion, '')))
);

commit;

-- Comprobación final:
select
    count(*) as talleres_activos_en_silla
from public.talleres
where activo = true
  and lower(ciudad) = 'silla';
