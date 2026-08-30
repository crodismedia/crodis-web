#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const BASE = new URL(args.url || 'https://www.tallermap.es');
const MAX_PAGES = Number(args['max-pages'] || 6000);
const CONCURRENCY = Number(args.concurrency || 12);
const TIMEOUT = Number(args.timeout || 15000);
const STRICT = Boolean(args.strict);
const OUT_DIR = path.resolve(args.out || 'audit-reports');
fs.mkdirSync(OUT_DIR, { recursive: true });

const now = new Date().toISOString();
const report = {
  version: 2,
  target: BASE.origin,
  startedAt: now,
  config: { maxPages: MAX_PAGES, concurrency: CONCURRENCY, timeoutMs: TIMEOUT },
  discovery: { robots: null, sitemaps: [], sitemapUrls: 0 },
  totals: {},
  pages: [],
  issues: [],
  duplicates: { titles: [], descriptions: [], content: [] },
  graph: { orphanSitemapPages: [], zeroInboundPages: [] },
  securityHeaders: {},
  score: 100
};

function issue(severity, type, url, message, extra = {}) {
  report.issues.push({ severity, type, url, message, ...extra });
}

function decode(s='') { return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function stripTags(html='') { return decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()); }
function attr(tag, name) { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? decode(m[1].trim()) : null; }
function meta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const n = attr(tag,'name') || attr(tag,'property');
    if (n && n.toLowerCase() === name.toLowerCase()) return attr(tag,'content');
  }
  return null;
}
function links(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try { out.push(new URL(decode(m[1]), base).href.split('#')[0]); } catch {}
  }
  return [...new Set(out)];
}
function canonical(html, base) {
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if ((attr(tag,'rel') || '').toLowerCase().split(/\s+/).includes('canonical')) {
      try { return new URL(attr(tag,'href'), base).href.split('#')[0]; } catch {}
    }
  }
  return null;
}
function jsonLdTypes(html) {
  const types = [];
  const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1].trim());
      const walk = v => {
        if (!v || typeof v !== 'object') return;
        if (v['@type']) types.push(...(Array.isArray(v['@type']) ? v['@type'] : [v['@type']]));
        for (const x of Object.values(v)) if (typeof x === 'object') walk(x);
      };
      walk(data);
    } catch { types.push('__INVALID_JSONLD__'); }
  }
  return [...new Set(types)];
}
function normalizeUrl(raw) {
  try {
    const u = new URL(raw, BASE);
    u.hash = '';
    if (u.origin !== BASE.origin) return null;
    u.searchParams.sort();
    return u.href;
  } catch { return null; }
}
function hashContent(text) { return crypto.createHash('sha1').update(text.toLowerCase().replace(/\d+/g,'#')).digest('hex'); }

async function fetchWithTimeout(url, opts={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const started = performance.now();
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { 'user-agent':'TallerMap-Guardian-V2/1.0 (+https://www.tallermap.es)', ...(opts.headers||{}) } });
    return { res, ms: Math.round(performance.now()-started) };
  } finally { clearTimeout(timer); }
}

async function fetchText(url, opts={}) {
  const { res, ms } = await fetchWithTimeout(url, opts);
  const text = await res.text();
  return { res, text, ms };
}

async function resolveRedirectChain(url) {
  const chain = [];
  let current = url;
  for (let i=0;i<6;i++) {
    try {
      const { res, ms } = await fetchWithTimeout(current, { redirect:'manual' });
      chain.push({ url: current, status: res.status, ms, location: res.headers.get('location') });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).href;
        continue;
      }
      return { chain, finalUrl: current, finalStatus: res.status };
    } catch (e) { return { chain, finalUrl: current, finalStatus: 0, error: String(e) }; }
  }
  return { chain, finalUrl: current, finalStatus: chain.at(-1)?.status || 0, loop:true };
}

