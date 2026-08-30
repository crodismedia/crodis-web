import { createRequire } from 'node:module';

export const config = { maxDuration: 60 };

const require = createRequire(import.meta.url);
const { GlobalSEOAuditor } = require('../seo-auditor-global.cjs');

async function requireAdmin(request) {
  const auth = String(request.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Sesión administrativa no disponible' };

  const supabaseUrl = process.env.SUPABASE_URL || 'https://cnyptelvbsndpkzbrete.supabase.co';
  const anon = process.env.SUPABASE_ANON_KEY || 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/es_administrador`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const admin = rpc.ok ? await rpc.json() : false;
  if (admin !== true) return { ok: false, status: 403, error: 'Acceso no autorizado' };
  return { ok: true };
}

function grade(score) {
  if (score >= 90) return 'A (Excelente)';
  if (score >= 80) return 'B (Bueno)';
  if (score >= 70) return 'C (Aceptable)';
  if (score >= 60) return 'D (Mejorable)';
  return 'F (Crítico)';
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    const auditor = new GlobalSEOAuditor(process.cwd());
    const result = auditor.audit();
    const summary = result.summary || {};
    const pagesWithIssues = new Set((result.issues || []).filter(i => i.severity !== 'info').map(i => i.page)).size;
    const passedPages = Math.max(0, (result.filesAnalyzed || 0) - pagesWithIssues);
    const issues = (result.issues || []).map(issue => ({
      type: issue.type || 'seo',
      severity: issue.severity || 'info',
      message: issue.message || '',
      element: issue.page || issue.element || null,
      page: issue.page || null
    }));

    return response.status(200).json({
      ok: true,
      source: 'seo-auditor-global.cjs',
      scope: 'global',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      generatedAt: result.generatedAt,
      durationMs: result.durationMs,
      filesAnalyzed: result.filesAnalyzed,
      score: summary.score ?? 0,
      grade: grade(summary.score ?? 0),
      checks: {
        passed: passedPages,
        failed: summary.errors ?? 0,
        warnings: summary.warnings ?? 0,
        total: result.filesAnalyzed ?? 0
      },
      summary,
      issues,
      worstPages: result.worstPages || [],
      truncatedIssues: result.truncatedIssues || false
    });
  } catch (error) {
    console.error('seo-audit', error);
    return response.status(500).json({ error: 'No se pudo ejecutar Auditor SEO global', detail: error?.message || String(error) });
  }
}
