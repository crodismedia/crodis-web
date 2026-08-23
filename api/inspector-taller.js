import crypto from 'node:crypto';
import {
  escapeHTML,
  formatPhoneDisplay,
  safePhone,
  serviceLabel,
  supabaseRpc
} from '../lib/server-utils.js';

const SITE_URL = 'https://www.tallermap.es';
const GITHUB_RAW = 'https://raw.githubusercontent.com/crodismedia/crodis-web/main';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,180}$/;

function robotsMeta(html = '') {
  return html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] || '';
}

function canonicalHref(html = '') {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]
    || '';
}

function sha256(value = '') {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function digits(value = '') {
  return String(value).replace(/\D/g, '');
}

function timeTokens(schedule) {
  if (!schedule || typeof schedule !== 'object') return [];
  const out = [];
  for (const day of Object.values(schedule)) {
    for (const slot of Array.isArray(day?.turnos) ? day.turnos : []) {
      for (const value of [slot?.apertura, slot?.cierre]) {
        const token = String(value || '').trim();
        if (/^\d{2}:\d{2}$/.test(token)) out.push(token);
      }
    }
  }
  return [...new Set(out)];
}

function expectedChecks(workshop, html) {
  const checks = [];
  const add = (id, label, expected, ok) => checks.push({ id, label, expected, ok: Boolean(ok) });

  const name = String(workshop?.nombre || '').trim();
  if (name) add('nombre', 'Nombre coincide con Supabase', name, html.includes(escapeHTML(name)));

  const address = String(workshop?.direccion || '').trim();
  if (address) add('direccion', 'Dirección coincide con Supabase', address, html.includes(escapeHTML(address)));

  const cp = String(workshop?.codigo_postal || '').trim();
  if (cp) add('cp', 'Código postal coincide', cp, html.includes(escapeHTML(cp)));

  const city = String(workshop?.ciudad || '').trim();
  if (city) add('municipio', 'Municipio coincide', city, html.includes(escapeHTML(city)));

  const phone = safePhone(workshop?.telefono || '');
  if (phone) {
    const htmlDigits = digits(html);
    add('telefono', 'Teléfono coincide con Supabase', formatPhoneDisplay(phone), htmlDigits.includes(phone));
  }

  const services = Array.isArray(workshop?.servicios)
    ? workshop.servicios.map(serviceLabel).filter(Boolean)
    : [];
  if (services.length) {
    const missing = services.filter((service) => !html.includes(escapeHTML(service)));
    add('servicios', 'Servicios coinciden', `${services.length} servicio(s)`, missing.length === 0);
  }

  const times = timeTokens(workshop?.horarios);
  if (times.length) {
    const missing = times.filter((time) => !html.includes(time));
    add('horarios', 'Horario coincide', `${times.length} hora(s) comprobadas`, missing.length === 0);
  }

  return checks;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TallerMap-Inspector-Live/1.0' },
    cache: 'no-store'
  });
  const text = await response.text();
  return { response, text };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Método no permitido.' });
  }

  const slug = String(request.query?.slug || '').trim();
  if (!SLUG_RE.test(slug)) {
    return response.status(400).json({ error: 'Slug no válido.' });
  }

  try {
    const rows = await supabaseRpc('obtener_taller_publico', { p_id: null, p_slug: slug });
    const workshop = rows?.[0] || null;
    if (!workshop) {
      return response.status(404).json({ error: 'El taller no existe o no es público.', slug });
    }

    const publicUrl = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
    const dynamicUrl = `${SITE_URL}/api/taller-public?slug=${encodeURIComponent(slug)}&inspector=${Date.now()}`;
    const rawUrl = `${GITHUB_RAW}/talleres/${encodeURIComponent(slug)}/index.html`;

    const [publicPage, dynamicPage, staticPage] = await Promise.all([
      fetchText(`${publicUrl}?inspector=${Date.now()}`),
      fetchText(dynamicUrl),
      fetchText(rawUrl)
    ]);

    const canonical = `${SITE_URL}/talleres/${slug}`;
    const publicRobots = robotsMeta(publicPage.text);
    const staticRobots = robotsMeta(staticPage.text);
    const staticDataChecks = staticPage.response.ok ? expectedChecks(workshop, staticPage.text) : [];
    const publicDataChecks = publicPage.response.ok ? expectedChecks(workshop, publicPage.text) : [];

    const checks = [
      {
        id: 'public_http',
        label: 'Ficha pública responde',
        ok: publicPage.response.status === 200,
        detail: `HTTP ${publicPage.response.status}`
      },
      {
        id: 'static_file',
        label: 'HTML estático existe en GitHub',
        ok: staticPage.response.status === 200,
        detail: staticPage.response.status === 200 ? 'Archivo físico encontrado' : `HTTP ${staticPage.response.status}`
      },
      {
        id: 'renderer',
        label: 'Render dinámico responde',
        ok: dynamicPage.response.status === 200,
        detail: `HTTP ${dynamicPage.response.status}`
      },
      {
        id: 'robots',
        label: 'Ficha pública indexable',
        ok: publicPage.response.status === 200 && !/noindex/i.test(publicRobots) && /index/i.test(publicRobots),
        detail: publicRobots || 'Meta robots no encontrada'
      },
      {
        id: 'canonical',
        label: 'Canonical correcto',
        ok: canonicalHref(publicPage.text) === canonical,
        detail: canonicalHref(publicPage.text) || 'Canonical no encontrado'
      },
      {
        id: 'static_indexable',
        label: 'HTML estático sin noindex',
        ok: staticPage.response.status === 200 && !/noindex/i.test(staticRobots),
        detail: staticRobots || (staticPage.response.ok ? 'Sin noindex' : 'Archivo no disponible')
      },
      ...staticDataChecks.map((item) => ({
        id: `static_${item.id}`,
        label: `HTML estático · ${item.label}`,
        ok: item.ok,
        detail: item.expected
      })),
      ...publicDataChecks.map((item) => ({
        id: `public_${item.id}`,
        label: `Web pública · ${item.label}`,
        ok: item.ok,
        detail: item.expected
      }))
    ];

    const sameBody = publicPage.response.ok
      && staticPage.response.ok
      && sha256(publicPage.text) === sha256(staticPage.text);

    checks.push({
      id: 'served_static',
      label: 'La web está sirviendo el HTML físico',
      ok: sameBody,
      detail: sameBody ? 'Contenido idéntico al archivo de GitHub' : 'El contenido público difiere del HTML físico'
    });

    const failed = checks.filter((check) => !check.ok).length;
    const stale = staticDataChecks.some((check) => !check.ok) || !staticPage.response.ok;

    return response.status(200).json({
      slug,
      checked_at: new Date().toISOString(),
      public_url: publicUrl,
      static_url: rawUrl,
      summary: {
        ok: failed === 0,
        failed,
        total: checks.length,
        stale
      },
      checks
    });
  } catch (error) {
    console.error('Inspector Live:', error);
    return response.status(500).json({ error: error?.message || 'No se pudo ejecutar el Inspector Live.' });
  }
}
