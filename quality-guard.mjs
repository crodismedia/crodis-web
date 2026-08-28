#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const CI = args.has('--ci');

const TARGET_DIRS = [
  'api', 'css', 'js', 'lib', 'municipios', 'pages', 'provincias', 'servicios', 'talleres'
];

const IGNORE_PARTS = [
  'node_modules', '.git', '.vercel', 'dist', 'build', 'coverage', 'quality-reports'
];

const EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs']);

const issues = [];
const metrics = {
  files: 0,
  htmlFiles: 0,
  images: 0,
  imagesWithoutAlt: 0,
  imagesWithEmptyAlt: 0,
  errors: 0,
  warnings: 0
};

function ignored(file) {
  const normalized = file.split(path.sep).join('/');
  return IGNORE_PARTS.some((part) => normalized.includes(`/${part}/`) || normalized.endsWith(`/${part}`));
}

function addIssue(file, line, severity, category, message) {
  issues.push({ file: path.relative(ROOT, file), line, severity, category, message });
  if (severity === 'error') metrics.errors += 1;
  if (severity === 'warning') metrics.warnings += 1;
}

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function imageTags(content) {
  return [...content.matchAll(/<img\b[^>]*>/gi)];
}

function altValue(tag) {
  const match = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function analyzeHTML(file, content) {
  metrics.htmlFiles += 1;

  for (const match of imageTags(content)) {
    metrics.images += 1;
    const tag = match[0];
    const alt = altValue(tag);

    if (alt === null) {
      metrics.imagesWithoutAlt += 1;
      addIssue(file, lineAt(content, match.index), 'error', 'image-seo', `Imagen sin atributo alt: ${tag.slice(0, 180)}`);
    } else if (alt === '') {
      metrics.imagesWithEmptyAlt += 1;
      addIssue(file, lineAt(content, match.index), 'warning', 'image-seo', `Imagen con alt vacío: ${tag.slice(0, 180)}`);
    }
  }

  if (!/<!doctype\s+html>/i.test(content)) {
    addIssue(file, 1, 'warning', 'html', 'Falta <!DOCTYPE html>.');
  }

  const htmlTag = content.match(/<html\b[^>]*>/i)?.[0] || '';
  if (htmlTag && !/\blang\s*=/.test(htmlTag)) {
    addIssue(file, 1, 'warning', 'accessibility', 'Falta atributo lang en <html>.');
  }

  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(content)) {
    addIssue(file, 1, 'warning', 'responsive', 'Falta meta viewport.');
  }

  for (const match of content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
    if (!text) addIssue(file, lineAt(content, match.index), 'warning', 'seo', 'Heading vacío.');
  }
}

function analyzeCSS(file, content) {
  const important = (content.match(/!important\b/g) || []).length;
  if (important > 20) addIssue(file, 1, 'warning', 'css', `Uso elevado de !important: ${important}.`);
  if (Buffer.byteLength(content, 'utf8') > 500 * 1024) addIssue(file, 1, 'warning', 'performance', 'Archivo CSS superior a 500 KB.');
}

function analyzeJS(file, content) {
  if (/\beval\s*\(/.test(content)) addIssue(file, 1, 'error', 'security', 'Uso de eval() detectado.');
  if (Buffer.byteLength(content, 'utf8') > 500 * 1024) addIssue(file, 1, 'warning', 'performance', 'Archivo JS superior a 500 KB.');
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignored(full)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
}

const files = [];
for (const dir of TARGET_DIRS) walk(path.join(ROOT, dir), files);
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const ext = path.extname(entry.name).toLowerCase();
  if (EXTENSIONS.has(ext)) files.push(path.join(ROOT, entry.name));
}

for (const file of [...new Set(files)]) {
  const content = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  metrics.files += 1;
  if (ext === '.html' || ext === '.htm') analyzeHTML(file, content);
  else if (ext === '.css') analyzeCSS(file, content);
  else analyzeJS(file, content);
}

const score = Math.max(0, 100 - metrics.errors * 2 - metrics.warnings * 0.25);
console.log('QUALITY GUARD - TallerMap');
console.log('=========================');
console.log(`Archivos analizados: ${metrics.files}`);
console.log(`HTML analizados: ${metrics.htmlFiles}`);
console.log(`Imágenes: ${metrics.images}`);
console.log(`Sin alt: ${metrics.imagesWithoutAlt}`);
console.log(`Alt vacío: ${metrics.imagesWithEmptyAlt}`);
console.log(`Errores: ${metrics.errors}`);
console.log(`Advertencias: ${metrics.warnings}`);
console.log(`Score orientativo: ${score.toFixed(1)}/100`);

if (issues.length) {
  console.log('\nIssues:');
  for (const issue of issues.slice(0, 200)) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.file}:${issue.line} [${issue.category}] ${issue.message}`);
  }
  if (issues.length > 200) console.log(`... y ${issues.length - 200} issues más.`);
}

if (!CI) {
  const dir = path.join(ROOT, 'quality-reports');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'latest.json');
  fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics, score, issues }, null, 2)}\n`, 'utf8');
  console.log(`\nReporte: ${path.relative(ROOT, reportPath)}`);
}

if (CI && metrics.errors > 0) process.exit(1);
