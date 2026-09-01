#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { GlobalSEOAuditor } = require('../seo-auditor-global.cjs');

const INDEXABLE_KINDS = new Set(['home', 'taller', 'municipio', 'provincia', 'servicio', 'desguace', 'desguaces-index']);
const GOOGLE_SUGGEST_ENDPOINT = 'https://suggestqueries.google.com/complete/search';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const clean = String(value || '').trim();
    const key = normalize(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function htmlText(value) {
  return String(value || '')
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

function locationFromPage(page) {
  if (!page || !['municipio', 'provincia'].includes(page.kind)) return '';
  const base = path.basename(page.page || '', path.extname(page.page || ''))
    .replace(/-\d{4,6}$/i, '')
    .replace(/-pagina-?\d+$/i, '')
    .replace(/-+/g, ' ')
    .trim();
  if (!base) return '';
  return base
    .split(' ')
    .filter(Boolean)
    .map(word => word.length <= 3 ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function serviceFromPage(page) {
  if (!page || page.kind !== 'servicio') return '';
  return path.basename(page.page || '', path.extname(page.page || ''))
    .replace(/-+/g, ' ')
    .trim();
}

function baseKeywordForPage(page) {
  const location = locationFromPage(page);
  switch (page.kind) {
    case 'home': return 'talleres mecánicos';
    case 'municipio': return location ? `talleres mecánicos en ${location}` : 'talleres mecánicos';
    case 'provincia': return location ? `talleres mecánicos en ${location}` : 'talleres mecánicos';
    case 'servicio': return serviceFromPage(page) || (page.keywords?.automotiveTerms || [])[0] || 'servicios de automoción';
    case 'taller': return 'taller mecánico';
    case 'desguace': return 'desguace de coches';
    case 'desguaces-index': return 'desguaces de coches';
    default: return (page.keywords?.automotiveTerms || [])[0] || '';
  }
}

function buildResearchSeeds(auditResult, limit = 18) {
  const fixed = [
    'taller mecánico',
    'talleres mecánicos',
    'taller mecánico Valencia',
    'taller mecánico Alicante',
    'taller mecánico Castellón',
    'cambio de aceite coche',
    'neumáticos coche',
    'frenos coche',
    'embrague coche',
    'chapa y pintura coche',
    'pre ITV coche',
    'diagnosis coche',
    'aire acondicionado coche',
    'desguace coches',
    'recambios coche'
  ];
  const fromSite = (auditResult?.summary?.keywords?.topAutomotiveTerms || [])
    .slice(0, 20)
    .map(item => item.term)
    .filter(Boolean)
    .map(term => `${term} coche`);
  return unique([...fixed, ...fromSite]).slice(0, Math.max(1, limit));
}

async function googleSuggest(seed, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${GOOGLE_SUGGEST_ENDPOINT}?client=firefox&hl=es&gl=es&q=${encodeURIComponent(seed)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TallerMap-SEO-Auditor/1.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const suggestions = Array.isArray(data?.[1]) ? data[1] : [];
    return { seed, ok: true, suggestions: unique(suggestions).slice(0, 12) };
  } catch (error) {
    return { seed, ok: false, suggestions: [], error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function researchExternalKeywords(auditResult, options = {}) {
  const limit = Number(options.limit || 18);
  const seeds = buildResearchSeeds(auditResult, limit);
  const batches = [];
  for (let i = 0; i < seeds.length; i += 4) {
    const batch = await Promise.all(seeds.slice(i, i + 4).map(seed => googleSuggest(seed, options.timeoutMs || 4500)));
    batches.push(...batch);
  }
  const suggestions = unique(batches.flatMap(item => item.suggestions || []));
  return {
    source: 'Google Autocomplete',
    endpoint: GOOGLE_SUGGEST_ENDPOINT,
    locale: 'es-ES',
    generatedAt: new Date().toISOString(),
    seeds,
    successfulSeeds: batches.filter(item => item.ok).length,
    failedSeeds: batches.filter(item => !item.ok).length,
    queries: batches,
    suggestions
  };
}

function relevantExternalSuggestions(page, externalResearch, limit = 8) {
  const base = normalize(baseKeywordForPage(page));
  const local = normalize(locationFromPage(page));
  const siteTerms = (page.keywords?.automotiveTerms || []).map(normalize).filter(Boolean);
  const scored = [];
  for (const suggestion of externalResearch?.suggestions || []) {
    const value = normalize(suggestion);
    let score = 0;
    if (base && (value.includes(base) || base.includes(value))) score += 6;
    if (local && value.includes(local)) score += 5;
    for (const term of siteTerms) if (term.length >= 4 && value.includes(term)) score += 2;
    if (/cerca de mi|precio|precios|24 horas|abierto/i.test(value)) score += 1;
    if (score > 0) scored.push({ keyword: suggestion, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.keyword.length - b.keyword.length)
    .slice(0, limit)
    .map(item => item.keyword);
}

function buildPageKeywordPlan(page, externalResearch) {
  const primary = baseKeywordForPage(page);
  const detected = page.keywords?.automotiveTerms || [];
  const external = relevantExternalSuggestions(page, externalResearch);
  return {
    page: page.page,
    kind: page.kind,
    primaryKeyword: primary,
    detectedAutomotiveTerms: detected.slice(0, 20),
    externalSuggestions: external,
    missing: {
      title: (page.metrics?.automotiveTermsInTitle || 0) === 0,
      description: (page.metrics?.automotiveTermsInDescription || 0) === 0,
      h1: page.kind !== 'taller' && (page.metrics?.h1Count || 0) > 0 && (page.metrics?.automotiveTermsInH1 || 0) === 0
    }
  };
}

function escapeAttribute(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function addKeywordToTitle(html, keyword) {
  const match = html.match(/<title([^>]*)>([\s\S]*?)<\/title>/i);
  if (!match) return { html, changed: false, reason: 'missing-title' };
  const current = htmlText(match[2]);
  if (!current || normalize(current).includes(normalize(keyword))) return { html, changed: false, reason: 'already-covered' };
  const candidate = `${current} | ${keyword}`;
  if (candidate.length > 65) return { html, changed: false, reason: 'title-too-long' };
  return { html: html.replace(match[0], `<title${match[1]}>${candidate}</title>`), changed: true, before: current, after: candidate };
}

function addKeywordToDescription(html, keyword, title) {
  const re1 = /<meta\s+([^>]*?)name=["']description["']([^>]*?)content=["']([^"']*)["']([^>]*)>/i;
  const re2 = /<meta\s+([^>]*?)content=["']([^"']*)["']([^>]*?)name=["']description["']([^>]*)>/i;
  let match = html.match(re1);
  if (match) {
    const current = htmlText(match[3]);
    if (normalize(current).includes(normalize(keyword))) return { html, changed: false, reason: 'already-covered' };
    const sentence = ` Encuentra ${keyword} y servicios de automoción en TallerMap.`;
    const candidate = `${current.replace(/[.\s]+$/g, '')}.${sentence}`.replace(/\s+/g, ' ').trim();
    if (candidate.length > 170) return { html, changed: false, reason: 'description-too-long' };
    const replacement = match[0].replace(match[3], escapeAttribute(candidate));
    return { html: html.replace(match[0], replacement), changed: true, before: current, after: candidate };
  }
  match = html.match(re2);
  if (match) {
    const current = htmlText(match[2]);
    if (normalize(current).includes(normalize(keyword))) return { html, changed: false, reason: 'already-covered' };
    const sentence = ` Encuentra ${keyword} y servicios de automoción en TallerMap.`;
    const candidate = `${current.replace(/[.\s]+$/g, '')}.${sentence}`.replace(/\s+/g, ' ').trim();
    if (candidate.length > 170) return { html, changed: false, reason: 'description-too-long' };
    const replacement = match[0].replace(match[2], escapeAttribute(candidate));
    return { html: html.replace(match[0], replacement), changed: true, before: current, after: candidate };
  }
  const cleanTitle = htmlText(title || '');
  const candidate = `Encuentra ${keyword}${cleanTitle ? ` para ${cleanTitle}` : ''} y servicios de automoción en TallerMap.`.replace(/\s+/g, ' ').trim();
  if (candidate.length > 170) return { html, changed: false, reason: 'generated-description-too-long' };
  if (!/<\/head>/i.test(html)) return { html, changed: false, reason: 'missing-head' };
  return {
    html: html.replace(/<\/head>/i, `  <meta name="description" content="${escapeAttribute(candidate)}">\n</head>`),
    changed: true,
    before: null,
    after: candidate
  };
}

function applySafeKeywordFixes(root, auditResult, externalResearch, options = {}) {
  const maxFiles = Math.max(1, Number(options.maxFiles || 100));
  const dryRun = Boolean(options.dryRun);
  const changes = [];
  const skipped = [];
  const pages = (auditResult?.pages || [])
    .filter(page => INDEXABLE_KINDS.has(page.kind))
    .filter(page => (page.issues || []).some(issue => issue.type === 'keywords'));

  for (const page of pages) {
    if (changes.length >= maxFiles) break;
    const full = path.join(root, page.page);
    if (!fs.existsSync(full)) continue;
    const keyword = baseKeywordForPage(page);
    if (!keyword) {
      skipped.push({ page: page.page, reason: 'no-primary-keyword' });
      continue;
    }
    const original = fs.readFileSync(full, 'utf8');
    let next = original;
    const applied = [];

    if ((page.metrics?.automotiveTermsInTitle || 0) === 0) {
      const result = addKeywordToTitle(next, keyword);
      next = result.html;
      if (result.changed) applied.push({ element: 'title', before: result.before, after: result.after });
      else skipped.push({ page: page.page, element: 'title', reason: result.reason });
    }

    if ((page.metrics?.automotiveTermsInDescription || 0) === 0) {
      const result = addKeywordToDescription(next, keyword, page.metadata?.title);
      next = result.html;
      if (result.changed) applied.push({ element: 'description', before: result.before, after: result.after });
      else skipped.push({ page: page.page, element: 'description', reason: result.reason });
    }

    // No se reescribe automáticamente el H1 de fichas de taller: el nombre comercial debe conservarse.
    // Los H1 de otras páginas se reportan para revisión, pero no se fuerzan para evitar texto visible artificial.

    if (applied.length && next !== original) {
      if (!dryRun) fs.writeFileSync(full, next, 'utf8');
      changes.push({
        page: page.page,
        keyword,
        externalSuggestions: relevantExternalSuggestions(page, externalResearch, 5),
        applied
      });
    }
  }

  return { dryRun, maxFiles, changedFiles: changes.length, changes, skipped: skipped.slice(0, 500) };
}

function compactSummary(auditResult, externalResearch, fixResult, verification) {
  return {
    generatedAt: new Date().toISOString(),
    audit: {
      filesAnalyzed: auditResult?.filesAnalyzed || 0,
      scoreBefore: auditResult?.summary?.score ?? null,
      errorsBefore: auditResult?.summary?.errors ?? null,
      warningsBefore: auditResult?.summary?.warnings ?? null,
      keywordIssuesBefore: auditResult?.summary?.byType?.keywords || 0
    },
    externalResearch: {
      source: externalResearch?.source || null,
      generatedAt: externalResearch?.generatedAt || null,
      seeds: externalResearch?.seeds || [],
      successfulSeeds: externalResearch?.successfulSeeds || 0,
      failedSeeds: externalResearch?.failedSeeds || 0,
      topSuggestions: (externalResearch?.suggestions || []).slice(0, 100)
    },
    automaticFixes: fixResult || { changedFiles: 0, changes: [] },
    verification: verification ? {
      filesAnalyzed: verification.filesAnalyzed,
      scoreAfter: verification.summary?.score ?? null,
      errorsAfter: verification.summary?.errors ?? null,
      warningsAfter: verification.summary?.warnings ?? null,
      keywordIssuesAfter: verification.summary?.byType?.keywords || 0
    } : null
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const wantsExternal = args.includes('--external') || args.includes('--fix');
  const wantsFix = args.includes('--fix');
  const dryRun = args.includes('--dry-run');
  const maxArg = args.find(arg => arg.startsWith('--max='));
  const reportArg = args.find(arg => arg.startsWith('--report='));
  const maxFiles = maxArg ? Number(maxArg.split('=')[1]) : 100;
  const reportPath = reportArg ? reportArg.slice('--report='.length) : 'seo-reports/latest-keyword-summary.json';

  const auditor = new GlobalSEOAuditor(root);
  const auditResult = auditor.audit();
  const externalResearch = wantsExternal
    ? await researchExternalKeywords(auditResult, { limit: 18 })
    : { source: null, suggestions: [], seeds: [], successfulSeeds: 0, failedSeeds: 0 };
  const fixResult = wantsFix
    ? applySafeKeywordFixes(root, auditResult, externalResearch, { maxFiles, dryRun })
    : { dryRun: true, maxFiles, changedFiles: 0, changes: [], skipped: [] };
  const verification = wantsFix && !dryRun ? new GlobalSEOAuditor(root).audit() : auditResult;
  const summary = compactSummary(auditResult, externalResearch, fixResult, verification);

  fs.mkdirSync(path.dirname(path.resolve(root, reportPath)), { recursive: true });
  fs.writeFileSync(path.resolve(root, reportPath), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    filesAnalyzed: summary.audit.filesAnalyzed,
    keywordIssuesBefore: summary.audit.keywordIssuesBefore,
    externalSource: summary.externalResearch.source,
    externalSuggestions: summary.externalResearch.topSuggestions.length,
    changedFiles: summary.automaticFixes.changedFiles,
    keywordIssuesAfter: summary.verification?.keywordIssuesAfter,
    report: reportPath
  }, null, 2));
}

if (require.main === module) {
  runCli().catch(error => {
    console.error('seo-keyword-optimizer', error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildResearchSeeds,
  researchExternalKeywords,
  relevantExternalSuggestions,
  buildPageKeywordPlan,
  applySafeKeywordFixes,
  compactSummary,
  baseKeywordForPage
};
