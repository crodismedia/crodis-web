#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MUNICIPIOS_DIR = path.join(ROOT, 'municipios');
const OUTPUT = path.join(ROOT, 'sitemap-municipios.xml');
const BASE_URL = 'https://www.tallermap.es';
const MUNICIPIO_FILE_RE = /^.+-\d{5}\.html$/;

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function collectMunicipalityUrls() {
  if (!fs.existsSync(MUNICIPIOS_DIR)) {
    throw new Error(`No existe el directorio: ${MUNICIPIOS_DIR}`);
  }

  const files = fs.readdirSync(MUNICIPIOS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && MUNICIPIO_FILE_RE.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, 'es'));

  if (files.length !== 542) {
    throw new Error(`Se esperaban 542 páginas municipales y se encontraron ${files.length}. No se sobrescribe el sitemap.`);
  }

  const urls = [];
  for (const file of files) {
    const fullPath = path.join(MUNICIPIOS_DIR, file);
    const html = fs.readFileSync(fullPath, 'utf8');

    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
      throw new Error(`Página municipal noindex: ${path.relative(ROOT, fullPath)}`);
    }

    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
      || html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i)?.[1];
    const expected = `${BASE_URL}/municipios/${file}`;

    if (canonical !== expected) {
      throw new Error(`Canonical inesperado en ${file}: ${canonical || 'ausente'} (esperado ${expected})`);
    }

    urls.push(expected);
  }

  return urls;
}

function buildSitemap(urls) {
  const rows = urls
    .map(url => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

const urls = collectMunicipalityUrls();
fs.writeFileSync(OUTPUT, buildSitemap(urls), 'utf8');
console.log(`✅ sitemap-municipios.xml regenerado con ${urls.length} municipios canónicos e indexables.`);
console.log(`📄 ${path.relative(ROOT, OUTPUT)}`);
