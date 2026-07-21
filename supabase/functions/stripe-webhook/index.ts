import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fechaStripe(segundos: number | null | undefined): string | null {
  return segundos ? new Date(segundos * 1000).toISOString() : null;
}

async function guardarSuscripcion(
  subscription: Stripe.Subscription,
  evento: string,
  eventoCreado: number,
  forzarActivo?: boolean,
) {
  let solicitudId = Number(subscription.metadata?.solicitud_id ?? 0);
  if (!Number.isSafeInteger(solicitudId) || solicitudId < 1) {
    const { data } = await supabase
      .from("suscripciones_destacadas")
      .select("solicitud_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    solicitudId = Number(data?.solicitud_id ?? 0);
  }
  if (!Number.isSafeInteger(solicitudId) || solicitudId < 1) {
    throw new Error(`Suscripción ${subscription.id} sin solicitud_id`);
  }

  const estadoActivo = forzarActivo
    ?? ["active", "trialing"].includes(subscription.status);
  const item = subscription.items.data[0];
  const periodoFin = item?.current_period_end;
  const { error } = await supabase.rpc("registrar_estado_suscripcion_destacada", {
    p_solicitud_id: solicitudId,
    p_stripe_customer_id: typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id,
    p_stripe_subscription_id: subscription.id,
    p_estado: subscription.status,
    p_destacado_activo: estadoActivo,
    p_cancelar_fin_periodo: subscription.cancel_at_period_end,
    p_periodo_actual_fin: fechaStripe(periodoFin),
    p_evento: evento,
    p_evento_creado: eventoCreado,
  });
  if (error) throw error;
}

async function actualizarDesdeFactura(
  invoice: Stripe.Invoice,
  activo: boolean,
  evento: string,
  eventoCreado: number,
) {
  const invoiceCompatible = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionRef = invoiceCompatible.subscription
    ?? invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!subscriptionId) return;
  if (!stripe) throw new Error("Stripe no está configurado");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const puedeEstarActivo = activo && ["active", "trialing"].includes(subscription.status);
  await guardarSuscripcion(subscription, evento, eventoCreado, puedeEstarActivo);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
  if (!stripe || !webhookSecret || !serviceRoleKey) {
    return new Response("Configuración incompleta", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Falta la firma de Stripe", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("Firma de webhook no válida:", error);
    return new Response("Firma no válida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await guardarSuscripcion(subscription, event.type, event.created);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await guardarSuscripcion(
          event.data.object as Stripe.Subscription,
          event.type,
          event.created,
        );
        break;
      case "invoice.paid":
        await actualizarDesdeFactura(
          event.data.object as Stripe.Invoice,
          true,
          event.type,
          event.created,
        );
        break;
      case "invoice.payment_failed":
        await actualizarDesdeFactura(
          event.data.object as Stripe.Invoice,
          false,
          event.type,
          event.created,
        );
        break;
      default:
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("No se pudo procesar el webhook:", error);
    return new Response("Error procesando el evento", { status: 500 });
  }
});
