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

El HTML enviado a `/talleres/:slug` elimina `js/taller.js`, `js/taller-urls.js` y con ello el runtime antiguo que reconstruía contenido y SEO. Ningún JavaScript posterior debe cambiar title, canonical, robots, descripción, nombre, dirección, servicios u horarios.

Se mantiene JavaScript únicamente para funciones auxiliares e interactivas que no definen la identidad SEO de la ficha: valoraciones, reclamación, imágenes auxiliares y consentimiento. Estas funciones pueden usar el SDK público de Supabase sin reconstruir la ficha.

`api/taller.js` se elimina para que exista un único motor SSR de ficha pública.

## Criterio de revisión

La rama no debe fusionarse a `main` hasta comprobar en preview:

1. una ficha con todos los datos;
2. una ficha con datos incompletos;
3. una ficha de otro municipio;
4. respuesta 404 para slug inexistente;
5. HTML fuente sin dependencia del runtime antiguo de contenido/SEO;
6. `Cómo llegar` presente en el HTML fuente;
7. canonical y robots correctos en el HTML fuente;
8. valoraciones y reclamación siguen funcionando sin `taller-urls-core.js`;
9. fotografías públicas y privadas no sufren regresiones.
