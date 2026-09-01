#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { GlobalSEOAuditor } = require('../seo-auditor-global.cjs');

const PROTECTED_H1_KINDS = new Set(['taller', 'desguace']);

function classify(page, issue) {
  if (issue?.type !== 'keywords') return null;

  if (issue.element === 'h1' && PROTECTED_H1_KINDS.has(page.kind)) {
    return {
      class: 'protected-commercial-h1',
      actionable: false,
      reason: 'El H1 es el nombre comercial y no debe forzarse con keywords.'
    };
  }

  if (issue.element === 'title') {
    return { class: 'actionable-title', actionable: true, reason: 'El title admite contexto SEO sin alterar el nombre visible.' };
  }
  if (issue.element === 'description') {
    return { class: 'actionable-description', actionable: true, reason: 'La meta description admite contexto semántico natural.' };
  }
  if (issue.element === 'h1') {
    return { class: 'actionable-h1', actionable: true, reason: 'En páginas de categoría/localidad el H1 debe describir la intención de búsqueda.' };
  }
  if (issue.element === 'content') {
    return { class: 'actionable-content', actionable: true, reason: 'Página indexable sin vocabulario de automoción detectable.' };
  }

  return { class: 'review', actionable: false, reason: 'Requiere revisión antes de modificar.' };
}

function main() {
  const args = process.argv.slice(2);
  const reportArg = args.find(arg => arg.startsWith('--report='));
  const reportPath = reportArg ? reportArg.slice('--report='.length) : 'seo-reports/latest-keyword-classification.json';

  const audit = new GlobalSEOAuditor(process.cwd()).audit();
  const rows = [];

  for (const page of audit.pages || []) {
    for (const issue of page.issues || []) {
      const result = classify(page, issue);
      if (!result) continue;
      rows.push({
        page: page.page,
        kind: page.kind,
        element: issue.element || null,
        message: issue.message,
        ...result
      });
    }
  }

  const byClass = {};
  const byKind = {};
  const byElement = {};
  for (const row of rows) {
    byClass[row.class] = (byClass[row.class] || 0) + 1;
    byKind[row.kind] = (byKind[row.kind] || 0) + 1;
    const key = row.element || 'none';
    byElement[key] = (byElement[key] || 0) + 1;
  }

  const actionable = rows.filter(row => row.actionable);
  const protectedRows = rows.filter(row => row.class === 'protected-commercial-h1');

  const report = {
    generatedAt: new Date().toISOString(),
    filesAnalyzed: audit.filesAnalyzed || 0,
    totalKeywordIssues: rows.length,
    actionableKeywordIssues: actionable.length,
    protectedCommercialH1: protectedRows.length,
    reviewOnly: rows.length - actionable.length - protectedRows.length,
    byClass,
    byKind,
    byElement,
    actionableSample: actionable.slice(0, 100),
    protectedSample: protectedRows.slice(0, 30)
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