async function discoverSitemaps() {
  const candidates = new Set([
    new URL('/sitemap.xml', BASE).href,
    new URL('/sitemap-municipios.xml', BASE).href,
    new URL('/sitemap-provincias.xml', BASE).href,
    new URL('/sitemap-talleres.xml', BASE).href,
    new URL('/sitemap-desguaces.xml', BASE).href,
    new URL('/servicios/sitemap.xml', BASE).href,
  ]);
  try {
    const { res, text } = await fetchText(new URL('/robots.txt', BASE));
    report.discovery.robots = { status: res.status, text };
    for (const m of text.matchAll(/^\s*Sitemap:\s*(\S+)/gmi)) candidates.add(m[1]);
  } catch (e) { issue('error','robots',BASE.origin,'No se pudo descargar robots.txt',{error:String(e)}); }

  const urls = new Set();
  const seen = new Set();
  async function readMap(sm, depth=0) {
    if (depth > 3 || seen.has(sm)) return;
    seen.add(sm);
    try {
      const { res, text } = await fetchText(sm);
      if (!res.ok) { issue('error','sitemap',sm,`Sitemap HTTP ${res.status}`); return; }
      report.discovery.sitemaps.push(sm);
      const locs = [...text.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map(m=>decode(m[1].trim()));
      if (/<sitemapindex\b/i.test(text)) {
        for (const loc of locs) await readMap(loc, depth+1);
      } else {
        for (const loc of locs) { const n=normalizeUrl(loc); if (n) urls.add(n); }
      }
    } catch (e) { issue('error','sitemap',sm,'Error leyendo sitemap',{error:String(e)}); }
  }
  for (const sm of candidates) await readMap(sm);
  report.discovery.sitemapUrls = urls.size;
  return urls;
}

function robotsBlocked(url) {
  const text = report.discovery.robots?.text || '';
  const pathName = new URL(url).pathname;
  const disallows = [...text.matchAll(/^\s*Disallow:\s*(\S*)/gmi)].map(m=>m[1]).filter(Boolean);
  return disallows.some(d => d !== '/' && pathName.startsWith(d));
}

async function analyzePage(url) {
  const row = { url, status:0, finalUrl:url, redirects:[], ttfbMs:null, bytes:0, title:null, description:null, canonical:null, robots:null, h1:[], words:0, internalLinks:[], externalLinks:[], images:0, imagesWithoutAlt:0, jsonLdTypes:[], contentHash:null };
  const chain = await resolveRedirectChain(url);
  row.redirects = chain.chain;
  row.finalUrl = chain.finalUrl;
  row.status = chain.finalStatus;
  if (chain.loop) issue('error','redirect-loop',url,'Cadena de redirecciones superior a 6 saltos');
  if (chain.chain.length > 2) issue('warning','redirect-chain',url,`Cadena de ${chain.chain.length-1} redirecciones`);
  if (!row.status || row.status >= 400) { issue('error','http',url,`HTTP ${row.status || 'sin respuesta'}`); return row; }
  if (row.status >= 300) { issue('warning','redirect',url,`URL redirige con HTTP ${row.status}`); return row; }

  try {
    const { res, text, ms } = await fetchText(row.finalUrl, { redirect:'follow' });
    row.status = res.status; row.ttfbMs = ms; row.bytes = Buffer.byteLength(text);
    if (!report.securityHeaders.sample) {
      report.securityHeaders.sample = row.finalUrl;
      for (const h of ['strict-transport-security','content-security-policy','x-content-type-options','referrer-policy','permissions-policy']) report.securityHeaders[h] = res.headers.get(h);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return row;

    row.title = decode((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').trim() || null;
    row.description = meta(text,'description');
    row.robots = meta(text,'robots');
    row.canonical = canonical(text,row.finalUrl);
    row.h1 = [...text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>stripTags(m[1])).filter(Boolean);
    const bodyText = stripTags((text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)||[])[1] || text);
    row.words = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
    row.contentHash = hashContent(bodyText);
    row.jsonLdTypes = jsonLdTypes(text);

    const allLinks = links(text,row.finalUrl);
    row.internalLinks = allLinks.map(normalizeUrl).filter(Boolean);
    row.externalLinks = allLinks.filter(x => !normalizeUrl(x) && /^https?:/i.test(x));

    const imgs = text.match(/<img\b[^>]*>/gi) || [];
    row.images = imgs.length;
    row.imagesWithoutAlt = imgs.filter(t => attr(t,'alt') === null).length;

    if (!row.title) issue('error','title',url,'Falta <title>');
    else if (row.title.length < 25 || row.title.length > 65) issue('warning','title-length',url,`Title de ${row.title.length} caracteres`);
    if (!row.description) issue('warning','description',url,'Falta meta description');
    else if (row.description.length < 70 || row.description.length > 170) issue('warning','description-length',url,`Description de ${row.description.length} caracteres`);
    if (row.h1.length !== 1) issue(row.h1.length===0?'error':'warning','h1',url,`Número de H1: ${row.h1.length}`);
    if (!row.canonical) issue('warning','canonical',url,'Falta canonical');
    else {
      const c = normalizeUrl(row.canonical);
      if (!c) issue('error','canonical-host',url,`Canonical fuera del dominio: ${row.canonical}`);
      else if (c !== normalizeUrl(row.finalUrl)) issue('warning','canonical-non-self',url,`Canonical no autorreferente: ${row.canonical}`);
    }
    if (/noindex/i.test(row.robots||'')) issue('error','noindex',url,'URL rastreada con noindex');
    if (robotsBlocked(url)) issue('error','robots-block',url,'URL del sitemap parece bloqueada por robots.txt');
    if (row.words < 120 && !/\.(xml|txt)$/i.test(new URL(url).pathname)) issue('warning','thin-content',url,`Contenido escaso: ${row.words} palabras`);
    if (row.imagesWithoutAlt) issue('error','image-alt',url,`${row.imagesWithoutAlt}/${row.images} imágenes sin alt`);
    if (row.jsonLdTypes.includes('__INVALID_JSONLD__')) issue('error','jsonld',url,'JSON-LD inválido');
    if (new URL(url).pathname.startsWith('/talleres/') && !row.jsonLdTypes.some(t=>/LocalBusiness|AutoRepair|AutomotiveBusiness/i.test(t))) issue('warning','local-schema',url,'Ficha de taller sin schema LocalBusiness/AutoRepair detectable');
    if (row.ttfbMs > 2500) issue('warning','slow-response',url,`Respuesta lenta: ${row.ttfbMs} ms`);
    if (row.bytes > 2_000_000) issue('warning','html-size',url,`HTML grande: ${(row.bytes/1024/1024).toFixed(2)} MB`);
  } catch (e) { issue('error','fetch',url,'Error al descargar HTML',{error:String(e)}); }
  return row;
}

async function pool(items, worker) {
  let i = 0;
  const out = new Array(items.length);
  async function run() { while (true) { const idx=i++; if (idx>=items.length) return; out[idx]=await worker(items[idx],idx); } }
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},run));
  return out;
}

