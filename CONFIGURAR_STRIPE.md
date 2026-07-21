# Activar el Plan Destacado de TallerMap

El código está preparado para una suscripción opcional de **1,21 € al mes, IVA incluido**, sin prueba gratuita. La presencia básica continúa siendo gratuita. Nunca copies una clave privada de Stripe dentro de `index.html`, `js/` o GitHub.

## 1. Crear Stripe en modo de prueba

1. Crea la cuenta en <https://dashboard.stripe.com/register>.
2. Mantén activado el modo de prueba o Sandbox hasta terminar todas las comprobaciones.
3. Completa los datos públicos del negocio, incluida la dirección de las condiciones del servicio: `https://www.tallermap.es/pages/condiciones-destacado.html`.

## 2. Crear producto, precio e IVA

1. En **Product catalog**, crea `TallerMap · Plan Destacado`.
2. Crea un precio recurrente de **1,21 EUR cada mes**, sin periodo de prueba, con comportamiento fiscal **IVA incluido**. Copia su identificador `price_...`.
3. En **Tax rates**, crea una tasa de España del **21 %**, inclusiva, con nombre `IVA` y descripción `IVA España`. Copia su identificador `txr_...`.

El precio no se escribe desde el navegador: las Edge Functions utilizan esos identificadores privados para impedir que alguien cambie el importe.

## 3. Preparar Supabase

1. Ejecuta completo `supabase/suscripcion_destacada.sql` en **Supabase > SQL Editor**.
2. En **Edge Functions > Secrets**, crea:
   - `STRIPE_SECRET_KEY`: clave privada de prueba `sk_test_...`.
   - `STRIPE_PRICE_ID`: identificador `price_...` de 1,21 EUR/mes.
   - `STRIPE_TAX_RATE_ID`: identificador `txr_...` del IVA inclusivo del 21 %.
   - `SITE_URL`: `https://www.tallermap.es`.
3. En **Supabase > Edge Functions**, crea `crear-pago-destacado`, pega el contenido de `supabase/functions/crear-pago-destacado/index.ts` y desactiva **Verify JWT**.
4. Crea `stripe-webhook`, pega el contenido de `supabase/functions/stripe-webhook/index.ts` y desactiva también **Verify JWT**. El Checkout se protege con el token secreto del alta y el webhook con la firma de Stripe.

## 4. Conectar el webhook firmado

1. En Stripe, abre **Developers > Webhooks** y añade:
   `https://cnyptelvbsndpkzbrete.supabase.co/functions/v1/stripe-webhook`
2. Selecciona estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
3. Copia el secreto de firma `whsec_...` y guárdalo en Supabase como `STRIPE_WEBHOOK_SECRET`.
4. Vuelve a desplegar `stripe-webhook` si Supabase lo solicita.

## 5. Probar antes de cobrar

1. Registra un taller de prueba y elige **Plan Destacado**.
2. En Stripe Checkout utiliza la tarjeta de prueba `4242 4242 4242 4242`, una fecha futura y cualquier CVC válido.
3. Comprueba en `public.suscripciones_destacadas` que `estado` es `active` y `destacado_activo` es `true`.
4. Busca la población del taller: debe aparecer con la etiqueta **Destacado** dentro de los veinte primeros puestos.
5. Simula una cancelación: la prioridad se conserva hasta el final del periodo ya pagado; después la ficha continúa gratuitamente.

No actives las claves reales hasta completar estas pruebas y configurar el portal de clientes de Stripe para que puedan cancelar su suscripción.
