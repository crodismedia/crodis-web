#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const CI = args.has('--ci');
const WATCH = args.has('--watch') || args.has('-w');
const REPORT_ONLY = args.has('--report');
const FIX = args.has('--fix') || args.has('-f');
const HELP = args.has('--help') || args.has('-h');
const CONFIG_PATH = path.join(ROOT, 'quality-guard.config.json');

function showHelp() {
  console.log(`\nQUALITY GUARD - TallerMap\n\nUso:\n  node quality-guard.mjs\n  node quality-guard.mjs --ci\n  node quality-guard.mjs --watch\n  node quality-guard.mjs --report\n  node quality-guard.mjs --fix\n  node quality-guard.mjs --help\n\nModos:\n  --ci      Falla con código 1 si hay errores o se incumplen umbrales.\n  --watch   Repite el análisis cuando cambian archivos del proyecto.\n  --report  Genera reportes JSON, HTML y Markdown.\n  --fix     Modo seguro: analiza y reporta; no modifica HTML automáticamente.\n  --help    Muestra esta ayuda.\n`);
}

if (HELP) {
  showHelp();
  process.exit(0);
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('Falta quality-guard.config.json');
  process.exit(2);
}

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const THRESHOLDS = CONFIG.thresholds || {};
const MAX_FILE_SIZE = Number(THRESHOLDS.maxFileSize || 524288);
const EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs']);
const targetDirs = [...new Set(Object.values(CONFIG.directories || {}).flat())];

function normalize(file) {
  return file.split(path.sep).join('/');
}

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§DOUBLESTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§DOUBLESTAR§§/g, '.*');
  return new RegExp(`(^|/)${escaped}$|(^|/)${escaped.replace(/\/\.\*$/, '')}(/|$)`);
}

const ignoreRegexes = (CONFIG.ignore || []).map(globToRegex);
function ignored(file) {
  const rel = normalize(path.relative(ROOT, file));
  return ignoreRegexes.some((regex) => regex.test(rel));
}

