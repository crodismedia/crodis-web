PUBLICAR 21 TALLERES DE SILLA EN TALLERMAP
=============================================

Estado
------
Los archivos están preparados y validados, pero la integración de GitHub respondió
con error 403 al intentar escribir en crodismedia/crodis-web.

Método 1 — Publicación inmediata mediante Supabase
---------------------------------------------------
1. Abre tu proyecto de Supabase.
2. Entra en SQL Editor.
3. Abre el archivo:
   supabase/importar_talleres_silla.sql
4. Copia todo el contenido, pulsa Run y comprueba el resultado final.

El SQL:
- inserta los talleres que falten;
- actualiza coincidencias por nombre y dirección;
- establece activo=true;
- mantiene verificado=false;
- evita duplicar una ficha con el mismo nombre y dirección.

Método 2 — Catálogo web incluido en el repositorio
---------------------------------------------------
Sube respetando estas rutas:
- data/talleres-silla.json
- js/talleres-locales.js
- js/servicios.js (sustituye el archivo existente)

Este método añade los 21 talleres al buscador aunque todavía no se hayan importado
en Supabase. También añade botones de llamada, WhatsApp y web cuando hay datos.

Observaciones
-------------
Los datos se recopilaron de fuentes públicas el 23/07/2026.
Todas las fichas aparecen como publicadas, pero no verificadas.
