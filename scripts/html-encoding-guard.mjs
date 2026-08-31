#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');
const CI = args.has('--ci');

const ROOT_DIRS = [
  'municipios',
  'pages',
  'provincias',
  'servicios',
  'talleres',
  'templates'
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  'dist',
  'build',
  'out',
  'coverage',
  'quality-reports',
  'audit-reports'
]);

const APOSTROPHE_ENTITY_RE = /(?:&#0*39;|&#x0*27;|&apos;|&amp;#0*39;|&amp;#x0*27;|&amp;apos;)/gi;
const DOUBLE_ENCODED_RE = /&amp;(?:#\d+|#x[0-9a-f]+|amp|quot|apos|lt|gt);/gi;
const MOJIBAKE_RE = /(?:Ã.|Â.|â(?:€™|€˜|€œ|€|€“|€”|€¦)|ï¿½|�)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.html?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function cleanApostrophes(value) {
  return value.replace(APOSTROPHE_ENTITY_RE, "'");
}

function safeFixHtml(content) {
  let updated = content;

  // Texto visible y metadatos textuales. No toca href/src/canonical ni URLs.
  const textTags = [
    'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'small', 'strong', 'summary', 'dt', 'dd',
    'label', 'button', 'option', 'li'
  ];

  for (const tag of textTags) {
    const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/${tag}>)`, 'gi');
    updated = updated.replace(re, (all, open, body, close) => {
      return `${open}${cleanApostrophes(body)}${close}`;
    });
  }

  // Atributos textuales entre comillas dobles: seguro para un apóstrofo literal.
  updated = updated.replace(
    /(\s(?:content|title|aria-label|alt|placeholder)\s*=\s*")([^"]*)(")/gi,
    (all, start, value, end) => `${start}${cleanApostrophes(value)}${end}`
  );

  // JSON-LD: el apóstrofo literal no necesita escape en strings JSON.
  updated = updated.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (all, open, body, close) => `${open}${cleanApostrophes(body)}${close}`
  );

  return updated;
}

const files = ROOT_DIRS.flatMap(dir => walk(path.join(ROOT, dir)));
const findings = [];
let changedFiles = 0;
let apostropheCount = 0;
let doubleEncodedCount = 0;
let mojibakeCount = 0;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const fileRel = rel(file);

  for (const match of content.matchAll(new RegExp(APOSTROPHE_ENTITY_RE.source, 'gi'))) {
    apostropheCount++;
    findings.push({
      severity: 'warning',
      type: 'html-entity-apostrophe',
      file: fileRel,
      line: lineOf(content, match.index),
      sample: match[0]
    });
  }

  for (const match of content.matchAll(new RegExp(DOUBLE_ENCODED_RE.source, 'gi'))) {
    doubleEncodedCount++;
    findings.push({
      severity: 'error',
      type: 'html-double-encoding',
      file: fileRel,
      line: lineOf(content, match.index),
      sample: match[0]
    });
  }

  for (const match of content.matchAll(new RegExp(MOJIBAKE_RE.source, 'g'))) {
    mojibakeCount++;
    findings.push({
      severity: 'error',
      type: 'mojibake',
      file: fileRel,
      line: lineOf(content, match.index),
      sample: match[0]
    });
  }

  if (FIX && APOSTROPHE_ENTITY_RE.test(content)) {
    APOSTROPHE_ENTITY_RE.lastIndex = 0;
    const updated = safeFixHtml(content);
    if (updated !== content) {
      fs.writeFileSync(file, updated, 'utf8');
      changedFiles++;
      console.log(`✅ Encoding limpiado: ${fileRel}`);
    }
  }
  APOSTROPHE_ENTITY_RE.lastIndex = 0;
}

console.log('\n🔤 HTML ENCODING GUARD');
console.log(`Archivos HTML revisados: ${files.length}`);
console.log(`Entidades de apóstrofo detectadas: ${apostropheCount}`);
console.log(`Entidades doblemente codificadas: ${doubleEncodedCount}`);
console.log(`Posible mojibake detectado: ${mojibakeCount}`);
if (FIX) console.log(`Archivos corregidos automáticamente: ${changedFiles}`);

if (findings.length) {
  console.log('\nHallazgos:');
  for (const item of findings.slice(0, 200)) {
    const icon = item.severity === 'error' ? '❌' : '⚠️';
    console.log(`${icon} ${item.file}:${item.line} [${item.type}] ${item.sample}`);
  }
  if (findings.length > 200) {
    console.log(`… y ${findings.length - 200} hallazgos más`);
  }
}

if (FIX && changedFiles > 0) {
  console.log('\nℹ️ Solo se corrigen automáticamente apóstrofos en contextos seguros.');
  console.log('   El doble encoding y mojibake se reportan para evitar cambios destructivos.');
}

const hardErrors = doubleEncodedCount + mojibakeCount;
if (CI && (hardErrors > 0 || apostropheCount > 0)) {
  process.exit(1);
}
