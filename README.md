# TallerMap

Directorio web de talleres de automoción. La primera versión permite buscar talleres activos, enviar una solicitud de alta y revisar las solicitudes desde un panel privado de administración.

El buscador utiliza la población como criterio principal. Opcionalmente, el visitante puede autorizar la ubicación de su dispositivo para detectar su población y lanzar la búsqueda automáticamente; las coordenadas no se guardan en TallerMap.

## Estructura

- `index.html`: página principal y buscador.
- `pages/registro.html`: formulario público de nuevos registros.
- `pages/admin-login.html`: acceso privado de administración.
- `pages/admin.html`: aprobación y rechazo de solicitudes.
- `pages/condiciones-fotografias.html`: condiciones adicionales para imágenes opcionales.
- `css/estilo.css`: estilos compartidos y adaptación móvil.
- `js/`: conexión con Supabase y lógica de la web.
- `js/servicios.js`: catálogo compartido por el buscador y el formulario de alta.
- `js/provincias.js`: provincias españolas y validación del prefijo postal.
- `supabase/solicitudes_alta_taller.sql`: tablas, funciones, permisos y políticas RLS.
- `supabase/estadisticas_publicas.sql`: contadores públicos calculados con datos reales.
- `supabase/formulario_web_provincias.sql`: web opcional y comprobación provincia/código postal.
- `supabase/alta_automatica_comunitat_valenciana.sql`: activa la publicación automática para los códigos postales 03, 12 y 46.
- `supabase/fotos_opcionales_taller.sql`: crea el almacenamiento privado y las políticas para un máximo de cinco fotografías.

## Configuración de Supabase

1. Abre **Supabase > SQL Editor**.
2. Copia y ejecuta completo `supabase/solicitudes_alta_taller.sql`.
3. Crea el usuario administrador en **Authentication > Users**.
4. Añade su UUID a `public.administradores` con la instrucción indicada al final del archivo SQL.

Si la base de datos ya estaba configurada antes de añadir los contadores reales, ejecuta también `supabase/estadisticas_publicas.sql` una sola vez.

Para activar la publicación automática en una base de datos ya configurada, ejecuta una sola vez `supabase/alta_automatica_comunitat_valenciana.sql`.

Para permitir fotografías opcionales, ejecuta una sola vez `supabase/fotos_opcionales_taller.sql`. Cada imagen puede ocupar hasta 5 MB y las solicitudes con fotos deben aceptar las condiciones adicionales. Las imágenes permanecen privadas mientras la solicitud no esté publicada.

Las solicitudes con código postal de Alicante (03), Castellón (12) o Valencia (46) se publican automáticamente como fichas activas no verificadas. Las solicitudes del resto de España se guardan como `pendiente`; solo una cuenta incluida en `public.administradores` puede consultarlas, aprobarlas o rechazarlas.

El acceso administrativo admite contraseña o un enlace seguro enviado por correo. Para usar el enlace, configura en Supabase **Authentication > URL Configuration** el sitio `https://tallermap.es` y permite la redirección `https://tallermap.es/**`.

## Despliegue

Vercel debe publicar la raíz del repositorio desde la rama `main`. No se necesita un comando de compilación porque la web utiliza HTML, CSS y JavaScript estáticos.