function duplicateGroups(field, min=2) {
  const map = new Map();
  for (const p of report.pages) {
    const v = p[field]; if (!v) continue;
    if (!map.has(v)) map.set(v,[]); map.get(v).push(p.url);
  }
  return [...map.entries()].filter(([,u])=>u.length>=min).map(([value,urls])=>({value,urls,count:urls.length})).sort((a,b)=>b.count-a.count);
}

function scoreReport() {
  const weights = { error:2.5, warning:0.35, info:0 };
  const penalty = report.issues.reduce((s,x)=>s+(weights[x.severity]||0),0);
  report.score = Math.max(0, Math.round((100-penalty)*10)/10);
}

function markdown() {
  const t=report.totals;
  const top = report.issues.slice(0,200).map(i=>`- **${i.severity.toUpperCase()} · ${i.type}** — ${i.url || ''} — ${i.message}`).join('\n');
  return `# TallerMap Deep Audit V2\n\nFecha: ${report.finishedAt}\n\n## Resultado\n\n- Score: **${report.score}/100**\n- URLs sitemap: **${report.discovery.sitemapUrls}**\n- Páginas analizadas: **${t.pages}**\n- HTTP 2xx: **${t.ok}**\n- Errores: **${t.errors}**\n- Advertencias: **${t.warnings}**\n- Titles duplicados: **${report.duplicates.titles.length} grupos**\n- Descriptions duplicadas: **${report.duplicates.descriptions.length} grupos**\n- Contenido duplicado: **${report.duplicates.content.length} grupos**\n- URLs de sitemap sin enlaces entrantes: **${report.graph.orphanSitemapPages.length}**\n\n## Problemas (máx. 200)\n\n${top || 'Ninguno'}\n`;
}

