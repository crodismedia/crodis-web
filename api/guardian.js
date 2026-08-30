import { createRequire } from 'node:module';

export const config = { maxDuration: 60 };

const require = createRequire(import.meta.url);
const { QualityGuard } = require('../quality-guard.cjs');

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

function isVercelPackagingNoise(issue) {
  if (!process.env.VERCEL) return false;
  if (issue?.file !== 'project') return false;
  const message = String(issue?.message || '');
  return message === 'Archivo de configuración faltante: README.md' ||
    message === 'Carpetas faltantes: scripts';
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const output = [];
    const capture = (...args) => output.push(args.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' '));

    console.log = capture;
    console.warn = capture;
    console.error = capture;

    try {
      const guard = new QualityGuard();
      guard.generateReport = () => {};
      guard.analyzeProject();

      const issues = (guard.issues || []).filter(issue => !isVercelPackagingNoise(issue));
      const errors = issues.filter(issue => issue.severity === 'error').length;
      const warnings = issues.filter(issue => issue.severity === 'warning').length;
      const infos = issues.filter(issue => issue.severity === 'info').length;
      const metrics = {
        ...guard.metrics,
        totalErrors: errors,
        totalWarnings: warnings,
        score: Math.min(100, guard.metrics.score)
      };

      return response.status(200).json({
        ok: true,
        source: 'quality-guard.cjs',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'main',
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        generatedAt: new Date().toISOString(),
        summary: {
          score: metrics.score,
          grade: guard.getGrade(metrics.score),
          errors,
          warnings,
          infos,
          totalIssues: issues.length
        },
        metrics,
        issues: issues.slice(0, 500),
        truncated: issues.length > 500,
        output: output.slice(-80)
      });
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  } catch (error) {
    console.error('guardian', error);
    return response.status(500).json({ error: 'No se pudo ejecutar Guardian', detail: error?.message || String(error) });
  }
}
