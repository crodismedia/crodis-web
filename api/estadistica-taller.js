import { supabaseRpc } from "../lib/server-utils.js";

const EVENTOS = new Set([
  "ficha_vista",
  "telefono",
  "como_llegar",
  "whatsapp",
  "web"
]);

function texto(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const slug = texto(body.slug, 180).toLowerCase();
    const evento = texto(body.evento, 40);
    const sessionId = texto(body.session_id, 100);
    const path = texto(body.path, 300);

    if (!/^[a-z0-9-]+$/.test(slug) || !EVENTOS.has(evento)) {
      return res.status(400).json({ ok: false });
    }

    const rows = await supabaseRpc("registrar_evento_taller", {
      p_slug: slug,
      p_evento: evento,
      p_session_id: sessionId || null,
      p_path: path || null
    });

    return res.status(200).json({
      ok: true,
      registrado: Boolean(rows?.[0]?.registrado)
    });
  } catch (error) {
    console.error("No se pudo registrar estadística de taller:", error);
    return res.status(500).json({ ok: false });
  }
}
