# Biblioteca de fondos - TallerMap

Esta carpeta guarda las alternativas visuales para el fondo de la web. **Preparar y guardar un fondo no significa activarlo.** La pagina actual debe permanecer intacta hasta elegir el diseno.

## Directorios

- `movil/`: fondos verticales para telefonos; referencia **9:16 (1080 x 1920 px)**.
- `escritorio/`: fondos horizontales para ordenador y tablet en horizontal; referencia **16:9 (1920 x 1080 px)**.

## Convencion de nombres

- `movil/fondo-01-abstracto.webp`
- `movil/fondo-02-abstracto.webp`
- `escritorio/fondo-01-abstracto.webp`
- `escritorio/fondo-02-abstracto.webp`

Guardar cada alternativa con su numero correspondiente para compararlas y conservar versiones anteriores. Usar letras minusculas, guiones y sin tildes.

## Recomendaciones

- Preferir **WebP** comprimido; conservar el archivo fuente original fuera de esta carpeta si se necesita.
- Dejar zonas con poco detalle detras de titulos, formularios y botones para mantener la legibilidad.
- Comprobar siempre el recorte en pantalla movil; `background-size: cover` puede ocultar los bordes.
- Mantener un color de fondo de respaldo y evitar imagenes innecesariamente pesadas.

## Estado

**Fase 2: fondo aplicado a la portada.**

- `movil/fondo-01-abstracto.webp`: primera alternativa azul (768 x 1365), conservada pero **no activa**.
- `movil/fondo-02-pista-azul.webp`: fondo elegido, **activo en la portada** (864 x 1536 px, relacion 9:16, WebP de unos 55 KB).
- La portada carga `/css/fondo-portada-9x16.css`, que muestra el fondo a pantalla completa con una capa fija y el contenido superpuesto.
- En ordenador se usa la misma imagen con `background-size: cover`, centrada y recortada sin deformaciones; no se ha generado una imagen horizontal distinta.
- La aplicacion se limita a `index.html`. Las paginas de municipios, talleres y servicios mantienen sus disenos.
- No se han cambiado URLs, sitemaps, contenido indexable ni logica del buscador.
