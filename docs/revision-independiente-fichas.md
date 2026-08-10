# Revisión independiente: fichas públicas

Esta revisión debe tratar el cambio como código ajeno al implementador.

## SEO

- No existe `noindex` en la salida de una ficha válida.
- El canonical coincide exactamente con `/talleres/:slug`.
- Title y description se generan en servidor.
- Los datos estructurados coinciden con el contenido visible.
- No existe un segundo runtime que reescriba robots, canonical o title.

## Contenido

- `Cómo llegar` existe en el HTML inicial cuando hay dirección.
- Teléfono y enlaces de llamada están presentes sin JavaScript.
- Servicios y horario están presentes sin JavaScript.
- Enlaces de municipio, provincia y relacionados son enlaces HTML rastreables.

## Robustez

- Slug vacío o inexistente devuelve 404.
- Un error de Supabase no devuelve una plantilla genérica con HTTP 200.
- Las URLs y textos introducidos en HTML se escapan o validan.
- La ficha sigue siendo usable con JavaScript desactivado.

## Alcance

La solución no contiene ninguna condición específica para Silla, Beniparrell ni otro municipio. Toda la lógica depende únicamente de los datos del taller y del catálogo municipal.
