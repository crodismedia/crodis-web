import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = 'https://cnyptelvbsndpkzbrete.supabase.co';
const SUPABASE_KEY = 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
const SITE_URL = 'https://www.tallermap.es';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'talleres-temporal');
const LIMIT = 5000;

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safePhone(value) {
  const digits = String(value ?? '').replace(/[^0-9+]/g, '');
  return /^\+?[0-9]{6,15}$/.test(digits) ? digits : '';
}

function phoneDisplay(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 9) return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return clean(value, 30);
}

function safeUrl(value) {
  const text = clean(value, 500);
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function normalizeSlug(value) {
  return clean(value, 180).toLowerCase();
}

function scheduleHtml(schedule) {
  if (!schedule || typeof schedule !== 'object') return '<p>Horario no disponible.</p>';
  const days = [['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
  const items = [];
  for (const [key,label] of days) {
    const d = schedule[key];
    if (!d || typeof d !== 'object') continue;
    let value = '';
    if (d.cerrado === true) value = 'Cerrado';
    else if (Array.isArray(d.turnos)) {
      value = d.turnos.map(t => {
        const a = clean(t?.apertura, 10); const c = clean(t?.cierre, 10);
        return a && c ? `${a}–${c}` : '';
      }).filter(Boolean).join(' y ');
    }
    if (value) items.push(`<li><strong>${esc(label)}:</strong> ${esc(value)}</li>`);
  }
  return items.length ? `<ul class="horario">${items.join('')}</ul>` : '<p>Horario no disponible.</p>';
}

async function fetchRows() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/talleres`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'municipio.asc,nombre.asc');
  url.searchParams.set('limit', String(LIMIT));
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0,400)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function render(t) {
  const slug = normalizeSlug(t.slug);
  const name = clean(t.nombre || t.nombre_taller || 'Taller', 140);
  const municipality = clean(t.municipio || t.ciudad || t.localidad, 90);
  const province = clean(t.provincia, 90);
  const postal = clean(t.codigo_postal || t.cp, 20);
  const street = clean(t.direccion, 180);
  const address = [street, postal, municipality, province].filter(Boolean).join(', ');
  const phone = safePhone(t.telefono || t.telefono1 || t.movil);
  const web = safeUrl(t.web || t.sitio_web);
  const maps = safeUrl(t.google_maps_url || t.maps_url) || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}` : '');
  const description = clean(t.descripcion || `${name} es un taller de automoción en ${municipality || 'la Comunidad Valenciana'}. Consulta dirección, teléfono, horario y servicios publicados en TallerMap.`, 220);
  const services = Array.isArray(t.servicios) ? t.servicios.filter(Boolean).slice(0, 40) : [];
  const canonical = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
  const actions = [
    phone ? `<a href="tel:${esc(phone)}">${esc(phoneDisplay(phone))}</a>` : '',
    maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : '',
    web ? `<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : ''
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}${municipality ? ` en ${esc(municipality)}` : ''} | TallerMap</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
body{margin:0;background:#f5f7fa;color:#172033;font-family:Arial,sans-serif}.top{background:#fff;border-bottom:1px solid #e4e7ec}.wrap{max-width:1000px;margin:0 auto;padding:22px}.brand{color:#155eef;text-decoration:none;font-weight:800}.card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:24px;box-shadow:0 8px 22px rgba(16,24,40,.06)}h1{margin:0 0 8px;font-size:2rem}.local{color:#667085;font-size:.86rem;font-weight:700;text-transform:uppercase}.address{line-height:1.5}.services{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.services span{background:#f2f4f7;border-radius:999px;padding:6px 10px;font-size:.82rem}.actions{margin-top:18px}.actions a{color:#155eef;text-decoration:none;font-weight:700}.actions a:hover,.actions a:focus{text-decoration:underline}.grid{display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-top:18px}.data p{margin:0;padding:9px 0;border-bottom:1px solid #eaecf0}.horario{padding-left:20px}.horario li{margin:7px 0}.back{display:inline-block;margin-top:20px;color:#155eef;text-decoration:none;font-weight:700}@media(max-width:760px){.grid{grid-template-columns:1fr}h1{font-size:1.55rem}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/">TallerMap</a></div></header>
<main class="wrap">
<article class="card">
${municipality || province ? `<div class="local">${esc([municipality,province].filter(Boolean).join(' · '))}</div>` : ''}
<h1>${esc(name)}</h1>
${address ? `<p class="address"><strong>Dirección:</strong><br>${esc(address)}</p>` : ''}
<p>${esc(description)}</p>
${services.length ? `<div class="services">${services.map(s => `<span>${esc(clean(s,90))}</span>`).join('')}</div>` : ''}
${actions ? `<p class="actions">${actions}</p>` : ''}
</article>
<div class="grid">
<section class="card data"><h2>Datos del taller</h2>
<p><strong>Nombre:</strong> ${esc(name)}</p>
${municipality ? `<p><strong>Municipio:</strong> ${esc(municipality)}</p>` : ''}
${province ? `<p><strong>Provincia:</strong> ${esc(province)}</p>` : ''}
${postal ? `<p><strong>Código postal:</strong> ${esc(postal)}</p>` : ''}
${phone ? `<p><strong>Teléfono:</strong> <a href="tel:${esc(phone)}">${esc(phoneDisplay(phone))}</a></p>` : ''}
<h3>Horario</h3>${scheduleHtml(t.horarios || t.horario)}
</section>
<aside class="card"><h2>Servicios</h2>${services.length ? `<ul>${services.map(s => `<li>${esc(clean(s,90))}</li>`).join('')}</ul>` : '<p>Servicios no publicados.</p>'}</aside>
</div>
<a class="back" href="/">← Volver a TallerMap</a>
</main>
</body>
</html>`;
}

function resetDir() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const rows = await fetchRows();
if (!rows.length) throw new Error('No se encontraron talleres en Supabase.');
resetDir();
let generated = 0;
let skipped = 0;
for (const row of rows) {
  const slug = normalizeSlug(row.slug);
  if (!/^[a-z0-9-]{2,180}$/.test(slug)) { skipped += 1; continue; }
  const dir = path.join(OUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(row), 'utf8');
  generated += 1;
}
fs.writeFileSync(path.join(OUT_DIR, '_GENERACION.txt'), `Generadas: ${generated}\nOmitidas por slug inválido: ${skipped}\nOrigen: Supabase tabla talleres\nSin API pública ni constructor de fichas en tiempo de visita.\n`, 'utf8');
console.log(`OK: ${generated} fichas HTML estáticas limpias en talleres-temporal/; omitidas: ${skipped}`);
