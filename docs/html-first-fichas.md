# Fichas públicas HTML-first

Objetivo: que Google y el usuario reciban la misma ficha completa desde el HTML inicial.

## Regla de arquitectura

La ruta `/talleres/:slug` se resuelve en servidor mediante `api/taller-html.js`.

El servidor obtiene los datos públicos desde Supabase y genera antes de responder:

- title y meta description
- robots `index,follow,max-image-preview:large`
- canonical propio
- Open Graph y Twitter metadata
- JSON-LD `AutoRepair`
- breadcrumbs JSON-LD
- nombre, dirección y estado de revisión
- teléfono
- servicios
- horarios
- acciones `Llamar`, `Cómo llegar`, WhatsApp y web cuando existan
- enlaces a municipio y provincia
- talleres relacionados

El HTML enviado al navegador elimina los runtimes `js/taller.js` y `js/taller-urls.js` y la carga cliente de Supabase usada por esos runtimes. De esta forma ningún JavaScript posterior puede cambiar title, canonical, robots o reconstruir la ficha después de que el servidor la haya generado.

## Criterio de revisión

La rama no debe fusionarse a `main` hasta comprobar en preview:

1. una ficha con todos los datos;
2. una ficha con datos incompletos;
3. una ficha de otro municipio;
4. respuesta 404 para slug inexistente;
5. HTML fuente sin dependencia del runtime de contenido;
6. `Cómo llegar` presente en el HTML fuente;
7. canonical y robots correctos en el HTML fuente.