function walk(dir, out) {
  if (!fs.existsSync(dir) || ignored(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignored(full)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
}

function getFiles() {
  const files = [];
  for (const configuredDir of targetDirs) walk(path.resolve(ROOT, configuredDir), files);
  return [...new Set(files)];
}

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function altValue(tag) {
  const match = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function isDecorativeImage(tag) {
  return /\baria-hidden\s*=\s*["']true["']/i.test(tag) || /\brole\s*=\s*["'](?:presentation|none)["']/i.test(tag);
}

function analyzeProject() {
  const issues = [];
  const metrics = {
    files: 0,
    htmlFiles: 0,
    images: 0,
    imagesWithoutAlt: 0,
    imagesWithEmptyAlt: 0,
    accessibilityIssues: 0,
    errors: 0,
    warnings: 0
  };

  function addIssue(file, line, severity, category, message) {
    issues.push({ file: path.relative(ROOT, file), line, severity, category, message });
    if (severity === 'error') metrics.errors += 1;
    if (severity === 'warning') metrics.warnings += 1;
    if (category === 'accessibility' || category === 'image-seo') metrics.accessibilityIssues += 1;
  }

  function analyzeHeadingHierarchy(file, content) {
    if (!CONFIG.accessibility?.checkHeadingHierarchy) return;
    let previous = 0;
    for (const match of content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
      const level = Number(match[1]);
      const text = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
      if (!text) addIssue(file, lineAt(content, match.index), 'warning', 'seo', 'Heading vacío.');
      if (previous && level > previous + 1) {
        addIssue(file, lineAt(content, match.index), 'warning', 'accessibility', `Salto de jerarquía H${previous} → H${level}.`);
      }
      previous = level;
    }
  }

  function analyzeHTML(file, content) {
    metrics.htmlFiles += 1;

    if (CONFIG.accessibility?.checkAltText !== false) {
      for (const match of content.matchAll(/<img\b[^>]*>/gi)) {
        metrics.images += 1;
        const tag = match[0];
        const alt = altValue(tag);
        if (alt === null) {
          metrics.imagesWithoutAlt += 1;
          addIssue(file, lineAt(content, match.index), 'error', 'image-seo', `Imagen sin atributo alt: ${tag.slice(0, 180)}`);
        } else if (alt === '' && !isDecorativeImage(tag)) {
          metrics.imagesWithEmptyAlt += 1;
          addIssue(file, lineAt(content, match.index), 'warning', 'image-seo', `Imagen informativa con alt vacío: ${tag.slice(0, 180)}`);
        }
      }
    }

    if (!/<!doctype\s+html>/i.test(content)) addIssue(file, 1, 'warning', 'html', 'Falta <!DOCTYPE html>.');

    const htmlTag = content.match(/<html\b[^>]*>/i)?.[0] || '';
    if (htmlTag && !/\blang\s*=/.test(htmlTag)) addIssue(file, 1, 'warning', 'accessibility', 'Falta atributo lang en <html>.');
    if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(content)) addIssue(file, 1, 'warning', 'responsive', 'Falta meta viewport.');

    if (CONFIG.seo?.checkTitleTags && !/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(content)) {
      addIssue(file, 1, 'warning', 'seo', 'Falta <title> válido.');
    }
    if (CONFIG.seo?.checkMetaTags && !/<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']+["']/i.test(content)) {
      addIssue(file, 1, 'warning', 'seo', 'Falta meta description válida.');
    }
    if (CONFIG.seo?.checkCanonical && !/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["'][^"']+["']/i.test(content)) {
      addIssue(file, 1, 'warning', 'seo', 'Falta canonical.');
    }

    analyzeHeadingHierarchy(file, content);
  }

  function analyzeCSS(file, content) {
    const important = (content.match(/!important\b/g) || []).length;
    if (important > 20) addIssue(file, 1, 'warning', 'css', `Uso elevado de !important: ${important}.`);
    if (CONFIG.performance?.checkFileSize && Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
      addIssue(file, 1, 'warning', 'performance', `Archivo CSS superior a ${(MAX_FILE_SIZE / 1024).toFixed(0)} KB.`);
    }
  }

  function analyzeJS(file, content) {
    if (/\beval\s*\(/.test(content)) addIssue(file, 1, 'error', 'security', 'Uso de eval() detectado.');
    if (CONFIG.performance?.checkFileSize && Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
      addIssue(file, 1, 'warning', 'performance', `Archivo JS superior a ${(MAX_FILE_SIZE / 1024).toFixed(0)} KB.`);
    }
  }

  for (const file of getFiles()) {
    const content = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file).toLowerCase();
    metrics.files += 1;
    if (ext === '.html' || ext === '.htm') analyzeHTML(file, content);
    else if (ext === '.css') analyzeCSS(file, content);
    else analyzeJS(file, content);
  }

  const score = Math.max(0, 100 - metrics.errors * 2 - metrics.warnings * 0.25);
  const maxImagesWithoutAlt = Number(THRESHOLDS.maxImagesWithoutAlt ?? 0);
  const maxAccessibilityIssues = Number(THRESHOLDS.maxAccessibilityIssues ?? 0);
  const thresholdFailures = [];
  if (metrics.imagesWithoutAlt > maxImagesWithoutAlt) thresholdFailures.push(`Imágenes sin alt: ${metrics.imagesWithoutAlt} > ${maxImagesWithoutAlt}`);
  if (metrics.accessibilityIssues > maxAccessibilityIssues) thresholdFailures.push(`Issues de accesibilidad: ${metrics.accessibilityIssues} > ${maxAccessibilityIssues}`);

  return { generatedAt: new Date().toISOString(), config: CONFIG, metrics, score, thresholdFailures, issues };
}

function printResult(result) {
  const { metrics, score, thresholdFailures, issues } = result;
  console.log('QUALITY GUARD - TallerMap');
  console.log('=========================');
  console.log(`Configuración: ${path.relative(ROOT, CONFIG_PATH)}`);
  console.log(`Archivos analizados: ${metrics.files}`);
  console.log(`HTML analizados: ${metrics.htmlFiles}`);
  console.log(`Imágenes: ${metrics.images}`);
  console.log(`Sin alt: ${metrics.imagesWithoutAlt}`);
  console.log(`Alt vacío: ${metrics.imagesWithEmptyAlt}`);
  console.log(`Issues accesibilidad: ${metrics.accessibilityIssues}`);
  console.log(`Errores: ${metrics.errors}`);
  console.log(`Advertencias: ${metrics.warnings}`);
  console.log(`Score orientativo: ${score.toFixed(1)}/100`);

  if (issues.length) {
    console.log('\nIssues:');
    for (const issue of issues.slice(0, 300)) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.file}:${issue.line} [${issue.category}] ${issue.message}`);
    }
    if (issues.length > 300) console.log(`... y ${issues.length - 300} issues más.`);
  }

  if (thresholdFailures.length) {
    console.log('\nUmbrales incumplidos:');
    thresholdFailures.forEach((failure) => console.log(`- ${failure}`));
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function writeReports(result) {
  const dir = path.join(ROOT, 'quality-reports');
  fs.mkdirSync(dir, { recursive: true });

  const jsonPath = path.join(dir, 'latest.json');
  const mdPath = path.join(dir, 'latest.md');
  const htmlPath = path.join(dir, 'latest.html');

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const mdIssues = result.issues.length
    ? result.issues.map((i) => `- **${i.severity.toUpperCase()}** \`${i.file}:${i.line}\` [${i.category}] ${i.message}`).join('\n')
    : '- ✅ Sin issues.';
  const md = `# Quality Guard - TallerMap\n\n- Score: **${result.score.toFixed(1)}/100**\n- Archivos: **${result.metrics.files}**\n- Imágenes: **${result.metrics.images}**\n- Sin alt: **${result.metrics.imagesWithoutAlt}**\n- Alt vacío: **${result.metrics.imagesWithEmptyAlt}**\n- Errores: **${result.metrics.errors}**\n- Advertencias: **${result.metrics.warnings}**\n\n## Issues\n\n${mdIssues}\n`;
  fs.writeFileSync(mdPath, md, 'utf8');

  const rows = result.issues.map((i) => `<tr><td>${escapeHtml(i.severity)}</td><td>${escapeHtml(i.file)}</td><td>${i.line}</td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.message)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quality Guard - TallerMap</title><style>body{font-family:system-ui,sans-serif;margin:24px;line-height:1.45}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}code{word-break:break-word}</style></head><body><h1>Quality Guard - TallerMap</h1><p>Score: <strong>${result.score.toFixed(1)}/100</strong></p><p>Archivos: ${result.metrics.files} · Imágenes: ${result.metrics.images} · Sin alt: ${result.metrics.imagesWithoutAlt} · Alt vacío: ${result.metrics.imagesWithEmptyAlt}</p><table><thead><tr><th>Severidad</th><th>Archivo</th><th>Línea</th><th>Categoría</th><th>Problema</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');

  console.log(`\nReportes:\n- ${path.relative(ROOT, jsonPath)}\n- ${path.relative(ROOT, mdPath)}\n- ${path.relative(ROOT, htmlPath)}`);
}

function runOnce() {
  const result = analyzeProject();
  printResult(result);
  if (!CI || REPORT_ONLY || FIX) writeReports(result);

  if (FIX) {
    console.log('\nModo --fix seguro: no se han modificado archivos automáticamente.');
    console.log('Quality Guard solo aplica cambios cuando una corrección es determinista y está validada; actualmente ninguna está habilitada.');
  }

  if (CI && (result.metrics.errors > 0 || result.thresholdFailures.length > 0)) process.exitCode = 1;
  return result;
}

function snapshot() {
  const state = new Map();
  for (const file of getFiles()) {
    try {
      const stat = fs.statSync(file);
      state.set(file, `${stat.mtimeMs}:${stat.size}`);
    } catch {}
  }
  return state;
}

function changed(a, b) {
  if (a.size !== b.size) return true;
  for (const [file, sig] of a) if (b.get(file) !== sig) return true;
  return false;
}

if (WATCH) {
  console.log('Quality Guard watch activo. Ctrl+C para salir.');
  let previous = snapshot();
  runOnce();
  setInterval(() => {
    const current = snapshot();
    if (changed(previous, current)) {
      previous = current;
      console.log('\nCambio detectado. Reanalizando...\n');
      runOnce();
    }
  }, 3000);
} else {
  runOnce();
}
