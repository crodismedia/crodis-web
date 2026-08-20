import { SUPABASE_URL, SUPABASE_KEY } from '../lib/server-utils.js';

function clean(value, max = 300) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { ok: false, error: 'Método no permitido' });
    return;
  }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const codigo = clean(body.codigo, 80).toUpperCase();
    const path = clean(body.path, 400);
    const slot = Number(body.slot);

    if (!/^TM-[A-Z0-9-]{6,70}$/.test(codigo) || ![1,2,3].includes(slot)) {
      json(res, 400, { ok: false, error: 'Datos de foto no válidos.' });
      return;
    }

    const safePrefix = `solicitudes/${codigo}/`;
    if (!path.startsWith(safePrefix) || !/\.(jpg|jpeg|png|webp)$/i.test(path)) {
      json(res, 400, { ok: false, error: 'Ruta de imagen no válida.' });
      return;
    }

    const field = `imagen_${slot}_path`;
    const url = new URL(`${SUPABASE_URL}/rest/v1/solicitudes_piezas`);
    url.searchParams.set('codigo', `eq.${codigo}`);

    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ [field]: path })
    });

    if (!r.ok) throw new Error(`Supabase PATCH ${r.status}`);
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) {
      json(res, 404, { ok: false, error: 'Solicitud no encontrada.' });
      return;
    }

    json(res, 200, { ok: true, path });
  } catch (error) {
    console.error('Error en adjuntar-foto-solicitud:', error);
    json(res, 500, { ok: false, error: 'No se pudo vincular la foto.' });
  }
}
