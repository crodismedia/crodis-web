import fs from 'node:fs';
import path from 'node:path';
import { SUPABASE_URL, SUPABASE_KEY, escapeHTML, safeWeb, safePhone, formatPhoneDisplay } from '../lib/server-utils.js';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'desguaces.html');

function clean(value, max = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function provinceKey(value) {
  const v = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (v.includes('alicante') || v.includes('alacant')) return 'alicante';
  if (v.includes('castell')) return 'castellon';
  if (v.includes('valencia')) return 'valencia';
  return '';
}

async function fetchRows() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/desguaces`);
  url.searchParams.set('select', 'id,nombre,slug,direccion,codigo_postal,municipio,provincia,telefono,web,google_maps_url,servicios,descripcion');
  url.searchParams.set('activo', 'eq.true');
  url.searchParams.set('verificado', 'eq.true');
  url.searchParams.set('order', 'municipio.asc,nombre.asc');
  url.searchParams.set('limit', '5000');
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0,300)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function renderCard(d) {
  const slug = clean(d.slug, 160).toLowerCase();
  if (!/^[a-z0-9-]{2,160}$/.test(slug)) return '';
  const name = clean(d.nombre || 'Desguace', 120);
  const municipality = clean(d.municipio, 80);
  const address = [d.direccion, d.codigo_postal, d.municipio].filter(Boolean).map(v => clean(v,120)).join(', ');
  const services = Array.isArray(d.servicios) ? d.servicios.filter(Boolean).slice(0,5) : [];
  const phone = safePhone(d.telefono);
  const phoneDisplay = formatPhoneDisplay(d.telefono);
  const web = safeWeb(d.web);
  const maps = safeWeb(d.google_maps_url);
  return `<article class="desguace-card" data-desguace-slug="${escapeHTML(slug)}">` +
    `<p class="desguace-localidad">${escapeHTML(municipality)}</p>` +
    `<h3><a href="/desguace/${escapeHTML(slug)}">${escapeHTML(name)}</a></h3>` +
    (address ? `<p class="desguace-direccion">${escapeHTML(address)}</p>` : '') +
    (services.length ? `<p class="desguace-servicios">${services.map(s => `<span>${escapeHTML(clean(s,80))}</span>`).join('')}</p>` : '') +
    `<p class="desguace-acciones"><a href="/desguace/${escapeHTML(slug)}">Ver ficha</a>` +
    (phone ? `<a href="tel:${escapeHTML(phone)}">${escapeHTML(phoneDisplay || phone)}</a>` : '') +
    (maps ? `<a href="${escapeHTML(maps)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : '') +
    (web ? `<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : '') +
    `</p></article>`;
}

function replaceList(html, key, cards) {
  const id = `lista-desguaces-${key}`;
  const re = new RegExp(`(<div[^>]*id=["']${id}["'][^>]*>)[\\s\\S]*?(</div>)`, 'i');
  if (!re.test(html)) throw new Error(`No se encontró #${id}`);
  return html.replace(re, `$1${cards}$2`);
}

let html = fs.readFileSync(FILE, 'utf8');
const rows = await fetchRows();
const groups = { alicante: [], castellon: [], valencia: [] };
for (const row of rows) {
  const key = provinceKey(row.provincia);
  if (key) groups[key].push(row);
}

for (const key of Object.keys(groups)) {
  const cards = groups[key].map(renderCard).filter(Boolean).join('\n');
  html = replaceList(html, key, cards || '<p class="desguaces-estado">No hay desguaces publicados.</p>');
}

html = html.replace(/(<p id="contador-desguaces-publicados"[^>]*>)[\s\S]*?(<\/p>)/i, `$1${rows.length} desguaces publicados$2`);
html = html
  .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, '')
  .replace(/\s*<script src="js\/supabase\.js[^\"]*"><\/script>/i, '')
  .replace(/\s*<script src="js\/desguaces-publico\.js[^\"]*"><\/script>/i, '');

fs.writeFileSync(FILE, html, 'utf8');
console.log(`OK: directorio estático generado con ${rows.length} desguaces (${groups.alicante.length}/${groups.castellon.length}/${groups.valencia.length}).`);
