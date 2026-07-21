# TallerMap

Directorio web de talleres de automoción. La primera versión permite buscar talleres activos, enviar una solicitud de alta y revisar las solicitudes desde un panel privado de administración.

## Estructura

- `index.html`: página principal y buscador.
- `pages/registro.html`: formulario público de nuevos registros.
- `pages/admin-login.html`: acceso privado de administración.
- `pages/admin.html`: aprobación y rechazo de solicitudes.
- `css/estilo.css`: estilos compartidos y adaptación móvil.
- `js/`: conexión con Supabase y lógica de la web.
- `js/servicios.js`: catálogo compartido por el buscador y el formulario de alta.
- `supabase/solicitudes_alta_taller.sql`: tablas, funciones, permisos y políticas RLS.
- `supabase/estadisticas_publicas.sql`: contadores públicos calculados con datos reales.

## Configuración de Supabase

1. Abre **Supabase > SQL Editor**.
2. Copia y ejecuta completo `supabase/solicitudes_alta_taller.sql`.
3. Crea el usuario administrador en **Authentication > Users**.
4. Añade su UUID a `public.administradores` con la instrucción indicada al final del archivo SQL.

Si la base de datos ya estaba configurada antes de añadir los contadores reales, ejecuta también `supabase/estadisticas_publicas.sql` una sola vez.

Las solicitudes públicas se guardan con estado `pendiente`. Solo una cuenta incluida en `public.administradores` puede consultarlas, aprobarlas o rechazarlas. Una solicitud pendiente nunca se muestra en el listado público.

El acceso administrativo admite contraseña o un enlace seguro enviado por correo. Para usar el enlace, configura en Supabase **Authentication > URL Configuration** el sitio `https://tallermap.es` y permite la redirección `https://tallermap.es/**`.

## Despliegue

Vercel debe publicar la raíz del repositorio desde la rama `main`. No se necesita un comando de compilación porque la web utiliza HTML, CSS y JavaScript estáticos.
