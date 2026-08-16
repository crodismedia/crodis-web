const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function htmlPage({ title, body, status = 200 }) {
  return { status, html: `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} | TallerMap</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f6f8fb;color:#172033;font-family:Arial,sans-serif}.top{background:#fff;border-bottom:1px solid #dbe3ec;padding:18px}.top a{font-weight:900;color:#14213d;text-decoration:none}.wrap{max-width:760px;margin:38px auto;padding:0 16px}.card{background:#fff;border:1px solid #dbe3ec;border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(15,35,65,.05)}h1{margin-top:0;font-size:clamp(1.8rem,5vw,2.5rem)}.muted{color:#64748b}.field{display:grid;gap:6px;margin:15px 0}.field label{font-weight:800}.field input,.field select{width:100%;padding:12px;border:1px solid #b9c5d3;border-radius:9px;font:inherit}.btn{display:inline-block;border:0;border-radius:9px;background:#0756bd;color:#fff;font-weight:900;padding:12px 18px;cursor:pointer}.notice{padding:12px 14px;border-radius:10px;background:#eef5ff;border:1px solid #bfd7f7;margin:15px 0}.error{background:#fff1f2;border-color:#fecdd3;color:#9f1239}.ok{background:#ecfdf3;border-color:#bbf7d0;color:#166534}.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}</style></head><body><header class="top"><a href="/">TallerMap · Desguaces</a></header><main class="wrap">${body}</main></body></html>` };
}

function send(res, page) {
  res.statusCode = page.status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(page.html);
}

async function serviceFetch(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Vercel");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) };
  return fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
}

async function getDesguace(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const r = await serviceFetch(`/rest/v1/desguaces?id=eq.${encodeURIComponent(id)}&select=id,nombre,municipio,provincia&limit=1`);
  if (!r.ok) throw new Error(`No se pudo cargar el desguace (${r.status})`);
  const rows = await r.json();
  return rows[0] || null;
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

async function createAuthUser(email, password, nombre) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { nombre, tipo_cuenta: "desguace" } })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.msg || data?.message || "No se pudo crear la cuenta");
  if (!data?.user?.id) throw new Error("No se pudo obtener el usuario creado");
  return data.user;
}

async function insertAccess({ desguaceId, userId, nombre, telefono, email }) {
  const r = await serviceFetch(`/rest/v1/desguace_usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      desguace_id: desguaceId,
      user_id: userId,
      nombre_contacto: nombre,
      telefono: telefono || null,
      email,
      rol: "propietario",
      estado: "pendiente"
    })
  });
  const text = await r.text();
  if (!r.ok) {
    if (r.status === 409) throw new Error("Ya existe una solicitud de acceso para esta cuenta y este desguace");
    throw new Error(`No se pudo registrar la solicitud: ${text.slice(0, 220)}`);
  }
}

function form(desguace, message = "", type = "") {
  const notice = message ? `<div class="notice ${esc(type)}">${esc(message)}</div>` : "";
  return htmlPage({ title: "Solicitar acceso", body: `<section class="card"><p class="muted">Acceso profesional</p><h1>Solicitar acceso a ${esc(desguace.nombre)}</h1><p class="muted">${esc(desguace.municipio)} · ${esc(desguace.provincia)}</p>${notice}<p>Tu cuenta se creará ahora, pero <strong>no podrás gestionar la ficha hasta que TallerMap apruebe tu solicitud</strong>.</p>
<form method="post" action="/api/desguaces-solicitar-acceso">
<input type="hidden" name="desguace_id" value="${esc(desguace.id)}">
<div class="hp" aria-hidden="true"><label>Empresa<input name="empresa_web" tabindex="-1" autocomplete="off"></label></div>
<div class="field"><label for="nombre">Nombre y apellidos</label><input id="nombre" name="nombre" maxlength="120" required autocomplete="name"></div>
<div class="field"><label for="telefono">Teléfono</label><input id="telefono" name="telefono" maxlength="30" autocomplete="tel"></div>
<div class="field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" maxlength="160" required autocomplete="email"></div>
<div class="field"><label for="password">Contraseña</label><input id="password" name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"><small class="muted">Mínimo 8 caracteres.</small></div>
<div class="field"><label><input type="checkbox" name="declaracion" value="si" required> Declaro que estoy autorizado para solicitar la gestión de este desguace.</label></div>
<button class="btn" type="submit">Crear cuenta y solicitar acceso</button></form></section>` });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const desguace = await getDesguace(req.query?.id);
      if (!desguace) return send(res, htmlPage({ title: "Solicitud no disponible", status: 404, body: `<section class="card"><h1>Solicitud no disponible</h1><p>Esta página debe abrirse desde la ficha concreta de un desguace.</p><a href="/">Volver a TallerMap</a></section>` }));
      return send(res, form(desguace));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return send(res, htmlPage({ title: "Método no permitido", status: 405, body: `<section class="card"><h1>Método no permitido</h1></section>` }));
    }

    const b = readBody(req);
    const desguace = await getDesguace(b.desguace_id);
    if (!desguace) return send(res, htmlPage({ title: "Desguace no encontrado", status: 404, body: `<section class="card"><h1>Desguace no encontrado</h1></section>` }));
    if (String(b.empresa_web || "").trim()) return send(res, form(desguace, "No se pudo procesar la solicitud.", "error"));

    const nombre = String(b.nombre || "").trim().slice(0, 120);
    const telefono = String(b.telefono || "").trim().slice(0, 30);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const password = String(b.password || "");
    if (!nombre || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || b.declaracion !== "si") {
      return send(res, form(desguace, "Revisa los campos obligatorios y vuelve a intentarlo.", "error"));
    }

    const user = await createAuthUser(email, password, nombre);
    await insertAccess({ desguaceId: desguace.id, userId: user.id, nombre, telefono, email });

    return send(res, htmlPage({ title: "Solicitud enviada", body: `<section class="card"><div class="notice ok"><strong>Solicitud registrada correctamente.</strong></div><h1>Acceso pendiente de aprobación</h1><p>Hemos registrado tu solicitud para <strong>${esc(desguace.nombre)}</strong>.</p><p>Tu cuenta no tendrá permisos sobre la ficha hasta que TallerMap la revise y la apruebe.</p><p class="muted">Si Supabase solicita confirmar tu correo electrónico, completa también esa verificación.</p><a class="btn" href="/">Volver a TallerMap</a></section>` }));
  } catch (error) {
    console.error("desguaces-solicitar-acceso", error);
    return send(res, htmlPage({ title: "No se pudo completar", status: 400, body: `<section class="card"><div class="notice error">${esc(error?.message || "No se pudo completar la solicitud")}</div><h1>No se pudo completar</h1><p>Vuelve a la ficha del desguace y prueba de nuevo.</p></section>` }));
  }
}
