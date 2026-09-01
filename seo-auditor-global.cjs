const fs = require('fs');
const path = require('path');

const PUBLIC_ROOTS = ['municipios', 'provincias', 'servicios', 'talleres', 'desguace'];
const ROOT_FILES = ['index.html', 'desguaces.html'];
const PUBLIC_PAGES = new Set([
  'pages/registro.html',
  'pages/privacidad.html',
  'pages/aviso-legal.html',
  'pages/cookies.html',
  'pages/condiciones-fotografias.html'
]);

// Vocabulario semántico de automoción. Incluye servicios, piezas, averías,
// mantenimiento, carrocería, neumáticos, diagnosis, ITV y desguaces.
// Se buscan palabras y expresiones completas, sin depender de una única keyword.
const AUTOMOTIVE_TERMS = [
  'automoción', 'automocion', 'automóvil', 'automovil', 'automóviles', 'automoviles',
  'coche', 'coches', 'vehículo', 'vehiculo', 'vehículos', 'vehiculos',
  'taller', 'talleres', 'taller mecánico', 'taller mecanico', 'mecánica', 'mecanica',
  'mecánico', 'mecanico', 'mecánicos', 'mecanicos', 'electromecánica', 'electromecanica',
  'reparación', 'reparacion', 'reparaciones', 'mantenimiento', 'mantenimiento preventivo',
  'avería', 'averia', 'averías', 'averias', 'diagnosis', 'diagnóstico', 'diagnostico',
  'diagnosis electrónica', 'diagnosis electronica', 'centralita', 'electrónica', 'electronica',
  'electricidad del automóvil', 'electricidad del automovil', 'electricidad automóvil', 'electricidad automovil',
  'motor', 'motores', 'motor gasolina', 'motor diésel', 'motor diesel', 'culata', 'junta de culata',
  'distribución', 'distribucion', 'correa de distribución', 'correa de distribucion',
  'cadena de distribución', 'cadena de distribucion', 'turbo', 'turbocompresor',
  'inyección', 'inyeccion', 'inyectores', 'bomba de inyección', 'bomba de inyeccion',
  'adblue', 'fap', 'dpf', 'filtro de partículas', 'filtro de particulas', 'catalizador',
  'egr', 'escape', 'tubo de escape', 'silencioso',
  'aceite', 'cambio de aceite', 'lubricante', 'lubricantes', 'filtro de aceite',
  'filtro de aire', 'filtro de combustible', 'filtro de habitáculo', 'filtro de habitaculo',
  'filtros', 'bujía', 'bujia', 'bujías', 'bujias', 'calentadores',
  'batería', 'bateria', 'baterías', 'baterias', 'alternador', 'motor de arranque',
  'frenos', 'freno', 'pastillas de freno', 'discos de freno', 'líquido de frenos', 'liquido de frenos',
  'embrague', 'kit de embrague', 'volante bimasa', 'bimasa',
  'caja de cambios', 'cambio automático', 'cambio automatico', 'cambio manual',
  'transmisión', 'transmision', 'palier', 'palieres', 'junta homocinética', 'junta homocinetica',
  'dirección', 'direccion', 'dirección asistida', 'direccion asistida',
  'suspensión', 'suspension', 'amortiguador', 'amortiguadores', 'muelles', 'silentblock',
  'neumático', 'neumatico', 'neumáticos', 'neumaticos', 'rueda', 'ruedas',
  'llanta', 'llantas', 'alineado', 'alineación', 'alineacion', 'paralelo', 'equilibrado',
  'pinchazo', 'reparación de pinchazos', 'reparacion de pinchazos',
  'itv', 'pre-itv', 'pre itv', 'revisión pre-itv', 'revision pre-itv',
  'revisión', 'revision', 'revisiones', 'puesta a punto',
  'aire acondicionado', 'climatización', 'climatizacion', 'carga de aire acondicionado',
  'radiador', 'refrigeración', 'refrigeracion', 'anticongelante', 'líquido refrigerante', 'liquido refrigerante',
  'chapa', 'pintura', 'chapa y pintura', 'carrocería', 'carroceria', 'paragolpes',
  'abolladura', 'abolladuras', 'lunas', 'parabrisas', 'cristales',
  'faros', 'pilotos', 'retrovisor', 'retrovisores',
  'recambio', 'recambios', 'repuesto', 'repuestos', 'pieza', 'piezas', 'piezas de coche',
  'pieza usada', 'piezas usadas', 'segunda mano', 'desguace', 'desguaces',
  'vehículo fuera de uso', 'vehiculo fuera de uso', 'vfu', 'baja de vehículo', 'baja de vehiculo',
  'tasación', 'tasacion', 'recogida de vehículos', 'recogida de vehiculos',
  'grúa', 'grua', 'asistencia en carretera', 'asistencia',
  'lavado', 'detailing', 'pulido', 'limpieza de coche',
  'matrícula', 'matricula', 'kilometraje', 'combustible', 'gasolina', 'diésel', 'diesel',
  'glp', 'híbrido', 'hibrido', 'eléctrico', 'electrico', 'vehículo eléctrico', 'vehiculo electrico'
];

