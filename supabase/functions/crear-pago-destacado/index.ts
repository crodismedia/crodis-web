import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tallermap.es",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripePriceId = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const stripeTaxRateId = Deno.env.get("STRIPE_TAX_RATE_ID") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.tallermap.es").replace(/\/$/, "");

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);
  if (!stripe || !stripePriceId || !stripeTaxRateId || !serviceRoleKey) {
    return jsonResponse({ error: "El pago todavía no está configurado." }, 503);
  }

  try {
    const body = await request.json();
    const tokenGestion = String(body?.tokenGestion ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokenGestion)) {
      return jsonResponse({ error: "Identificador de alta no válido." }, 400);
    }

    const { data: solicitud, error: errorSolicitud } = await supabase
      .from("solicitudes_alta_taller")
      .select("id,nombre_taller,email,plan_publicacion,acepta_condiciones_destacado")
      .eq("token_gestion", tokenGestion)
      .maybeSingle();

    if (errorSolicitud || !solicitud) {
      return jsonResponse({ error: "No se encontró el alta asociada." }, 404);
    }
    if (solicitud.plan_publicacion !== "destacado" || !solicitud.acepta_condiciones_destacado) {
      return jsonResponse({ error: "El alta no ha solicitado el plan Destacado." }, 409);
    }

    const { data: suscripcionExistente } = await supabase
      .from("suscripciones_destacadas")
      .select("stripe_customer_id,stripe_subscription_id,destacado_activo")
      .eq("solicitud_id", solicitud.id)
      .maybeSingle();

    if (suscripcionExistente?.destacado_activo) {
      return jsonResponse({ error: "Este taller ya tiene una suscripción activa." }, 409);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      locale: "es",
      customer: suscripcionExistente?.stripe_customer_id || undefined,
      customer_email: suscripcionExistente?.stripe_customer_id ? undefined : solicitud.email,
      client_reference_id: String(solicitud.id),
      line_items: [{ price: stripePriceId, quantity: 1, tax_rates: [stripeTaxRateId] }],
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      allow_promotion_codes: false,
      success_url: `${siteUrl}/pages/pago-confirmado.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pages/registro.html?pago=cancelado`,
      metadata: { solicitud_id: String(solicitud.id), plan: "destacado" },
      subscription_data: {
        metadata: { solicitud_id: String(solicitud.id), plan: "destacado" },
      },
    });

    if (!session.url) return jsonResponse({ error: "Stripe no devolvió una dirección de pago." }, 502);
    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("Error creando Checkout:", error);
    return jsonResponse({ error: "No se pudo iniciar el pago seguro." }, 500);
  }
});
