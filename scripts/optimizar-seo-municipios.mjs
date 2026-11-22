import fs from 'node:fs';
import path from 'node:path';

// Descripciones específicas por municipio. No modifica URL, canonical, robots, titles ni H1.
const ROOT = process.cwd();
const DIR = path.join(ROOT, 'municipios');
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'municipios-nombres-castellanos.json'), 'utf8'));
const DRY_RUN = process.argv.includes('--dry-run');
const PROVINCES = { '03': 'Alicante', '12': 'Castellon', '46': 'Valencia' };
const FILES = fs.readdirSync(DIR).filter(name => /^[a-z0-9-]+-\d{5}\.html$/i.test(name)).sort();
if (FILES.length !== 542) throw new Error('Protección: se esperaban 542 municipios, hay ' + FILES.length);

const htmlEsc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const normalized = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const htmlAttr = (html, name) => html.match(new RegExp('<(?:meta|link)\\b(?=[^>]*\\b(?:name|rel)\\s*=\\s*["\\x27]' + name + '["\\x27])[^>]*>', 'i'))?.[0] || '';
const IMG_LINKS = /(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const CARDS = /<article\b(?=[^>]*\bclass\s*=\s*["'][^"']*\btaller-card\b)[^>]*>/gi;
const DESC_META = /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*>/gi;
const OG_DESC = /<meta\b(?=[^>]*\bproperty\s*=\s*["']og:description["'])[^>]*>/gi;

function locality(name, code) {
  const province = PROVINCES[code.slice(0, 2)] || 'Comunidad Valenciana';
  return normalized(name).includes(normalized(province)) ? name : name + ', ' + province;
}

function description(name, code, count) {
  if (count === 0) {
    const full = 'Talleres mecánicos en ' + locality(name, code) + '. Todavía no hay talleres publicados. Consulta otras localidades o registra un taller en TallerMap.';
    if (full.length <= 155) return full;
    return 'Talleres en ' + name + '. Todavía no hay talleres publicados. Explora otras localidades en TallerMap.';
  }
  if (code === '46250') return 'Encuentra talleres mecánicos en Valencia. Busca mecánicos por servicio y consulta dirección, teléfono, horario y cómo llegar a cada taller en TallerMap.';
  if (code === '03014') return 'Encuentra talleres mecánicos en Alicante. Busca mecánicos por servicio y consulta horarios, teléfonos, direcciones y cómo llegar en TallerMap.';
  if (code === '12040') return 'Encuentra talleres mecánicos en Castellon de la Plana. Busca mecánicos y consulta servicios, teléfonos, horarios y cómo llegar en TallerMap.';
  const full = 'Encuentra talleres mecánicos en ' + locality(name, code) + '. Compara mecánicos por servicio y consulta teléfonos, horarios y direcciones en TallerMap.';
  if (full.length <= 155) return full;
  const shorter = 'Talleres mecánicos en ' + name + '. Consulta servicios, teléfonos, horarios y direcciones de talleres publicados en TallerMap.';
  return shorter.length <= 155 ? shorter : 'Talleres en ' + name + '. Consulta servicios y datos de contacto en TallerMap.';
}
function updateStructuredData(head, newDesc) {
  return head.replace(/(<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (all, open, body, close) => {
    let data;
    try { data = JSON.parse(body); } catch { return all; }
    let edited = false;
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (types.some(type => ['CollectionPage', 'WebPage', 'SearchResultsPage'].includes(type))) {
        if (node.description !== newDesc) { node.description = newDesc; edited = true; }
      }
      if (node['@graph']) visit(node['@graph']);
    }
    visit(data);
    return edited ? open + '\n' + JSON.stringify(data, null, 2) + '\n' + close : all;
  });
}
function optimizedIntro(name, code) {
  if (code !== '03014' && code !== '12040') return null;
  const safe = htmlEsc(name);
  return '<p class="municipio-intro">\n'
    + '                            Encuentra talleres mecánicos en ' + safe + ' para reparar o mantener tu coche.\n'
    + '                            Si buscas un mecánico en ' + safe + ', utiliza el filtro de servicios para localizar\n'
    + '                            talleres publicados y consultar su dirección, teléfono y horario.\n'
    + '                        </p>';
}
function update(html, fileName) {
  const code = fileName.match(/-(\d{5})\.html$/)?.[1];
  const name = NAMES[code];
  if (!name || name.includes('/')) throw new Error('Sin nombre municipal inequívoco: ' + fileName);
  const previousHead = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
  const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
  if (!previousHead || !h1) throw new Error('Falta head o H1: ' + fileName);
  const cards = [...html.matchAll(CARDS)].length;
  const newDesc = description(name, code, cards);
  if (newDesc.length > 155) throw new Error('Descripción demasiado larga: ' + fileName);
  const newTag = '<meta name="description" content="' + htmlEsc(newDesc) + '">';
  let newHead = previousHead.replace(DESC_META, newTag);
  if (!DESC_META.test(previousHead)) newHead = newHead.replace(/<\/title>/i, '</title>\n    ' + newTag);
  DESC_META.lastIndex = 0;
  newHead = newHead.replace(OG_DESC, '<meta property="og:description" content="' + htmlEsc(newDesc) + '">');
  newHead = updateStructuredData(newHead, newDesc);
  let revised = html.replace(previousHead, newHead);
  const intro = optimizedIntro(name, code);
  if (intro && cards > 0) {
    const re = /<p\b(?=[^>]*\bclass=["'][^"']*\bmunicipio-intro\b)[^>]*>[\s\S]*?<\/p>/i;
    if (!re.test(revised)) throw new Error('Falta introducción: ' + fileName);
    revised = revised.replace(re, intro);
  }
  const invariant = val => ({
    robots: htmlAttr(val, 'robots'),
    canonical: htmlAttr(val, 'canonical'),
    title: val.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0],
    h1: val.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0],
    links: [...val.matchAll(IMG_LINKS)].map(m => m[0]),
    cards: [...val.matchAll(CARDS)].length
  });
  if (JSON.stringify(invariant(html)) !== JSON.stringify(invariant(revised))) {
    throw new Error('Cambio no autorizado en título, H1, URLs, canonical, robots o fichas: ' + fileName);
  }
  if (!/index\s*,\s*follow/i.test(htmlAttr(revised, 'robots'))) {
    throw new Error('La página no contiene index,follow; revisión manual: ' + fileName);
  }
  return revised;
}
const pending = [];
for (const name of FILES) {
  const file = path.join(DIR, name);
  const oldContent = fs.readFileSync(file, 'utf8');
  const newContent = update(oldContent, name);
  if (newContent !== oldContent) pending.push({ file, newContent, name });
}
console.log('SEO municipal: ' + FILES.length + ' HTML comprobados; ' + pending.length + ' con mejora; DRY_RUN=' + DRY_RUN);
if (!DRY_RUN) for (const { file, newContent } of pending) fs.writeFileSync(file, newContent, 'utf8');
if (pending.length) console.log('Ejemplos: ' + pending.slice(0, 8).map(x => x.name).join(', '));