function text(value) { return String(value ?? '').trim(); }
function stripTags(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function countWords(html) {
  const value = stripTags(html);
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}
function firstMatch(html, re) {
  const m = html.match(re);
  return m ? text(m[1]) : null;
}
function allMatches(html, re) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m);
  return out;
}
function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) walk(full, files);
    else if (/\.html?$/i.test(name)) files.push(full);
  }
  return files;
}
function pageKind(rel) {
  if (rel === 'index.html') return 'home';
  if (rel === 'desguaces.html') return 'desguaces-index';
  if (rel.startsWith('talleres/')) return 'taller';
  if (rel.startsWith('municipios/')) return 'municipio';
  if (rel.startsWith('provincias/')) return 'provincia';
  if (rel.startsWith('servicios/')) return 'servicio';
  if (rel.startsWith('desguace/')) return 'desguace';
  return 'page';
}
function isPublicPage(rel) {
  return rel === 'index.html' || rel === 'desguaces.html' || PUBLIC_ROOTS.some(root => rel.startsWith(root + '/')) || PUBLIC_PAGES.has(rel);
}
function normalizeRel(root, file) { return path.relative(root, file).replaceAll('\\', '/'); }
function pushIssue(page, issues, severity, type, message, element = null) {
  const issue = { page, severity, type, message, element };
  issues.push(issue);
  return issue;
}
function normalizeSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúüñ\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const AUTOMOTIVE_TERM_INDEX = [...new Set(AUTOMOTIVE_TERMS.map(term => ({
  term,
  normalized: normalizeSearch(term)
})).filter(x => x.normalized).map(x => `${x.term}\u0000${x.normalized}`))]
  .map(value => {
    const [term, normalized] = value.split('\u0000');
    return { term, normalized };
  })
  .sort((a, b) => b.normalized.length - a.normalized.length);

