#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const ROOT = process.cwd();
const requested = String(args.folder || args.dir || '').trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
if (!requested) {
  console.error('❌ Falta --folder=<carpeta>. Ejemplo: --folder=municipios');
  process.exit(2);
}

const target = path.resolve(ROOT, requested);
const relTarget = path.relative(ROOT, target).replaceAll('\\', '/');
if (relTarget.startsWith('..') || path.isAbsolute(relTarget)) {
  console.error('❌ La carpeta debe estar dentro del repositorio.');
  process.exit(2);
}
if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  console.error(`❌ No existe la carpeta: ${requested}`);
  process.exit(2);
}

const OUT = path.resolve(args.out || 'audit-reports');
fs.mkdirSync(OUT, { recursive: true });
const IGNORE = new Set(['node_modules', '.git', '.vercel', 'dist', 'build', 'out', 'coverage', 'audit-reports', 'quality-reports']);
const TEXT_EXT = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.htm','.css','.scss','.json','.yml','.yaml','.md','.txt','.xml','.svg']);
const issues = [];
const metrics = { files: 0, bytes: 0, lines: 0, html: 0, js: 0, css: 0 };

function add(severity, type, file, message, extra = {}) {
  issues.push({ severity, type, file, message, ...extra });
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).replaceAll('\\', '/'); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

function analyzeHtml(text, file) {
  if (!/<!doctype html>/i.test(text)) add('warning', 'html-doctype', file, 'Falta <!DOCTYPE html>');
  if (!/<html\b[^>]*\blang\s*=/i.test(text)) add('warning', 'html-lang', file, 'Falta lang en <html>');
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(text)) add('warning', 'html-viewport', file, 'Falta meta viewport');
  const h1 = (text.match(/<h1\b/gi) || []).length;
  if (h1 !== 1) add(h1 === 0 ? 'error' : 'warning', 'html-h1', file, `Número de H1: ${h1}`);
  const title = (text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  if (!title?.trim()) add('error', 'html-title', file, 'Falta <title>');
  const robots = (text.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i) || [])[1];
  if (robots && /noindex/i.test(robots)) add('warning', 'html-noindex', file, `Meta robots contiene noindex: ${robots}`);
  const canonical = (text.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1];
  if (!canonical) add('warning', 'html-canonical', file, 'Falta canonical');
  const imgs = text.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = imgs.filter((t) => !/\balt\s*=/i.test(t));
  if (missingAlt.length) add('error', 'html-alt', file, `${missingAlt.length}/${imgs.length} imágenes sin alt`);
  const mojibake = text.match(/Ã.|Â.|â€™|â€œ|â€|�/g);
  if (mojibake?.length) add('warning', 'encoding-mojibake', file, `${mojibake.length} posibles caracteres corruptos`);
}

const hashes = new Map();
for (const file of walk(target)) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { continue; }
  const text = buf.toString('utf8');
  const ext = path.extname(file).toLowerCase();
  const r = rel(file);
  metrics.files++;
  metrics.bytes += buf.length;
  metrics.lines += text.split('\n').length;
  if (['.html','.htm'].includes(ext)) { metrics.html++; analyzeHtml(text, r); }
  if (['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(ext)) {
    metrics.js++;
    if (['.js','.mjs','.cjs'].includes(ext)) {
      const chk = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      if (chk.status !== 0) add('error', 'syntax', r, 'Node --check falló', { detail: chk.stderr?.slice(0, 1200) });
    }
    if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) add('error', 'unsafe-js', r, 'eval/new Function detectado');
  }
  if (['.css','.scss'].includes(ext)) metrics.css++;
  if (/^<<<<<<<(?:\s|$)/m.test(text) && /^=======$/m.test(text) && /^>>>>>>>(?:\s|$)/m.test(text)) add('error', 'merge-marker', r, 'Marcadores de conflicto Git detectados');
  const secretRules = [
    ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g],
    ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
  ];
  for (const [type, re] of secretRules) {
    const m = re.exec(text);
    if (m) add('error', 'secret', r, `Posible secreto expuesto (${type})`, { line: lineOf(text, m.index) });
  }
  const h = sha(buf);
  if (!hashes.has(h)) hashes.set(h, []);
  hashes.get(h).push(r);
}

for (const paths of hashes.values()) {
  if (paths.length > 1) add('warning', 'duplicate-file', paths[0], `${paths.length} archivos idénticos`, { files: paths.slice(0, 30) });
}

const errors = issues.filter((i) => i.severity === 'error').length;
const warnings = issues.filter((i) => i.severity === 'warning').length;
const score = Math.max(0, Math.round((100 - errors * 2.5 - warnings * 0.35) * 10) / 10);
const report = {
  version: 'Guardian Folder 1.0',
  folder: requested,
  startedAt: new Date().toISOString(),
  score,
  metrics,
  errors,
  warnings,
  issues
};

const safeName = requested.replace(/[^a-z0-9._-]+/gi, '-');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(OUT, `guardian-folder-${safeName}-${stamp}.json`);
const mdPath = path.join(OUT, `guardian-folder-${safeName}-${stamp}.md`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdPath, `# Guardian · carpeta ${requested}\n\n- Score: **${score}/100**\n- Archivos analizados: **${metrics.files}**\n- Líneas: **${metrics.lines}**\n- Errores: **${errors}**\n- Advertencias: **${warnings}**\n\n## Hallazgos\n${issues.map(i => `- **${i.severity.toUpperCase()} · ${i.type}** — ${i.file}: ${i.message}`).join('\n') || 'Sin hallazgos'}\n`);

console.log(`🛡️ Guardian carpeta: ${requested}`);
console.log(`✅ ${score}/100 | ${metrics.files} archivos | ${errors} errores | ${warnings} advertencias`);
console.log(mdPath);
if (args.strict && errors) process.exitCode = 1;
