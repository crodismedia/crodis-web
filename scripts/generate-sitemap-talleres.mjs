#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TALLERES_DIR = path.join(ROOT, 'talleres');
const OUTPUT = path.join(ROOT, 'sitemap-talleres.xml');
const BASE_URL = 'https://www.tallermap.es';

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function collectWorkshopUrls() {
  if (!fs.existsSync(TALLERES_DIR)) {
    throw new Error(`No existe el directorio: ${TALLERES_DIR}`);
  }

  const urls = [];
  const entries = fs.readdirSync(TALLERES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name.trim();
    if (!slug || slug.startsWith('.')) continue;

    const indexFile = path.join(TALLERES_DIR, slug, 'index.html');
    if (!fs.existsSync(indexFile)) continue;

    urls.push(`${BASE_URL}/talleres/${encodeURIComponent(slug)}/`);
  }

  return [...new Set(urls)].sort((a, b) => a.localeCompare(b, 'es'));
}

function buildSitemap(urls) {
  const rows = urls
    .map(url => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

const urls = collectWorkshopUrls();

if (urls.length === 0) {
  throw new Error('No se ha encontrado ninguna ficha estática talleres/<slug>/index.html. No se sobrescribe el sitemap.');
}

if (urls.length > 50000) {
  throw new Error(`El sitemap tendría ${urls.length} URLs y supera el límite de 50.000.`);
}

const xml = buildSitemap(urls);
fs.writeFileSync(OUTPUT, xml, 'utf8');

console.log(`✅ sitemap-talleres.xml regenerado con ${urls.length} fichas reales.`);
console.log(`📄 ${path.relative(ROOT, OUTPUT)}`);
