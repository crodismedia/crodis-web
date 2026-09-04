import fs from 'node:fs';
import path from 'node:path';
import {
  SUPABASE_URL,
  SUPABASE_KEY,
  escapeHTML,
  safeWeb,
  safePhone,
  formatPhoneDisplay
} from '../lib/server-utils.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'desguace');
const SITE_URL = 'https://www.tallermap.es';
const SHELL_VERSION = '20260823-2';

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function scheduleHtml(schedule) {
  if (!schedule || typeof schedule !== 'object') return '<p>Horario no disponible.</p>';
  const days = [
    ['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],
    ['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']
  ];
  const rows = days.map(([key,label]) => {
    const d = schedule[key];
    if (!d || typeof d !== 'object') return '';
    const value = d.cerrado === true
      ? 'Cerrado'
      : (Array.isArray(d.turnos) ? d.turnos : []).map(t => {
          const a = clean(t?.apertura, 10);
          const c = clean(t?.cierre, 10);
          return a && c ? `${a}–${c}` : '';
        }).filter(Boolean).join(' y ');
    return value ? `<li><strong>${escapeHTML(label)}:</strong> ${escapeHTML(value)}</li>` : '';
  }).filter(Boolean).join('');
  return rows ? `<ul class="horario">${rows}</ul>` : '<p>Horario no disponible.</p>';
}

async function fetchDesguaces() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/desguaces`);
  url.searchParams.set('select', 'id,nombre,slug,direccion,codigo_postal,municipio,provincia,telefono,web,google_maps_url,horarios,servicios,descripcion');
  url.searchParams.set('activo', 'eq.true');
  url.searchParams.set('verificado', 'eq.true');
  url.searchParams.set('order', 'provincia.asc,municipio.asc,nombre.asc');
  url.searchParams.set('limit', '5000');
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0,300)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function render(d) {
  const slug = clean(d.slug, 160).toLowerCase();
  const name = clean(d.nombre || 'Desguace', 120);
  const municipality = clean(d.municipio, 80);
  const province = clean(d.provincia, 80);
  const provinceSlug = province.toLowerCase().includes('castell') ? 'castellon' : province.toLowerCase().includes('alicante') ? 'alicante' : 'valencia';
  const address = [d.direccion, d.codigo_postal, d.municipio, d.provincia].filter(Boolean).map(v => clean(v,120)).join(', ');
  const phone = safePhone(d.telefono);
  const web = safeWeb(d.web);
  const maps = safeWeb(d.google_maps_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name,address].filter(Boolean).join(', '))}`;
  const canonical = `${SITE_URL}/desguace/${encodeURIComponent(slug)}`;
  const description = clean(d.descripcion || `Desguace en ${municipality}. Consulta teléfono, dirección, horario, servicios y solicita una pieza.`, 155);
  const services = Array.isArray(d.servicios) ? d.servicios.filter(Boolean).slice(0,20) : [];
  const serviceHtml = services.map(s => `<span>${escapeHTML(clean(s,80))}</span>`).join('');
  const phoneButton = phone ? `<a class="btn primary" href="tel:${escapeHTML(phone)}" aria-label="Llamar al ${escapeHTML(formatPhoneDisplay(phone))}">${escapeHTML(formatPhoneDisplay(phone))}</a>` : '';
  const webButton = web ? `<a class="btn" href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : '';
  const structured = JSON.stringify({
    '@context':'https://schema.org', '@type':'AutoPartsStore', name, url:canonical,
    description, telephone: phone || undefined,
    address: address ? {'@type':'PostalAddress',streetAddress:clean(d.direccion,120)||undefined,postalCode:clean(d.codigo_postal,20)||undefined,addressLocality:municipality||undefined,addressRegion:province||undefined,addressCountry:'ES'} : undefined
  }).replace(/</g,'\\u003c');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(name)} en ${escapeHTML(municipality)} | TallerMap</title>
<meta name="description" content="${escapeHTML(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escapeHTML(canonical)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/taller-shell.css?v=${SHELL_VERSION}">
<style>
body{background:#f5f7fa;color:#172033}.dg-wrap{max-width:1050px;margin:0 auto;padding:28px 20px 60px}.dg-card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:24px;box-shadow:0 8px 22px rgba(16,24,40,.06)}.dg-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.dg-local{color:#667085;font-size:.82rem;font-weight:700;text-transform:uppercase}.dg-card h1{margin:4px 0 0;font-size:2rem}.dg-services{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.dg-services span{background:#f2f4f7;border-radius:999px;padding:6px 10px;font-size:.82rem}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 15px;border-radius:9px;background:#f2f4f7;color:#344054;text-decoration:none;font-weight:800}.btn.primary{background:#155eef;color:#fff}.grid{display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-top:18px;content-visibility:auto;contain-intrinsic-size:1px 520px}.request{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:24px}.request .btn{width:100%;background:#101828;color:#fff;min-height:50px}.data p{margin:0;padding:10px 0;border-bottom:1px solid #eaecf0}.horario{padding-left:20px}.horario li{margin:7px 0}.back{display:inline-block;margin-top:20px;color:#155eef;font-weight:800;text-decoration:none}@media(max-width:760px){.grid{grid-template-columns:1fr}.dg-head{flex-direction:column}.dg-card h1{font-size:1.55rem}}
</style><script type="application/ld+json">${structured}</script></head><body>
<header class="cabecera"><div class="contenedor cabecera-contenido"><a href="/" class="marca"><img class="marca-icono marca-icono-logo" src="/favicon.svg" alt="" width="46" height="46"><span class="marca-texto"><strong>TallerMap</strong><small>Desguaces</small></span></a><nav class="menu"><a href="/">Inicio</a><a href="/desguaces.html">Desguaces</a></nav></div></header>
<main class="dg-wrap"><article class="dg-card"><div class="dg-head"><div><div class="dg-local">${escapeHTML(municipality)} · ${escapeHTML(province)}</div><h1>${escapeHTML(name)}</h1></div></div>
${address ? `<p><strong>Dirección:</strong><br>${escapeHTML(address)}</p>` : ''}
${description ? `<p>${escapeHTML(description)}</p>` : ''}
${serviceHtml ? `<div class="dg-services">${serviceHtml}</div>` : ''}
<div class="actions">${phoneButton}<a class="btn" href="${escapeHTML(maps)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>${webButton}</div></article>
<div class="grid"><section class="dg-card data"><h2>Datos del desguace</h2><p><strong>Nombre:</strong> ${escapeHTML(name)}</p>${municipality?`<p><strong>Municipio:</strong> ${escapeHTML(municipality)}</p>`:''}${province?`<p><strong>Provincia:</strong> ${escapeHTML(province)}</p>`:''}${d.codigo_postal?`<p><strong>Código postal:</strong> ${escapeHTML(clean(d.codigo_postal,20))}</p>`:''}${phone?`<p><strong>Teléfono:</strong> ${escapeHTML(formatPhoneDisplay(phone))}</p>`:''}<h3>Horario</h3>${scheduleHtml(d.horarios)}</section>
<aside class="request"><h2>¿Buscas una pieza?</h2><p>Envía una solicitud a este desguace indicando tu vehículo y la pieza que necesitas.</p><a class="btn" href="/solicitar-pieza.html?desguace=${encodeURIComponent(slug)}" rel="nofollow">Solicitar pieza</a></aside></div>
<a class="back" href="/desguaces.html#${encodeURIComponent(provinceSlug)}">← Volver a desguaces</a></main></body></html>`;
}

function cleanOutputDirectory() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (entry.name === '.gitkeep') continue;
    const target = path.join(OUT_DIR, entry.name);
    if (entry.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
    else if (entry.name.endsWith('.html')) fs.rmSync(target, { force: true });
  }
}

const rows = await fetchDesguaces();
if (!rows.length) throw new Error('No se encontraron desguaces activos y verificados.');
cleanOutputDirectory();

let generated = 0;
for (const d of rows) {
  const slug = clean(d.slug, 160).toLowerCase();
  if (!/^[a-z0-9-]{2,160}$/.test(slug)) throw new Error(`Slug inválido: ${d.slug}`);
  const dir = path.join(OUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(d), 'utf8');
  generated += 1;
}

console.log(`OK: ${generated} fichas estáticas de desguaces generadas en /desguace/<slug>/index.html`);
