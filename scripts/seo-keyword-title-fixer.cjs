#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { GlobalSEOAuditor } = require('../seo-auditor-global.cjs');
const { baseKeywordForPage } = require('./seo-keyword-optimizer.cjs');

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactStem(title, maxLength) {
  let stem = String(title || '')
    .split(/\s*[|–—]\s*/)[0]
    .replace(/\s+-\s+TallerMap\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stem.length <= maxLength) return stem;
  const sliced = stem.slice(0, maxLength + 1);
  const cut = sliced.lastIndexOf(' ');
  if (cut >= Math.min(15, maxLength - 1)) stem = sliced.slice(0, cut);
  else stem = stem.slice(0, maxLength);
  return stem.replace(/[\s,;:.-]+$/g, '').trim();
}

function fixTitles(root = process.cwd(), maxFiles = 100) {
  const before = new GlobalSEOAuditor(root).audit();
  const changes = [];
  const skipped = [];
  const candidates = (before.pages || [])
    .filter(page => (page.issues || []).some(issue => issue.type === 'keywords' && issue.element === 'title'))
    .filter(page => (page.metrics?.automotiveTermsInTitle || 0) === 0);

  for (const page of candidates) {
    if (changes.length >= maxFiles) break;
    const file = path.join(root, page.page);
    if (!fs.existsSync(file)) continue;
    const keyword = baseKeywordForPage(page);
    if (!keyword) {
      skipped.push({ page: page.page, reason: 'no-keyword' });
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const match = html.match(/<title([^>]*)>([\s\S]*?)<\/title>/i);
    if (!match) {
      skipped.push({ page: page.page, reason: 'missing-title' });
      continue;
    }
    const current = htmlText(match[2]);
    if (!current || normalize(current).includes(normalize(keyword))) continue;

    const available = 65 - keyword.length - 3;
    if (available < 15) {
      skipped.push({ page: page.page, reason: 'keyword-too-long', keyword });
      continue;
    }
    const stem = compactStem(current, available);
    const candidate = `${stem} | ${keyword}`;
    if (!stem || candidate.length > 65 || candidate.length < 25) {
      skipped.push({ page: page.page, reason: 'unsafe-candidate', candidate });
      continue;
    }

    const next = html.replace(match[0], `<title${match[1]}>${candidate}</title>`);
    if (next === html) continue;
    fs.writeFileSync(file, next, 'utf8');
    changes.push({ page: page.page, keyword, before: current, after: candidate });
  }

  const after = new GlobalSEOAuditor(root).audit();
  return {
    generatedAt: new Date().toISOString(),
    changedFiles: changes.length,
    changes,
    skipped: skipped.slice(0, 200),
    keywordIssuesBefore: before.summary?.byType?.keywords || 0,
    keywordIssuesAfter: after.summary?.byType?.keywords || 0,
    scoreBefore: before.summary?.score ?? null,
    scoreAfter: after.summary?.score ?? null
  };
}

if (require.main === module) {
  const maxArg = process.argv.find(arg => arg.startsWith('--max='));
  const reportArg = process.argv.find(arg => arg.startsWith('--report='));
  const maxFiles = maxArg ? Math.max(1, Number(maxArg.split('=')[1]) || 100) : 100;
  const report = reportArg ? reportArg.slice('--report='.length) : 'seo-reports/latest-title-fixes.json';
  const result = fixTitles(process.cwd(), maxFiles);
  fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
  fs.writeFileSync(path.resolve(report), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { fixTitles };