async function main() {
  console.log(`🔎 Deep SEO Audit V2 → ${BASE.origin}`);
  const sitemapUrls = await discoverSitemaps();
  const seeds = [...sitemapUrls].slice(0,MAX_PAGES);
  if (!seeds.includes(BASE.href)) seeds.unshift(BASE.href);
  console.log(`🗺️ Sitemaps: ${report.discovery.sitemaps.length}; URLs: ${sitemapUrls.size}; analizar: ${seeds.length}`);
  report.pages = await pool(seeds, async (u,idx)=>{ if (idx % 100 === 0) console.log(`   ${idx}/${seeds.length}`); return analyzePage(u); });

  report.duplicates.titles = duplicateGroups('title');
  report.duplicates.descriptions = duplicateGroups('description');
  report.duplicates.content = duplicateGroups('contentHash').map(g=>({hash:g.value,urls:g.urls,count:g.count}));
  for (const g of report.duplicates.titles) issue('warning','duplicate-title',g.urls[0],`${g.count} URLs comparten title`,{urls:g.urls.slice(0,20)});
  for (const g of report.duplicates.descriptions) issue('warning','duplicate-description',g.urls[0],`${g.count} URLs comparten description`,{urls:g.urls.slice(0,20)});
  for (const g of report.duplicates.content) if (g.count>1) issue('warning','duplicate-content',g.urls[0],`${g.count} URLs con contenido prácticamente idéntico`,{urls:g.urls.slice(0,20)});

  const inbound = new Map(report.pages.map(p=>[normalizeUrl(p.url),0]));
  for (const p of report.pages) for (const l of p.internalLinks||[]) if (inbound.has(l)) inbound.set(l,inbound.get(l)+1);
  const home = normalizeUrl(BASE.href);
  report.graph.zeroInboundPages = [...inbound.entries()].filter(([u,n])=>u!==home && n===0).map(([u])=>u);
  report.graph.orphanSitemapPages = report.graph.zeroInboundPages.filter(u=>sitemapUrls.has(u));
  for (const u of report.graph.orphanSitemapPages.slice(0,500)) issue('warning','orphan',u,'URL de sitemap sin enlaces internos entrantes detectados');

  report.totals = {
    pages: report.pages.length,
    ok: report.pages.filter(p=>p.status>=200&&p.status<300).length,
    redirects: report.pages.filter(p=>p.redirects?.length>1).length,
    errors: report.issues.filter(i=>i.severity==='error').length,
    warnings: report.issues.filter(i=>i.severity==='warning').length,
    noindex: report.issues.filter(i=>i.type==='noindex').length,
    missingCanonical: report.issues.filter(i=>i.type==='canonical').length,
    missingAlt: report.issues.filter(i=>i.type==='image-alt').length,
  };
  scoreReport();
  report.finishedAt = new Date().toISOString();
  const stamp = report.finishedAt.replace(/[:.]/g,'-');
  const jsonPath = path.join(OUT_DIR,`deep-seo-audit-${stamp}.json`);
  const mdPath = path.join(OUT_DIR,`deep-seo-audit-${stamp}.md`);
  fs.writeFileSync(jsonPath,JSON.stringify(report,null,2));
  fs.writeFileSync(mdPath,markdown());
  console.log(`\n✅ Score ${report.score}/100 | ${report.totals.pages} páginas | ${report.totals.errors} errores | ${report.totals.warnings} advertencias`);
  console.log(`📄 ${jsonPath}`); console.log(`📄 ${mdPath}`);
  if (STRICT && report.totals.errors) process.exitCode=1;
}

main().catch(e=>{ console.error(e); process.exit(2); });
