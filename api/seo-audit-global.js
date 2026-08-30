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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    const auditor = new GlobalSEOAuditor(process.cwd());
    const result = auditor.audit();
    return response.status(200).json({
      ok: true,
      source: 'seo-auditor-global.cjs',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      generatedAt: result.generatedAt,
      durationMs: result.durationMs,
      filesAnalyzed: result.filesAnalyzed,
      summary: result.summary,
      worstPages: result.worstPages,
      issues: result.issues,
      truncatedIssues: result.truncatedIssues
    });
  } catch (error) {
    console.error('seo-audit-global', error);
    return response.status(500).json({ error: 'No se pudo ejecutar el Auditor SEO global', detail: error?.message || String(error) });
  }
}
