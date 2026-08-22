import { SUPABASE_URL } from '../lib/server-utils.js';

function clean(value, max = 200) {
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

function serviceHeaders() {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

function estadoLabel(value) {
  const labels = {
    recibida: 'Solicitud recibida',
    en_revision: 'En revisión',
    'en-revision': 'En revisión',
    disponible: 'Pieza disponible',
    no_disponible: 'Pieza no disponible',
    'no-disponible': 'Pieza no disponible',
    cerrada: 'Solicitud cerrada'
  };
  return labels[value] || clean(value, 60) || 'Solicitud recibida';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    json(res, 405, { ok: false, error: 'Método no permitido' });
    return;
  }

  const codigo = clean(req.query?.codigo, 80).toUpperCase();
  if (!/^TM-[A-Z0-9-]{6,70}$/.test(codigo)) {
    json(res, 400, { ok: false, error: 'Código de solicitud no válido.' });
    return;
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/solicitudes_piezas`);
    url.searchParams.set('select', 'codigo,estado,marca,modelo,anio,pieza,resultado,entrega,precio,gastos_envio,created_at,desguaces(nombre,slug)');
    url.searchParams.set('codigo', `eq.${codigo}`);
    url.searchParams.set('limit', '1');

    const r = await fetch(url, { headers: serviceHeaders() });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    const rows = await r.json();
    const s = Array.isArray(rows) ? rows[0] : null;

    if (!s) {
      json(res, 404, { ok: false, error: 'No encontramos una solicitud con ese código.' });
      return;
    }

    json(res, 200, {
      ok: true,
      solicitud: {
        codigo: s.codigo,
        estado: clean(s.estado, 60),
        estado_label: estadoLabel(s.estado),
        marca: clean(s.marca, 100) || null,
        modelo: clean(s.modelo, 100) || null,
        anio: s.anio || null,
        pieza: clean(s.pieza, 200),
        resultado: clean(s.resultado, 500) || null,
        entrega: clean(s.entrega, 200) || null,
        precio: s.precio ?? null,
        gastos_envio: s.gastos_envio ?? null,
        created_at: s.created_at,
        desguace: clean(s.desguaces?.nombre, 140) || null,
        desguace_slug: clean(s.desguaces?.slug, 160) || null
      }
    });
  } catch (error) {
    console.error('Error en estado-solicitud:', error);
    json(res, 500, { ok: false, error: 'No se pudo consultar la solicitud. Inténtalo de nuevo.' });
  }
}
