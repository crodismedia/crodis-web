import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export const config = { maxDuration: 60 };

const require = createRequire(import.meta.url);
const { GlobalSEOAuditor } = require('../seo-auditor-global.cjs');

const OWNER = 'crodismedia';
const REPO = 'crodis-web';
const BRANCH = 'main';
const MAX_FILES_PER_RUN = 100;
const INDEXABLE_KINDS = new Set(['home', 'taller', 'municipio', 'provincia', 'servicio', 'desguace', 'desguaces-index']);

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

function githubToken() {
  return process.env.GITHUB_WRITE_TOKEN || process.env.GITHUB_PAT || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
}

function canonicalFor(rel) {
  if (rel === 'index.html') return 'https://www.tallermap.es/';
  return `https://www.tallermap.es/${rel}`;
}

function addViewport(html) {
  if (/<meta\s+[^>]*name=["']viewport["']/i.test(html)) return { html, changed: false };
  const tag = '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  if (/<meta\s+charset=/i.test(html)) {
    return { html: html.replace(/(<meta\s+charset=[^>]+>\s*)/i, `$1\n${tag}`), changed: true };
  }
  return { html: html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`), changed: true };
}

function addCanonical(html, rel) {
  if (/<link\s+[^>]*rel=["']canonical["']/i.test(html)) return { html, changed: false };
  const tag = `  <link rel="canonical" href="${canonicalFor(rel)}">\n`;
  if (/<\/title>/i.test(html)) return { html: html.replace(/<\/title>\s*/i, match => `${match}\n${tag}`), changed: true };
  return { html: html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`), changed: true };
}

function fixPublicNoindex(html) {
  const re = /<meta\s+([^>]*name=["']robots["'][^>]*)>/i;
  const match = html.match(re);
  if (!match || !/noindex/i.test(match[0])) return { html, changed: false };
  const updated = match[0].replace(/content=["'][^"']*["']/i, 'content="index,follow,max-image-preview:large"');
  return { html: html.replace(match[0], updated), changed: updated !== match[0] };
}

function safeFix(page, root) {
  const file = path.join(root, page.page);
  if (!fs.existsSync(file)) return null;
  let html = fs.readFileSync(file, 'utf8');
  const changes = [];

  if (!/^\s*<!doctype html>/i.test(html)) {
    html = `<!DOCTYPE html>\n${html.replace(/^\s+/, '')}`;
    changes.push('doctype');
  }

  if (!/<html\b[^>]*\blang=/i.test(html)) {
    const next = html.replace(/<html(\s[^>]*)?>/i, match => match.replace(/>$/, ' lang="es">'));
    if (next !== html) { html = next; changes.push('lang'); }
  }

  const viewport = addViewport(html);
  if (viewport.changed) { html = viewport.html; changes.push('viewport'); }

  if (INDEXABLE_KINDS.has(page.kind)) {
    const canonical = addCanonical(html, page.page);
    if (canonical.changed) { html = canonical.html; changes.push('canonical'); }

    const robots = fixPublicNoindex(html);
    if (robots.changed) { html = robots.html; changes.push('robots-index'); }
  }

  if (!changes.length) return null;
  return { path: page.page, content: html, changes };
}

async function gh(pathname, token, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `GitHub HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function commitFiles(files, token) {
  const ref = await gh(`/git/ref/heads/${BRANCH}`, token);
  const parentSha = ref.object.sha;
  const parent = await gh(`/git/commits/${parentSha}`, token);

  const tree = await gh('/git/trees', token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map(file => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: file.content
      }))
    })
  });

  const commit = await gh('/git/commits', token, {
    method: 'POST',
    body: JSON.stringify({
      message: `fix: aplicar correcciones SEO seguras (${files.length} archivos)`,
      tree: tree.sha,
      parents: [parentSha]
    })
  });

  await gh(`/git/refs/heads/${BRANCH}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return commit.sha;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    const token = githubToken();
    if (!token) {
      return response.status(503).json({
        error: 'Falta permiso de escritura en GitHub',
        detail: 'Añade en Vercel una variable GITHUB_WRITE_TOKEN con permiso Contents: Read and write sobre crodismedia/crodis-web.',
        code: 'github_write_token_missing'
      });
    }

    const root = process.cwd();
    const audit = new GlobalSEOAuditor(root).audit();
    const candidates = audit.pages.map(page => safeFix(page, root)).filter(Boolean);
    const selected = candidates.slice(0, MAX_FILES_PER_RUN);

    if (!selected.length) {
      return response.status(200).json({
        ok: true,
        saved: false,
        message: 'No hay correcciones automáticas seguras pendientes.',
        remaining: 0,
        filesChanged: 0,
        fixes: {}
      });
    }

    const commitSha = await commitFiles(selected, token);
    const fixes = {};
    for (const file of selected) for (const fix of file.changes) fixes[fix] = (fixes[fix] || 0) + 1;

    return response.status(200).json({
      ok: true,
      saved: true,
      branch: BRANCH,
      commit: commitSha,
      filesChanged: selected.length,
      remaining: Math.max(0, candidates.length - selected.length),
      fixes,
      message: `Correcciones SEO seguras guardadas en ${BRANCH}. Vercel iniciará un nuevo despliegue.`
    });
  } catch (error) {
    console.error('seo-fix-save', error);
    const status = error?.status === 401 || error?.status === 403 ? 503 : 500;
    return response.status(status).json({
      error: status === 503 ? 'GitHub rechazó el permiso de escritura' : 'No se pudieron guardar las correcciones SEO',
      detail: error?.message || String(error)
    });
  }
}
