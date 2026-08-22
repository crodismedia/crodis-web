import { SUPABASE_URL } from '../lib/server-utils.js';

function clean(value, max = 300) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel');
  return key;
}

function serviceHeaders(extra = {}) {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra
  };
}

async function supabaseGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: serviceHeaders()
  });
  if (!r.ok) throw new Error(`Supabase GET ${r.status}`);
  return r.json();
}

async function supabaseInsert(table, payload) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Supabase INSERT ${r.status}: ${text.slice(0, 300)}`);
  }
  return r.json();
}

function code() {
  const now = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TM-${now}-${rnd}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { ok: false, error: 'Método no permitido' });
    return;
  }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const slug = clean(body.desguace_slug, 160).toLowerCase();
    const telefono = clean(body.telefono, 40);
    const pieza = clean(body.pieza, 200);

    if (!/^[a-z0-9-]{2,160}$/.test(slug) || !telefono || !pieza) {
      json(res, 400, { ok: false, error: 'Faltan datos obligatorios.' });
      return;
    }

    const desguaces = await supabaseGet(`desguaces?select=id,nombre,slug&slug=eq.${encodeURIComponent(slug)}&activo=eq.true&verificado=eq.true&limit=1`);
    const desguace = Array.isArray(desguaces) ? desguaces[0] : null;
    if (!desguace) {
      json(res, 404, { ok: false, error: 'Desguace no encontrado.' });
      return;
    }

    const fichas = await supabaseGet(`fichas_desguaces?select=id,desguace_id,habilitada&desguace_id=eq.${desguace.id}&limit=1`);
    const ficha = Array.isArray(fichas) ? fichas[0] : null;

    const anioRaw = clean(body.anio, 4);
    const anio = /^\d{4}$/.test(anioRaw) ? Number(anioRaw) : null;

    const payload = {
      codigo: code(),
      desguace_id: desguace.id,
      ficha_desguace_id: ficha?.habilitada ? ficha.id : null,
      nombre_cliente: clean(body.nombre_cliente, 120) || null,
      telefono,
      email: clean(body.email, 160) || null,
      marca: clean(body.marca, 100) || null,
      modelo: clean(body.modelo, 100) || null,
      anio,
      matricula: clean(body.matricula, 30) || null,
      motor_version: clean(body.motor_version, 120) || null,
      vin: clean(body.vin, 40) || null,
      pieza,
      lado: clean(body.lado, 60) || null,
      preferencia_pieza: clean(body.preferencia_pieza, 80) || null,
      referencia_pieza: clean(body.referencia_pieza, 100) || null,
      observaciones: clean(body.observaciones, 1500) || null,
      estado: 'recibida'
    };

    const rows = await supabaseInsert('solicitudes_piezas', payload);
    const created = Array.isArray(rows) ? rows[0] : null;
    json(res, 201, { ok: true, codigo: created?.codigo || payload.codigo, desguace: desguace.nombre });
  } catch (error) {
    console.error('Error en solicitar-pieza:', error);
    json(res, 500, { ok: false, error: 'No se pudo guardar la solicitud. Inténtalo de nuevo.' });
  }
}
