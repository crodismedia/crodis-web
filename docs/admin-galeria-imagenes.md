# Galería de imágenes del Editor TallerMap

## Objetivo

Añadir al panel izquierdo del editor una galería vinculada al taller seleccionado, manteniendo la ficha de Supabase como fuente oficial.

## Flujo funcional

1. Seleccionar un taller existente.
2. Arrastrar imágenes desde Windows, Android, tablet o usar el selector de archivos.
3. Mostrar una vista previa local antes de subir.
4. Permitir marcar una imagen como principal.
5. Permitir ordenar, eliminar o descartar imágenes pendientes.
6. Subir únicamente al confirmar el guardado.
7. Guardar las URLs finales en la ficha del taller.

## Ruta prevista en Supabase Storage

Bucket: `talleres`

Ruta de cada archivo:

```text
{taller_id}/{timestamp}-{nombre-normalizado}.webp
```

Ejemplo:

```text
9ce44f2e-d905-4b22-8843-2a5e448b5ba0/1785974400000-fachada.webp
```

No se guardarán rutas locales como `C:\Users\...`, porque solo funcionan en el ordenador del administrador.

## Estados de una imagen

- `local`: seleccionada, todavía no subida.
- `subiendo`: transferencia en curso.
- `guardada`: disponible en Supabase Storage.
- `principal`: portada de la ficha.
- `descartada`: no se subirá.
- `error`: fallo durante la transferencia.

## Reglas del editor

- Máximo inicial recomendado: 10 imágenes por taller.
- Formatos admitidos: JPEG, PNG, WebP y HEIC cuando el navegador pueda procesarlo.
- Tamaño máximo inicial: 10 MB por archivo.
- Conversión prevista a WebP antes de subir.
- Redimensión máxima prevista: 1920 px en el lado mayor.
- La primera imagen aceptada será principal si no existe otra.
- Ninguna imagen se subirá hasta que exista un `taller_id` válido.
- Cambiar de taller con imágenes pendientes debe mostrar una advertencia.

## Interfaz prevista

La galería aparecerá en el panel izquierdo, debajo de la descripción y antes del botón Guardar.

Controles:

- `Añadir imágenes`
- Zona drag and drop
- Miniaturas
- `Usar como principal`
- `Eliminar`
- `Guardar imágenes`
- Indicador de progreso

En móvil y tablet se usará el selector nativo, la galería y la cámara cuando el navegador lo permita.

## Seguridad

- La subida se realizará con la sesión autenticada de Supabase.
- Las políticas de Storage deberán permitir escribir solo a administradores y, más adelante, al propietario autorizado de su propio taller.
- No se incluirá ninguna `service_role_key` en el navegador.

## Integración posterior

Antes de activar la subida definitiva hay que confirmar:

1. Nombre real del bucket existente o crear `talleres`.
2. Columna o estructura actual donde TallerMap guarda las imágenes.
3. Políticas RLS de Storage.
4. Compatibilidad con la ficha pública actual.
