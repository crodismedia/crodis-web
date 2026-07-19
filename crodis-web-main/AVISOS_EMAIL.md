# Avisos por correo de nuevas solicitudes

La Edge Function `aviso-nueva-solicitud` recibe exclusivamente eventos `INSERT` de `public.solicitudes_alta_taller` y manda el aviso a `crodismedia@outlook.es`. La función no publica talleres ni cambia las políticas RLS.

## 1. Crear y configurar Resend

1. Crea una cuenta en [Resend](https://resend.com/).
2. En **Domains**, añade y verifica un dominio propio mediante los registros DNS que indique Resend. Una vez verificado, puedes utilizar un remitente de ese dominio.
3. Crea una API key de tipo **Sending access**. Copia el valor solo para el siguiente paso; no lo guardes en el repositorio.

## 2. Enlazar el proyecto y guardar secretos

En el panel de Supabase abre **Project Settings > Edge Functions > Secrets** y crea estas tres variables:

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | La API key de Resend con permiso de envío. |
| `RESEND_FROM_EMAIL` | Remitente verificado, por ejemplo `TallerMap <avisos@tu-dominio.es>`. |
| `AVISO_WEBHOOK_SECRET` | Una cadena aleatoria larga y única. Guárdala para el paso del webhook. |

Desde la raíz del proyecto, con la CLI de Supabase instalada y tras iniciar sesión con `supabase login`, ejecuta estos comandos. Sustituye únicamente los marcadores por tus valores reales en tu terminal; no los pegues en archivos ni los subas a Git.

```powershell
supabase link --project-ref TU_PROJECT_REF
supabase secrets set RESEND_API_KEY="PEGA_AQUI_LA_API_KEY_DE_RESEND"
supabase secrets set RESEND_FROM_EMAIL="TallerMap <avisos@tu-dominio-verificado.es>"
supabase secrets set AVISO_WEBHOOK_SECRET="GENERA_Y_PEGA_UN_SECRETO_LARGO_Y_ALEATORIO"
```

No uses ni introduzcas claves de Supabase en estas variables. `AVISO_WEBHOOK_SECRET` debe ser una cadena aleatoria y única; conserva su valor de forma segura porque se necesitará como cabecera en el webhook.

## 3. Desplegar la Edge Function

El archivo `supabase/config.toml` contiene esta configuración y solo afecta a esta función:

```toml
[functions.aviso-nueva-solicitud]
verify_jwt = false
```

Despliega desde la raíz del proyecto:

```powershell
supabase functions deploy aviso-nueva-solicitud
```

La desactivación de JWT es necesaria porque un Database Webhook no presenta un JWT de usuario. La función comprueba su propio secreto en la cabecera `x-aviso-webhook-secret` antes de procesar nada.

## 4. Crear el Database Webhook

En Supabase ve a **Database > Webhooks > Create a new webhook** y usa exactamente estos valores:

| Campo | Valor |
| --- | --- |
| Name | `aviso_nueva_solicitud` |
| Table | `public.solicitudes_alta_taller` |
| Events | Solo `INSERT` |
| Type | `HTTP Request` |
| Method | `POST` |
| URL | `https://TU_PROJECT_REF.supabase.co/functions/v1/aviso-nueva-solicitud` |
| Headers | `Content-Type: application/json` y `x-aviso-webhook-secret: EL_MISMO_VALOR_DE_AVISO_WEBHOOK_SECRET` |
| Timeout | `5000` ms |

Guarda el webhook. No copies el valor del secreto en archivos, SQL, capturas ni conversaciones. El encabezado compartido permite que la función rechace llamadas directas que no procedan de tu webhook configurado.

## 5. Probar el envío

1. Abre `pages/registro.html`, completa el formulario y envíalo.
2. Confirma que la fila se crea en `public.solicitudes_alta_taller`.
3. Comprueba que llega el mensaje a `crodismedia@outlook.es`.
4. Si no llega, consulta **Edge Functions > aviso-nueva-solicitud > Logs** y la entrega del webhook en **Database > Webhooks**. La función no escribe el contenido de la solicitud ni secretos en los logs.

El webhook es asíncrono: un problema de correo no impide que se guarde la solicitud. Resend recibe una clave de idempotencia por solicitud para evitar correos duplicados ante reintentos cercanos.
