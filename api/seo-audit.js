export const config = { maxDuration: 60 };

const TARGET = 'https://www.tallermap.es';
const CORE_KEYWORDS = ['taller mecánico','talleres','mecánica','automóvil','coche','reparación','mantenimiento'];

async function requireAdmin(request) {
  const auth = String(request.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Sesión administrativa no disponible' };

  const supabaseUrl = process.env.SUPABASE_URL || 'https://cnyptelvbsndpkzbrete.supabase.co';
  const anon = process.env.SUPABASE_ANON_KEY || 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/es_administrador`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const admin = rpc.ok ? await rpc.json() : false;
  if (admin !== true) return { ok: false, status: 403, error: 'Acceso no autorizado' };
  return { ok: true };
}

function textContent(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function grade(score) {
  if (score >= 90) return 'A (Excelente)';
  if (score >= 80) return 'B (Bueno)';
  if (score >= 70) return 'C (Aceptable)';
  if (score >= 60) return 'D (Mejorable)';
  return 'F (Crítico)';
}

function auditHtml(html, url, statusCode) {
  let score = 100;
  const issues = [];
  const checks = { passed: 0, failed: 0, warnings: 0, total: 0 };
  const add = (type, message, severity = 'warning', element = null) => {
    issues.push({ type, message, severity, element });
    checks.total++;
    if (severity === 'error') { checks.failed++; score -= 3; }
    else if (severity === 'warning') { checks.warnings++; score -= 1; }
    else checks.passed++;
  };

  if (statusCode !== 200) add('general', `HTTP Status ${statusCode}`, 'error', 'status');
  else add('general', 'Página accesible por HTTP 200', 'info', 'status');

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
  if (!title) add('metadata', 'Tag <title> no encontrado', 'error', 'title');
  else {
    if (title.length < 30) add('metadata', `Title muy corto (${title.length} caracteres)`, 'warning', 'title');
    else if (title.length > 60) add('metadata', `Title muy largo (${title.length} caracteres)`, 'warning', 'title');
    else add('metadata', `Title correcto (${title.length} caracteres)`, 'info', 'title');
    if (!CORE_KEYWORDS.some(k => title.toLowerCase().includes(k))) add('metadata', 'El title no incluye una palabra clave principal', 'warning', 'title');
  }

  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || '';
  if (!description) add('metadata', 'Meta description no encontrada', 'warning', 'description');
  else {
    if (description.length < 70) add('metadata', `Description muy corta (${description.length} caracteres)`, 'warning', 'description');
    else if (description.length > 160) add('metadata', `Description muy larga (${description.length} caracteres)`, 'warning', 'description');
    else add('metadata', `Description correcta (${description.length} caracteres)`, 'info', 'description');
  }

  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || '';
  if (/noindex/i.test(robots)) add('metadata', 'La portada tiene noindex', 'error', 'robots');
  else add('metadata', robots ? `Robots: ${robots}` : 'Robots por defecto: index, follow', 'info', 'robots');

  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1]?.trim() || '';
  if (!canonical) add('metadata', 'No se encontró canonical', 'warning', 'canonical');
  else if (!canonical.includes('tallermap.es')) add('metadata', 'Canonical no apunta a tallermap.es', 'warning', 'canonical');
  else add('metadata', 'Canonical correcto', 'info', 'canonical');

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (!h1s.length) add('structure', 'No hay H1 en la página', 'error', 'h1');
  else if (h1s.length > 1) add('structure', `Hay ${h1s.length} H1`, 'warning', 'h1');
  else add('structure', 'Hay un único H1', 'info', 'h1');

  const plain = textContent(html);
  const words = plain.split(/\s+/).filter(Boolean).length;
  if (words < 300) add('content', `Poco contenido visible (${words} palabras)`, 'warning', 'content');
  else add('content', `Contenido suficiente (${words} palabras)`, 'info', 'content');

  const images = [...html.matchAll(/<img\b[^>]*>/gis)].map(m => m[0]);
  const withoutAlt = images.filter(tag => !/\balt\s*=/i.test(tag)).length;
  if (withoutAlt) add('images', `${withoutAlt} imágenes sin atributo alt`, 'error', 'img');
  else add('images', `${images.length} imágenes, todas con atributo alt`, 'info', 'img');

  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  const internal = links.filter(href => href.startsWith('/') || href.includes('tallermap.es'));
  if (!internal.length) add('links', 'No se encontraron enlaces internos', 'warning', 'links');
  else add('links', `${internal.length} enlaces internos detectados`, 'info', 'links');

  const ldJson = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  if (!ldJson.length) add('structured', 'No se encontraron datos estructurados JSON-LD', 'error', 'structured');
  else {
    let valid = 0;
    for (const match of ldJson) {
      try { JSON.parse(match[1]); valid++; } catch {}
    }
    if (!valid) add('structured', 'Los bloques JSON-LD encontrados no son JSON válido', 'error', 'structured');
    else add('structured', `${valid} bloque(s) JSON-LD válido(s)`, 'info', 'structured');
  }

  const keywordAnalysis = {};
  const lower = plain.toLowerCase();
  for (const keyword of CORE_KEYWORDS) {
    const count = lower.split(keyword).length - 1;
    keywordAnalysis[keyword] = count;
  }
  const missingCore = CORE_KEYWORDS.filter(k => keywordAnalysis[k] === 0);
  if (missingCore.length >= 5) add('keywords', `Faltan varias palabras clave núcleo: ${missingCore.slice(0,3).join(', ')}`, 'warning', 'keywords');
  else add('keywords', 'Cobertura básica de palabras clave presente', 'info', 'keywords');

  score = Math.max(0, Math.round(score));
  return {
    score,
    grade: grade(score),
    checks,
    issues,
    metadata: { title, description, robots: robots || 'index, follow', canonical },
    content: { words },
    images: { total: images.length, withoutAlt },
    links: { total: links.length, internal: internal.length },
    structuredData: { total: ldJson.length },
    keywordAnalysis,
    url
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    const started = Date.now();
    const res = await fetch(TARGET, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TallerMapSEOAuditor/1.0)' }
    });
    const html = await res.text();
    const result = auditHtml(html, res.url || TARGET, res.status);

    return response.status(200).json({
      ok: true,
      source: 'seo-auditor.js (adaptación V4 solo lectura)',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      ...result
    });
  } catch (error) {
    console.error('seo-audit', error);
    return response.status(500).json({ error: 'No se pudo ejecutar Auditor SEO', detail: error?.message || String(error) });
  }
}