function extractAutomotiveTerms(value) {
  const haystack = ` ${normalizeSearch(value)} `;
  const found = [];
  const seenNormalized = new Set();
  for (const item of AUTOMOTIVE_TERM_INDEX) {
    if (seenNormalized.has(item.normalized)) continue;
    const needle = ` ${item.normalized} `;
    if (haystack.includes(needle)) {
      found.push(item.term);
      seenNormalized.add(item.normalized);
    }
  }
  return found;
}
function uniqueTerms(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = normalizeSearch(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function inspectJsonLd(html) {
  const blocks = [];
  const re = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const types = [];
      const collect = value => {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach(collect);
        if (typeof value !== 'object') return;
        if (value['@type']) types.push(...(Array.isArray(value['@type']) ? value['@type'] : [value['@type']]));
        if (Array.isArray(value['@graph'])) value['@graph'].forEach(collect);
      };
      collect(data);
      blocks.push({ valid: true, types, data });
    } catch (error) {
      blocks.push({ valid: false, types: [], error: error.message });
    }
  }
  return blocks;
}
function auditFile(root, file) {
  const rel = normalizeRel(root, file);
  const html = fs.readFileSync(file, 'utf8');
  const kind = pageKind(rel);
  const issues = [];
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || firstMatch(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const canonical = firstMatch(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || firstMatch(html, /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const robots = firstMatch(html, /<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || firstMatch(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i);
  const viewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const lang = firstMatch(html, /<html\s+[^>]*lang=["']([^"']+)["']/i);
  const h1s = allMatches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map(m => stripTags(m[1]));
  const headings = allMatches(html, /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi).map(m => ({ level: Number(m[1]), text: stripTags(m[2]) }));
  const images = allMatches(html, /<img\b([^>]*)>/gi).map(m => {
    const attrs = m[1];
    return {
      src: firstMatch(attrs, /\bsrc\s*=\s*["']([^"']*)["']/i) || '',
      hasAlt: /\balt\s*=\s*["'][^"']*["']/i.test(attrs),
      alt: firstMatch(attrs, /\balt\s*=\s*["']([^"']*)["']/i)
    };
  });
  const anchors = allMatches(html, /<a\b([^>]*)>/gi).map(m => firstMatch(m[1], /\bhref\s*=\s*["']([^"']+)["']/i)).filter(Boolean);
  const jsonLd = inspectJsonLd(html);
  const words = countWords(html);
  const visibleText = stripTags(html);

  const automotive = {
    all: extractAutomotiveTerms(visibleText),
    title: extractAutomotiveTerms(title || ''),
    description: extractAutomotiveTerms(description || ''),
    h1: extractAutomotiveTerms(h1s.join(' ')),
    headings: extractAutomotiveTerms(headings.map(h => h.text).join(' ')),
    imageAlt: extractAutomotiveTerms(images.map(img => img.alt || '').join(' '))
  };
  automotive.all = uniqueTerms(automotive.all);
  const automotiveCoverage = {
    terms: automotive.all.length,
    inTitle: automotive.title.length,
    inDescription: automotive.description.length,
    inH1: automotive.h1.length,
    inHeadings: automotive.headings.length,
    inImageAlt: automotive.imageAlt.length
  };

  if (!/^<!doctype html>/i.test(html.trim())) pushIssue(rel, issues, 'error', 'structure', 'Falta <!DOCTYPE html>.');
  if (!lang) pushIssue(rel, issues, 'warning', 'accessibility', 'Falta atributo lang en <html>.');
  if (!viewport) pushIssue(rel, issues, 'warning', 'mobile', 'Falta meta viewport.');
  if (!title) pushIssue(rel, issues, 'error', 'metadata', 'Falta <title>.', 'title');
  else {
    if (title.length < 25) pushIssue(rel, issues, 'warning', 'metadata', `Title corto (${title.length} caracteres).`, 'title');
    if (title.length > 65) pushIssue(rel, issues, 'warning', 'metadata', `Title largo (${title.length} caracteres).`, 'title');
  }
  if (!description) pushIssue(rel, issues, 'warning', 'metadata', 'Falta meta description.', 'description');
  else {
    if (description.length < 60) pushIssue(rel, issues, 'warning', 'metadata', `Description corta (${description.length} caracteres).`, 'description');
    if (description.length > 170) pushIssue(rel, issues, 'warning', 'metadata', `Description larga (${description.length} caracteres).`, 'description');
  }
  const indexableKinds = new Set(['home', 'taller', 'municipio', 'provincia', 'servicio', 'desguace', 'desguaces-index']);
  if (indexableKinds.has(kind) && robots && /noindex/i.test(robots)) pushIssue(rel, issues, 'error', 'indexability', 'Página pública marcada como noindex.', 'robots');
  if (indexableKinds.has(kind) && !canonical) pushIssue(rel, issues, 'warning', 'canonical', 'Falta canonical.', 'canonical');
  if (canonical && !/^https:\/\/(?:www\.)?tallermap\.es\//i.test(canonical)) pushIssue(rel, issues, 'warning', 'canonical', `Canonical fuera de tallermap.es: ${canonical}`, 'canonical');
  if (h1s.length === 0 && indexableKinds.has(kind)) pushIssue(rel, issues, 'error', 'headings', 'Falta H1.', 'h1');
  if (h1s.length > 1) pushIssue(rel, issues, 'warning', 'headings', `Hay ${h1s.length} H1.`, 'h1');
  const emptyHeadings = headings.filter(h => !h.text).length;
  if (emptyHeadings) pushIssue(rel, issues, 'warning', 'headings', `${emptyHeadings} heading(s) vacíos.`);
  const missingAlt = images.filter(img => !img.hasAlt);
  if (missingAlt.length) pushIssue(rel, issues, 'error', 'images', `${missingAlt.length} imagen(es) sin atributo alt.`, 'img');
  const invalidJsonLd = jsonLd.filter(x => !x.valid).length;
  if (invalidJsonLd) pushIssue(rel, issues, 'error', 'structured-data', `${invalidJsonLd} bloque(s) JSON-LD inválidos.`);
  const structuredRequired = new Set(['taller', 'municipio', 'provincia', 'servicio', 'desguace']);
  if (structuredRequired.has(kind) && jsonLd.length === 0) pushIssue(rel, issues, 'warning', 'structured-data', 'No hay datos estructurados JSON-LD.');
  if (kind === 'taller') {
    const types = jsonLd.flatMap(x => x.types || []);
    if (!types.some(t => /^(LocalBusiness|AutomotiveBusiness|AutoRepair)$/i.test(String(t)))) {
      pushIssue(rel, issues, 'warning', 'local-seo', 'Ficha de taller sin schema LocalBusiness/AutomotiveBusiness/AutoRepair.');
    }
  }

  if (indexableKinds.has(kind)) {
    if (automotive.all.length === 0) {
      pushIssue(rel, issues, 'warning', 'keywords', 'Página indexable sin vocabulario de automoción detectable.', 'content');
    } else {
      if (automotive.title.length === 0) pushIssue(rel, issues, 'warning', 'keywords', `El title no contiene vocabulario de automoción. Detectado en página: ${automotive.all.slice(0, 8).join(', ')}.`, 'title');
      if (automotive.description.length === 0) pushIssue(rel, issues, 'warning', 'keywords', `La meta description no contiene vocabulario de automoción. Detectado en página: ${automotive.all.slice(0, 8).join(', ')}.`, 'description');
      if (h1s.length && automotive.h1.length === 0) pushIssue(rel, issues, 'warning', 'keywords', `El H1 no contiene vocabulario de automoción. Detectado en página: ${automotive.all.slice(0, 8).join(', ')}.`, 'h1');
    }
  }

  const contentMinimum = ({ home: 250, municipio: 180, provincia: 220, servicio: 220, taller: 100, desguace: 100, 'desguaces-index': 180 })[kind] || 0;
  if (contentMinimum && words < contentMinimum) pushIssue(rel, issues, 'warning', 'content', `Contenido escaso: ${words} palabras (mínimo recomendado ${contentMinimum}).`);
  const badHref = anchors.filter(h => /^javascript:/i.test(h) || h === '#').length;
  if (badHref) pushIssue(rel, issues, 'info', 'links', `${badHref} enlace(s) con destino vacío/javascript.`);

  return {
    page: rel,
    kind,
    score: Math.max(0, 100 - issues.reduce((sum, i) => sum + (i.severity === 'error' ? 3 : i.severity === 'warning' ? 1 : 0), 0)),
    issues,
    metrics: {
      words,
      titleLength: title?.length || 0,
      descriptionLength: description?.length || 0,
      h1Count: h1s.length,
      images: images.length,
      imagesWithoutAlt: missingAlt.length,
      links: anchors.length,
      jsonLd: jsonLd.length,
      automotiveTerms: automotiveCoverage.terms,
      automotiveTermsInTitle: automotiveCoverage.inTitle,
      automotiveTermsInDescription: automotiveCoverage.inDescription,
      automotiveTermsInH1: automotiveCoverage.inH1
    },
    metadata: { title, description, canonical, robots, lang },
    keywords: {
      automotiveTerms: automotive.all,
      titleTerms: automotive.title,
      descriptionTerms: automotive.description,
      h1Terms: automotive.h1,
      headingTerms: automotive.headings,
      imageAltTerms: automotive.imageAlt,
      coverage: automotiveCoverage
    },
    types: jsonLd.flatMap(x => x.types || [])
  };
}

function summarize(pages) {
  const allIssues = pages.flatMap(p => p.issues);
  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const infos = allIssues.filter(i => i.severity === 'info').length;
  const score = pages.length ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length) : 0;
  const byType = {};
  const byKind = {};
  const automotiveTermCounts = {};
  let pagesWithAutomotiveTerms = 0;
  let pagesWithoutAutomotiveTerms = 0;

  for (const issue of allIssues) byType[issue.type] = (byType[issue.type] || 0) + 1;
  for (const page of pages) {
    if (!byKind[page.kind]) byKind[page.kind] = { pages: 0, errors: 0, warnings: 0, scoreTotal: 0 };
    const bucket = byKind[page.kind];
    bucket.pages++;
    bucket.errors += page.issues.filter(i => i.severity === 'error').length;
    bucket.warnings += page.issues.filter(i => i.severity === 'warning').length;
    bucket.scoreTotal += page.score;

    const terms = page.keywords?.automotiveTerms || [];
    if (terms.length) pagesWithAutomotiveTerms++;
    else if (new Set(['home', 'taller', 'municipio', 'provincia', 'servicio', 'desguace', 'desguaces-index']).has(page.kind)) pagesWithoutAutomotiveTerms++;
    for (const term of terms) {
      const key = normalizeSearch(term);
      if (!key) continue;
      if (!automotiveTermCounts[key]) automotiveTermCounts[key] = { term, pages: 0 };
      automotiveTermCounts[key].pages++;
    }
  }
  for (const value of Object.values(byKind)) {
    value.score = value.pages ? Math.round(value.scoreTotal / value.pages) : 0;
    delete value.scoreTotal;
  }
  const topAutomotiveTerms = Object.values(automotiveTermCounts)
    .sort((a, b) => b.pages - a.pages || a.term.localeCompare(b.term, 'es'))
    .slice(0, 100);

  return {
    score,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
    errors,
    warnings,
    infos,
    totalIssues: allIssues.length,
    byType,
    byKind,
    keywords: {
      automotiveVocabularySize: AUTOMOTIVE_TERM_INDEX.length,
      pagesWithAutomotiveTerms,
      pagesWithoutAutomotiveTerms,
      topAutomotiveTerms
    }
  };
}

class GlobalSEOAuditor {
  constructor(root = process.cwd()) { this.root = root; }
  getFiles() {
    const files = [];
    for (const file of ROOT_FILES) {
      const full = path.join(this.root, file);
      if (fs.existsSync(full)) files.push(full);
    }
    for (const dir of PUBLIC_ROOTS) walk(path.join(this.root, dir), files);
    for (const rel of PUBLIC_PAGES) {
      const full = path.join(this.root, rel);
      if (fs.existsSync(full)) files.push(full);
    }
    return [...new Set(files)].filter(file => isPublicPage(normalizeRel(this.root, file)));
  }
  audit() {
    const started = Date.now();
    const files = this.getFiles();
    const pages = [];
    for (const file of files) {
      try { pages.push(auditFile(this.root, file)); }
      catch (error) {
        const rel = normalizeRel(this.root, file);
        pages.push({ page: rel, kind: pageKind(rel), score: 0, issues: [{ page: rel, severity: 'error', type: 'runtime', message: error.message }], metrics: {}, metadata: {}, keywords: { automotiveTerms: [] }, types: [] });
      }
    }
    const summary = summarize(pages);
    const worstPages = [...pages]
      .filter(p => p.issues.some(i => i.severity !== 'info'))
      .sort((a, b) => a.score - b.score || b.issues.length - a.issues.length)
      .slice(0, 200);
    const issues = pages.flatMap(p => p.issues).slice(0, 2000);
    return {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      filesAnalyzed: pages.length,
      summary,
      pages,
      worstPages,
      issues,
      truncatedIssues: pages.flatMap(p => p.issues).length > 2000
    };
  }
}

module.exports = { GlobalSEOAuditor, auditFile, AUTOMOTIVE_TERMS };
