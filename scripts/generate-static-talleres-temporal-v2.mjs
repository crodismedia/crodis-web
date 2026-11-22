import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// TallerMap: generador de fichas estÃ¡ticas y auditorÃ­a SEO.
// No modifica Supabase, las fichas pÃºblicas, el sitemap ni vercel.json.
// Uso: node scripts/generate-static-talleres-temporal-v2.mjs [--dry-run]
const ROOT = process.cwd();
const U = process.env.SUPABASE_URL || 'https://cnyptelvbsndpkzbrete.supabase.co';
const K = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
const S = 'https://www.tallermap.es';
const O = path.join(ROOT, 'talleres-temporal');
const PUBLIC = path.join(ROOT, 'talleres');
const REPORT = path.join(ROOT, 'auditoria-talleres-temporal.json');
const PAGE = 500;
const DRY_RUN = process.argv.includes('--dry-run');

function clean(v, max = Infinity) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function escapeHTML(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function short(v, max) {
  const text = clean(v);
  if (text.length <= max) return text;
  const chunk = text.slice(0, max - 1);
  const cut = chunk.lastIndexOf(' ');
  return (cut > max * 0.65 ? chunk.slice(0, cut) : chunk).trimEnd() + 'â€¦';
}
function normalize(v) {
  return clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function slugOf(t) {
  const slug = clean(t.slug).toLowerCase();
  return /^[a-z0-9-]{2,180}$/.test(slug) ? slug : '';
}
function canonical(slug) { return `${S}/talleres/${encodeURIComponent(slug)}`; }
function phone(v) {
  const s = clean(v).replace(/[\s().-]/g, '');
  return /^\+?[0-9]{6,15}$/.test(s) ? s : '';
}
function phoneKey(v) {
  const d = phone(v).replace(/^\+/, '');
  return d.length === 11 && d.startsWith('34') ? d.slice(2) : d;
}
function displayPhone(v) {
  return /^\d{9}$/.test(v) ? v.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : v;
}
function safeURL(v) {
  const s = clean(v, 2000);
  if (!s || (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s))) return '';
  try {
    const x = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return ['http:', 'https:'].includes(x.protocol) && !x.username && !x.password ? x.href : '';
  } catch { return ''; }
}
function services(t) {
  if (!Array.isArray(t.servicios)) return [];
  return [...new Set(t.servicios.filter(v => typeof v === 'string')
    .map(v => clean(v, 120)).filter(Boolean))].slice(0, 40);
}
function serviceLabel(v) {
  const s = v.replace(/[-_]+/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function schedule(h) {
  if (!h || typeof h !== 'object') return '<p>Horario no disponible.</p>';
  const days = [['lunes','Lunes'],['martes','Martes'],['miercoles','MiÃ©rcoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','SÃ¡bado'],['domingo','Domingo']];
  const items = [];
  for (const [key,label] of days) {
    const d = h[key] ?? h[label.toLowerCase()];
    if (!d || typeof d !== 'object') continue;
    const value = d.cerrado === true ? 'Cerrado' : Array.isArray(d.turnos)
      ? d.turnos.map(t => t?.apertura && t?.cierre ? `${clean(t.apertura,10)}â€“${clean(t.cierre,10)}` : '').filter(Boolean).join(' y ') : '';
    if (value) items.push(`<li><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value)}</li>`);
  }
  return items.length ? `<ul>${items.join('')}</ul>` : '<p>Horario no disponible.</p>';
}
function view(t) {
  const name = clean(t.nombre || t.nombre_taller || 'Taller', 180);
  const city = clean(t.ciudad || t.localidad, 120);
  const province = clean(t.provincia, 80);
  const cp = clean(t.codigo_postal || t.cp, 20);
  const street = clean(t.direccion, 250);
  const address = [street, cp, city, province].filter(Boolean).join(', ');
  const ph = [t.telefono, t.telefono1, t.movil].map(phone).find(Boolean) || '';
  const web = [t.web, t.sitio_web].map(safeURL).find(Boolean) || '';
  const maps = [t.google_maps_url,t.maps_url].map(safeURL).find(Boolean) || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}, EspaÃ±a`)}` : '');
  return { id: clean(t.id), slug: slugOf(t), name, city, province, cp, street, address, ph, web, maps, sv: services(t), description: clean(t.descripcion, 2500), horario: t.horarios || t.horario };
}
function seoTitle(v) {
  const suffix = ' | TallerMap';
  const local = v.city && !normalize(v.name).endsWith(normalize(v.city)) ? ` en ${v.city}` : '';
  if ((v.name + local + suffix).length <= 65) return v.name + local + suffix;
  if (local && local.length + suffix.length < 48) return short(v.name, 65 - local.length - suffix.length) + local + suffix;
  return short(v.name + local, 65 - suffix.length) + suffix;
}
function seoDescription(v) {
  const locality = [v.city, v.province && normalize(v.city) !== normalize(v.province) ? v.province : ''].filter(Boolean).join(', ');
  const fields = [v.street && 'direcciÃ³n', v.ph && 'telÃ©fono', v.horario && 'horario', v.sv.length && 'servicios'].filter(Boolean);
  const prefix = `${v.name}${locality ? ` en ${locality}` : ''}.`;
  const details = fields.length ? ` Consulta ${fields.join(', ')} en TallerMap.` : ' Consulta su ficha en TallerMap.';
  // El corte es editorial; Google puede mostrar un fragmento diferente.
  return short(prefix + details, 155);
}
function html(t) {
  const v = view(t);
  const e = escapeHTML;
  const title = seoTitle(v), desc = seoDescription(v), url = canonical(v.slug);
  const actions = [v.ph ? `<a href="tel:${e(v.ph)}">${e(displayPhone(v.ph))}</a>` : '', v.maps ? `<a href="${e(v.maps)}" target="_blank" rel="noopener noreferrer">CÃ³mo llegar</a>` : '', v.web ? `<a href="${e(v.web)}" target="_blank" rel="noopener noreferrer">Web</a>` : ''].filter(Boolean).join(' Â· ');
  const locality = [v.city,v.province].filter(Boolean).join(' Â· ');
  const municipalCode = clean(t.codigo_municipal);
  const municipalityLink = /^\d{5}$/.test(municipalCode) ? municipalityURL(municipalCode) : '';
  const bodyDescription = v.description || `${v.name}${v.city ? ` en ${v.city}` : ''}. Consulta los datos disponibles de este establecimiento en TallerMap.`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(url)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>body{margin:0;background:#f5f7fa;color:#172033;font-family:Arial,sans-serif;line-height:1.5}.w{max-width:1000px;margin:auto;padding:22px}.c{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:24px;margin:18px 0}.l{color:#667085;font-weight:700;text-transform:uppercase}.s{display:flex;flex-wrap:wrap;gap:8px}.s span{background:#f2f4f7;border-radius:999px;padding:6px 10px}.a a,.b{color:#155eef;text-decoration:none;font-weight:700}.a a:hover,.b:hover{text-decoration:underline}a:focus-visible{outline:2px solid #155eef;outline-offset:3px}h1{overflow-wrap:anywhere}</style>
</head>
<body><main class="w">
<nav aria-label="NavegaciÃ³n"><a class="b" href="/">TallerMap</a>${municipalityLink ? ` Â· <a class="b" href="${e(municipalityLink)}">Talleres en ${e(v.city)}</a>` : ''}</nav>
<article class="c">
${locality ? `<div class="l">${e(locality)}</div>` : ''}
<h1>${e(v.name)}</h1>
${v.address ? `<p><strong>DirecciÃ³n:</strong><br>${e(v.address)}</p>` : ''}
<p>${e(bodyDescription)}</p>
${v.sv.length ? `<div class="s">${v.sv.map(x => `<span>${e(serviceLabel(x))}</span>`).join('')}</div>` : ''}
${actions ? `<p class="a">${actions}</p>` : ''}
</article>
<section class="c"><h2>Datos del taller</h2>
<p><strong>Nombre:</strong> ${e(v.name)}</p>
${v.city ? `<p><strong>Municipio:</strong> ${e(v.city)}</p>` : ''}
${v.province ? `<p><strong>Provincia:</strong> ${e(v.province)}</p>` : ''}
${v.cp ? `<p><strong>CÃ³digo postal:</strong> ${e(v.cp)}</p>` : ''}
${v.ph ? `<p><strong>TelÃ©fono:</strong> <a href="tel:${e(v.ph)}">${e(displayPhone(v.ph))}</a></p>` : ''}
<h3>Horario</h3>${schedule(v.horario)}</section>
${v.sv.length ? `<section class="c"><h2>Servicios</h2><ul>${v.sv.map(x => `<li>${e(serviceLabel(x))}</li>`).join('')}</ul></section>` : ''}
</main></body></html>\n`;
}
let municipalityFiles;
function municipalityURL(code) {
  if (!municipalityFiles) {
    municipalityFiles = new Map();
    const folder = path.join(ROOT, 'municipios');
    if (fs.existsSync(folder)) for (const name of fs.readdirSync(folder)) {
      const match = name.match(/^[a-z0-9-]+-(\d{5})\.html$/i);
      if (match) municipalityFiles.set(match[1], `/municipios/${name}`);
    }
  }
  return municipalityFiles.get(code) || '';
}
async function rows(fetcher = fetch) {
  const all = [], ids = new Set();
  let offset = 0, expected = null;
  // Avanza por el tamaÃ±o real recibido; no presupone el lÃ­mite del servidor.
  while (true) {
    const url = new URL(`${U.replace(/\/$/, '')}/rest/v1/talleres`);
    url.searchParams.set('select','*');
    url.searchParams.set('order','id.asc');
    url.searchParams.set('limit',String(PAGE));
    url.searchParams.set('offset',String(offset));
    const headers = { apikey: K, Accept: 'application/json' };
    if (offset === 0) headers.Prefer = 'count=exact';
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,300)}`);
    if (offset === 0) {
      const count = response.headers.get('content-range')?.match(/\/(\d+)$/);
      if (count) expected = Number(count[1]);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Respuesta de Supabase no vÃ¡lida.');
    if (!batch.length) break;
    for (const t of batch) {
      const id = clean(t?.id);
      if (!id || ids.has(id)) throw new Error(`ID ausente o repetido en paginaciÃ³n: ${id || '(vacÃ­o)'}.`);
      ids.add(id); all.push(t);
    }
    offset += batch.length;
    console.log(`Supabase: ${offset} talleres cargados`);
    if (expected !== null && offset >= expected) break;
  }
  if (!all.length) throw new Error('Supabase devolviÃ³ cero talleres. No se sustituye la generaciÃ³n anterior.');
  if (expected !== null && all.length !== expected) throw new Error(`Lectura incompleta: ${all.length} de ${expected}.`);
  return all;
}
function group(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
function summary(v) {
  return { id:v.id, slug:v.slug, nombre:v.name, municipio:v.city, provincia:v.province, direccion:v.street, codigo_postal:v.cp, telefono:v.ph, url:v.slug ? canonical(v.slug) : null };
}
function existingPublicSlugs() {
  if (!fs.existsSync(PUBLIC)) return [];
  return fs.readdirSync(PUBLIC,{withFileTypes:true}).filter(d => d.isDirectory() && fs.existsSync(path.join(PUBLIC,d.name,'index.html'))).map(d => d.name).sort();
}
function audit(data) {
  const bySlug = new Map(), byName = new Map(), byPhone = new Map(), byAddress = new Map();
  const invalid = [], usable = [];
  for (const t of data) {
    const v = view(t);
    if (!v.slug) { invalid.push(summary(v)); continue; }
    usable.push(t);
    group(bySlug, v.slug, v);
    // Mismo nombre o telÃ©fono en la misma localidad: solo candidatos.
    const locality = normalize(v.city) && (normalize(v.province) || /^\d{5}$/.test(v.cp)) ? `${normalize(v.city)}|${normalize(v.province) || v.cp.slice(0,2)}` : '';
    const name = normalize(v.name).replace(/\b(s l u|s l|s a|c b|s c|slu|sl|sa|cb|sc)$/, '').trim();
    if (locality && name) group(byName, `${locality}|${name}`, v);
    if (locality && phoneKey(v.ph)) group(byPhone, `${locality}|${phoneKey(v.ph)}`, v);
    if (locality && v.street && /\d/.test(v.street)) group(byAddress, `${locality}|${normalize(v.street)}`, v);
  }
  const collisions = [...bySlug.entries()].filter(([,a]) => a.length > 1).map(([slug,a]) => ({slug, fichas:a.map(summary)}));
  const candidates = new Map();
  for (const [reason,map] of [['nombre_y_municipio',byName],['telefono_y_municipio',byPhone],['direccion_y_municipio',byAddress]]) {
    for (const a of map.values()) if (a.length > 1) {
      const records = [...a].sort((x,y) => x.id.localeCompare(y.id));
      const key = records.map(x => x.id).join('|');
      if (!candidates.has(key)) candidates.set(key,{motivos:[], fichas:records.map(summary)});
      candidates.get(key).motivos.push(reason);
    }
  }
  const current = existingPublicSlugs();
  const missing = current.filter(slug => !bySlug.has(slug));
  return { usable, report: { fecha:new Date().toISOString(), origen:'Supabase tabla talleres', total_leidos:data.length, fichas_validas:usable.length, slugs_unicos:bySlug.size, colisiones_slug:collisions, slugs_invalidos:invalid, posibles_duplicados:[...candidates.values()], fichas_publicas_sin_registro_actual:missing.map(slug => ({slug,url:canonical(slug)})), aviso:'Los candidatos necesitan revisiÃ³n. No se eliminan registros, no se cambian slugs y no se crean redirecciones automÃ¡ticamente.' } };
}
function publishTemporary(usable, report) {
  // Primero genera todo en otra carpeta. Conserva la salida anterior si falla.
  const stage = fs.mkdtempSync(path.join(ROOT,'.talleres-build-'));
  const backup = `${O}.backup-${process.pid}-${Date.now()}`;
  let moved = false;
  try {
    for (const t of usable) {
      const folder = path.join(stage,slugOf(t));
      fs.mkdirSync(folder);
      fs.writeFileSync(path.join(folder,'index.html'),html(t),'utf8');
    }
    fs.writeFileSync(path.join(stage,'_GENERACION.txt'),`Generadas: ${usable.length}\nOmitidas: ${report.slugs_invalidos.length}\nOrigen directo: Supabase tabla talleres\nSin API pÃºblica ni constructor en tiempo de visita.\nPosibles duplicados: ${report.posibles_duplicados.length}\nAuditorÃ­a: auditoria-talleres-temporal.json\n`,'utf8');
    if (fs.existsSync(O)) { fs.renameSync(O,backup); moved = true; }
    try { fs.renameSync(stage,O); }
    catch (err) { if (moved) fs.renameSync(backup,O); throw err; }
    if (moved) {
      try { fs.rmSync(backup,{recursive:true,force:true}); }
      catch { console.warn(`Copia anterior conservada: ${backup}`); }
    }
  } finally { if (fs.existsSync(stage)) fs.rmSync(stage,{recursive:true,force:true}); }
}
async function main() {
  const data = await rows();
  const { usable, report } = audit(data);
  fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`AuditorÃ­a: ${REPORT}`);
  console.log(`Candidatos a duplicado: ${report.posibles_duplicados.length}`);
  console.log(`Fichas pÃºblicas sin slug actual: ${report.fichas_publicas_sin_registro_actual.length}`);
  if (!usable.length || report.colisiones_slug.length) throw new Error('No se genera: no hay fichas vÃ¡lidas o existen colisiones de slug. Revisa la auditorÃ­a.');
  if (report.slugs_invalidos.length) console.warn(`Slugs invÃ¡lidos omitidos: ${report.slugs_invalidos.length}. Revisa antes de publicar.`);
  if (DRY_RUN) { console.log(`SimulaciÃ³n: ${usable.length} fichas vÃ¡lidas. No se modifica ninguna ficha.`); return; }
  publishTemporary(usable,report);
  console.log(`OK ${usable.length} fichas temporales generadas; omitidas ${report.slugs_invalidos.length}.`);
  console.log('Las fichas pÃºblicas, sitemap y redirecciones permanecen intactos.');
}
export { rows, audit, html, seoTitle, seoDescription, view, publishTemporary };
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(err => { console.error(err.message); process.exitCode = 1; });
}
