type Solicitud = {
  id?: number | string;
  nombre_taller?: string;
  propietario?: string;
  cif?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  descripcion?: string;
  created_at?: string;
};

type WebhookPayload = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: Solicitud;
};

const DESTINATARIO = "crodismedia@outlook.es";
const encoder = new TextEncoder();

function texto(valor: unknown): string {
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : "No indicado";
}

function escaparHtml(valor: unknown): string {
  return texto(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sonIgualesEnTiempoConstante(a: string, b: string): boolean {
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  let diferencia = bytesA.length ^ bytesB.length;
  const longitud = Math.max(bytesA.length, bytesB.length);

  for (let indice = 0; indice < longitud; indice += 1) {
    diferencia |= (bytesA[indice] ?? 0) ^ (bytesB[indice] ?? 0);
  }

  return diferencia === 0;
}

function fechaSolicitud(valor: unknown): string {
  const fecha = new Date(texto(valor));
  return Number.isNaN(fecha.getTime()) ? texto(valor) : fecha.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
}

function crearEmail(solicitud: Solicitud) {
  const campos: Array<[string, unknown]> = [
    ["Nombre del taller", solicitud.nombre_taller],
    ["Propietario/a", solicitud.propietario],
    ["CIF", solicitud.cif],
    ["Email", solicitud.email],
    ["Teléfono", solicitud.telefono],
    ["Dirección", solicitud.direccion],
    ["Código postal", solicitud.codigo_postal],
    ["Ciudad", solicitud.ciudad],
    ["Provincia", solicitud.provincia],
    ["Descripción", solicitud.descripcion],
    ["Fecha de solicitud", fechaSolicitud(solicitud.created_at)],
  ];

  const htmlFilas = campos.map(([etiqueta, valor]) =>
    `<tr><th align="left" style="padding:8px;border:1px solid #dfe6ef;background:#f5f7fb">${escaparHtml(etiqueta)}</th><td style="padding:8px;border:1px solid #dfe6ef;white-space:pre-wrap">${escaparHtml(valor)}</td></tr>`
  ).join("");
  const textoPlano = campos.map(([etiqueta, valor]) => `${etiqueta}: ${texto(valor)}`).join("\n");

  return {
    subject: `Nueva solicitud de taller: ${texto(solicitud.nombre_taller)}`,
    html: `<h1>Nueva solicitud de alta de taller</h1><table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${htmlFilas}</table>`,
    text: `Nueva solicitud de alta de taller\n\n${textoPlano}`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  const secretoWebhook = Deno.env.get("AVISO_WEBHOOK_SECRET");
  const secretoRecibido = req.headers.get("x-aviso-webhook-secret");
  if (!secretoWebhook || !secretoRecibido || !sonIgualesEnTiempoConstante(secretoRecibido, secretoWebhook)) {
    return new Response("No autorizado", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.schema !== "public" || payload.table !== "solicitudes_alta_taller" || !payload.record) {
    return new Response("Evento no válido", { status: 400 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const remitente = Deno.env.get("RESEND_FROM_EMAIL");
  if (!resendApiKey || !remitente) {
    console.error("Faltan secretos de configuración de correo.");
    return new Response("Configuración de correo no disponible", { status: 500 });
  }

  const email = crearEmail(payload.record);
  const respuestaResend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "TallerMap-Supabase-Edge-Function",
      "Idempotency-Key": `solicitud-alta-${texto(payload.record.id)}`,
    },
    body: JSON.stringify({ from: remitente, to: [DESTINATARIO], ...email }),
  });

  if (!respuestaResend.ok) {
    console.error("Resend rechazó el envío:", respuestaResend.status);
    return new Response("No se pudo enviar el aviso", { status: 502 });
  }

  return Response.json({ ok: true });
});
