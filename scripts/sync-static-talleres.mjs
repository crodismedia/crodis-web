import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/server-utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'scripts', 'taller-static-sync.json');
const TALLERES_DIR = path.join(ROOT, 'talleres');
const PUBLIC_RENDER_URL = 'https://www.tallermap.es/api/taller-public';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,180}$/;

async function readState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return { last_sync: data.last_sync || '1970-01-01T00:00:00.000Z' };
  } catch {
    return { last_sync: '1970-01-01T00:00:00.000Z' };
  }
}

async function listChanges(from, to) {
  const pageSize = 1000;
  const maxRows = 5000;
  const rows = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/listar_cambios_talleres_estaticos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Range: `${offset}-${Math.min(offset + pageSize - 1, maxRows - 1)}`
      },
      body: JSON.stringify({ p_desde: from, p_hasta: to })
    });

    if (!response.ok) {
      throw new Error(`Supabase respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const page = await response.json();
    const items = Array.isArray(page) ? page : [];
    rows.push(...items);

    if (items.length < pageSize) break;
  }

  return rows;
}

function fileFor(slug) {
  if (!SLUG_RE.test(slug)) throw new Error(`Slug no válido: ${slug}`);
  return path.join(TALLERES_DIR, slug, 'index.html');
}

async function renderWorkshop(slug, cutoff) {
  const url = new URL(PUBLIC_RENDER_URL);
  url.searchParams.set('slug', slug);
  url.searchParams.set('static_sync', cutoff);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TallerMap-Static-Sync/1.0' }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Render ${slug} respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const html = await response.text();
  if (!/<html[\s>]/i.test(html)) throw new Error(`Render inválido para ${slug}: no contiene HTML.`);
  if (/noindex/i.test(html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] || '')) {
    throw new Error(`Render inválido para ${slug}: contiene noindex.`);
  }

  const canonical = `https://www.tallermap.es/talleres/${slug}`;
  if (!html.includes(canonical)) {
    throw new Error(`Render inválido para ${slug}: canonical inesperado.`);
  }

  return html;
}

async function removeWorkshop(slug) {
  const file = fileFor(slug);
  await fs.rm(path.dirname(file), { recursive: true, force: true });
  console.log(`DELETE ${slug}`);
}

async function upsertWorkshop(slug, cutoff) {
  const file = fileFor(slug);
  const html = await renderWorkshop(slug, cutoff);

  if (html === null) {
    await removeWorkshop(slug);
    console.log(`UPsert convertido en DELETE porque la ficha ya no existe: ${slug}`);
    return;
  }

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html, 'utf8');
  console.log(`UPSERT ${slug}`);
}

async function main() {
  const state = await readState();
  const cutoff = new Date().toISOString();
  const changes = await listChanges(state.last_sync, cutoff);

  console.log(`Ventana: ${state.last_sync} -> ${cutoff}`);
  console.log(`Cambios detectados: ${changes.length}`);

  if (!changes.length) return;

  for (const change of changes) {
    const slug = String(change.slug || '').trim();
    const operation = String(change.operacion || '').trim();

    if (!SLUG_RE.test(slug)) throw new Error(`Cambio con slug no válido: ${slug}`);

    if (operation === 'delete') {
      await removeWorkshop(slug);
    } else if (operation === 'upsert') {
      await upsertWorkshop(slug, cutoff);
    } else {
      throw new Error(`Operación no reconocida para ${slug}: ${operation}`);
    }
  }

  await fs.writeFile(STATE_PATH, `${JSON.stringify({ last_sync: cutoff }, null, 2)}\n`, 'utf8');
  console.log(`Sincronización completada: ${changes.length} ficha(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
