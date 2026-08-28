import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const roots = ['.', 'pages', 'provincias', 'servicios', 'templates', 'coches'];
const seen = new Set();
let filesChanged = 0;
let imagesFixed = 0;
let headingsFixed = 0;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.startsWith('quality-reports/')) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
}

const files = [];
for (const root of roots) walk(path.resolve(ROOT, root), files);

for (const file of files) {
  const key = path.resolve(file);
  if (seen.has(key)) continue;
  seen.add(key);

  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!/favicon\.svg/i.test(tag)) return tag;
    if (/\baria-hidden\s*=\s*["']true["']/i.test(tag)) return tag;
    if (!/\balt\s*=\s*(?:""|'')/i.test(tag)) return tag;
    imagesFixed += 1;
    return tag.replace(/\balt\s*=\s*(?:""|'')/i, 'alt="TallerMap"');
  });

  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (['servicios/calefaccion-climatizacion.html', 'servicios/centralitas-electronica.html', 'servicios/equilibrado-ruedas.html'].includes(rel)) {
    const before = html;
    html = html.replace(/(<div class="pasos-grid">[\s\S]*?<\/div>)/i, (block) => block.replace(/<h3>/g, '<h2>').replace(/<\/h3>/g, '</h2>'));
    if (html !== before) headingsFixed += 1;
  }

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    filesChanged += 1;
  }
}

console.log(`Archivos modificados: ${filesChanged}`);
console.log(`Logos con alt corregido: ${imagesFixed}`);
console.log(`Páginas con jerarquía H1→H3 corregida: ${headingsFixed}`);
