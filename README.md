# TallerMap

Directorio web de talleres de automoción. Permite buscar talleres activos y publicar gratuitamente una ficha sin aprobación previa. El panel privado permite revisar, completar, corregir o retirar registros.

El buscador utiliza la población como criterio principal. Opcionalmente, el visitante puede autorizar la ubicación de su dispositivo para ordenar talleres por distancia; las coordenadas del visitante no se guardan en TallerMap.

## Estructura

- `index.html`: página principal y buscador.
- `pages/registro.html`: formulario público de nuevos registros.
- `pages/admin-login.html`: acceso privado de administración.
- `pages/admin.html`: revisión posterior y retirada de fichas publicadas.
- `pages/condiciones-fotografias.html`: condiciones adicionales para imágenes opcionales.
- `pages/privacidad.html`: información sobre el tratamiento de datos personales.
- `css/estilo.css`: estilos compartidos y adaptación móvil.
- `js/`: conexión con Supabase y lógica de la web.
- `js/servicios.js`: catálogo compartido por el buscador y el formulario de alta.
- `js/provincias.js`: provincias españolas y validación del prefijo postal.
- `supabase/solicitudes_alta_taller.sql`: tablas, funciones, permisos y políticas RLS.
- `supabase/estadisticas_publicas.sql`: contadores públicos calculados con datos reales.
- `supabase/formulario_web_provincias.sql`: web opcional y comprobación provincia/código postal.
- `supabase/alta_automatica_espana.sql`: activa la publicación automática y gratuita en toda España.
- `supabase/fotos_opcionales_taller.sql`: crea el almacenamiento privado y las políticas para un máximo de cinco fotografías.
- `supabase/horarios_obligatorios.sql`: añade el horario semanal obligatorio y lo publica en cada ficha.
- `supabase/admin_control_total.sql`: activa el control administrativo completo, el historial de cambios y el resumen exclusivo de talleres por provincia y población.
- `supabase/2026-07-26_formularios_sin_datos_propietario.sql`: elimina propietario, CIF y correo de las nuevas altas y deja la edición en manos de TallerMap.
- `supabase/2026-07-29_endurecimiento_critico.sql`: cierra la tabla privada al público y versiona las funciones públicas de búsqueda, proximidad y coordenadas.

## Configuración de Supabase

En una instalación nueva, abre **Supabase > SQL Editor** y ejecuta completos, en este orden:

1. `supabase/solicitudes_alta_taller.sql`
2. `supabase/estadisticas_publicas.sql`
3. `supabase/formulario_web_provincias.sql`
4. `supabase/fotos_opcionales_taller.sql`
5. `supabase/horarios_obligatorios.sql`
6. `supabase/admin_control_total.sql`
7. `supabase/2026-07-26_formularios_sin_datos_propietario.sql`
8. `supabase/2026-07-29_endurecimiento_critico.sql`

Después crea el usuario administrador en **Authentication > Users** y añade su UUID a `public.administradores` con la instrucción indicada al final del SQL principal.

Los archivos `formulario_seguro.sql`, `edicion_propietario_taller.sql` y los relacionados con Stripe se conservan únicamente como historial. No deben ejecutarse sobre la configuración actual.

El panel incluye un buscador administrativo de candidatos basado en OpenStreetMap. Despliega `supabase/functions/buscar-talleres-internet/index.ts` como Edge Function con el nombre exacto `buscar-talleres-internet`. Los resultados externos nunca se publican automáticamente: el administrador debe pasarlos al editor y comprobarlos.

Las altas públicas no solicitan propietario, CIF ni correo y se crean como fichas activas no verificadas. Una cuenta incluida en `public.administradores` puede completarlas, verificarlas o retirarlas. El acceso administrativo utiliza Supabase Authentication.

## Despliegue

Vercel debe publicar la raíz del repositorio desde la rama `main`. No se necesita un comando de compilación porque la web utiliza HTML, CSS y JavaScript estáticos.

Antes de publicar, ejecuta:

```bash
node scripts/validate-site.mjs
```
