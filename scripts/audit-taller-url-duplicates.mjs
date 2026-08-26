import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SITE_URL = "https://www.tallermap.es";
const SITEMAP_URL = `${SITE_URL}/sitemap-talleres.xml`;
const REPORT_DIR = path.resolve(process.cwd(), "reports");
const DEFAULT_CONCURRENCY = 20;
const MAX_REDIRECTS = 8;
const REQUEST_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const options = {
    limit: null,
    concurrency: DEFAULT_CONCURRENCY,
    slug: "",
    output: REPORT_DIR
  };

  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) options.limit = Math.floor(value);
    } else if (arg.startsWith("--concurrency=")) {
      const value = Number(arg.slice("--concurrency=".length));
      if (Number.isFinite(value) && value > 0) options.concurrency = Math.min(50, Math.floor(value));
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.slice("--slug=".length).trim();
    } else if (arg.startsWith("--output=")) {
      options.output = path.resolve(process.cwd(), arg.slice("--output=".length).trim());
    }
  }

  return options;
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
}

function slugFromCanonicalUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/talleres\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function variantsForSlug(slug) {
  const encoded = encodeURIComponent(slug);
  const clean = `${SITE_URL}/talleres/${encoded}`;
  return [
    { key: "canonica", url: clean },
    { key: "slash_final", url: `${clean}/` },
    { key: "index_html", url: `${clean}/index.html` },
    { key: "legacy", url: `${SITE_URL}/pages/taller.html?slug=${encoded}` }
  ];
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function normalizeHtmlForHash(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function extractCanonical(html) {
  const match = String(html || "").match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || String(html || "").match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match ? match[1].trim() : "";
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

async function fetchOne(url) {
  const { signal, cancel } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "TallerMap-URL-Audit/1.0 (+https://www.tallermap.es)"
      },
      signal
    });
  } finally {
    cancel();
  }
}

async function inspectUrl(requestedUrl) {
  const chain = [];
  let currentUrl = requestedUrl;
  let response = null;

  try {
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
      response = await fetchOne(currentUrl);
      const status = response.status;
      const location = response.headers.get("location") || "";
      chain.push({ url: currentUrl, status, location });

      if ([301, 302, 303, 307, 308].includes(status) && location) {
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const html = await response.text();
      return {
        requestedUrl,
        initialStatus: chain[0]?.status || 0,
        finalStatus: status,
        finalUrl: currentUrl,
        redirectCount: chain.length - 1,
        chain,
        canonical: extractCanonical(html),
        title: extractTitle(html),
        contentHash: status === 200 ? sha256(normalizeHtmlForHash(html)) : "",
        bodyBytes: Buffer.byteLength(html, "utf8"),
        error: ""
      };
    }

    return {
      requestedUrl,
      initialStatus: chain[0]?.status || 0,
      finalStatus: response?.status || 0,
      finalUrl: currentUrl,
      redirectCount: chain.length - 1,
      chain,
      canonical: "",
      title: "",
      contentHash: "",
      bodyBytes: 0,
      error: `Demasiadas redirecciones (> ${MAX_REDIRECTS})`
    };
  } catch (error) {
    return {
      requestedUrl,
      initialStatus: chain[0]?.status || 0,
      finalStatus: 0,
      finalUrl: currentUrl,
      redirectCount: chain.length,
      chain,
      canonical: "",
      title: "",
      contentHash: "",
      bodyBytes: 0,
      error: error?.name === "AbortError" ? "Timeout" : String(error?.message || error)
    };
  }
}

function normalizeComparableUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").replace(/\/$/, "");
  }
}

function classifyWorkshop(slug, rows) {
  const expected = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
  const expectedComparable = normalizeComparableUrl(expected);
  const canonicalRow = rows.find((row) => row.variant === "canonica");
  const nonCanonicalRows = rows.filter((row) => row.variant !== "canonica");
  const extra200 = nonCanonicalRows.filter((row) => row.initialStatus === 200);
  const wrongCanonical = rows.filter((row) => row.finalStatus === 200 && row.canonical && normalizeComparableUrl(row.canonical) !== expectedComparable);
  const failed = rows.filter((row) => row.error || row.finalStatus === 0 || row.finalStatus >= 500);
  const cleanNot200 = !canonicalRow || canonicalRow.initialStatus !== 200;

  const flags = [];
  if (cleanNot200) flags.push("CANONICA_NO_200");
  if (extra200.length) flags.push("URL_ALTERNATIVA_200");
  if (wrongCanonical.length) flags.push("CANONICAL_INCORRECTA");
  if (failed.length) flags.push("ERROR_HTTP");
  if (!flags.length) flags.push("OK");

  return {
    slug,
    uniqueUrl: expected,
    status: flags.join("|"),
    alternative200Count: extra200.length,
    alternative200: extra200.map((row) => row.variant).join("|"),
    redirectCount: nonCanonicalRows.filter((row) => [301, 302, 303, 307, 308].includes(row.initialStatus)).length,
    errors: failed.map((row) => `${row.variant}:${row.error || row.finalStatus}`).join("|"),
    canonicalMismatchCount: wrongCanonical.length
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))
  ].join("\n") + "\n";
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
      completed += 1;
      if (completed === 1 || completed % 100 === 0 || completed === items.length) {
        const pct = ((completed / items.length) * 100).toFixed(1);
        console.log(`[${pct}%] ${completed}/${items.length} talleres auditados`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function loadSlugs(options) {
  if (options.slug) return [options.slug];

  console.log(`Leyendo sitemap: ${SITEMAP_URL}`);
  const response = await fetch(SITEMAP_URL, {
    headers: { "User-Agent": "TallerMap-URL-Audit/1.0 (+https://www.tallermap.es)" }
  });
  if (!response.ok) throw new Error(`No se pudo leer el sitemap (${response.status})`);

  const xml = await response.text();
  const slugs = [...new Set(extractSitemapUrls(xml).map(slugFromCanonicalUrl).filter(Boolean))];
  return options.limit ? slugs.slice(0, options.limit) : slugs;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const slugs = await loadSlugs(options);
  if (!slugs.length) throw new Error("No se encontraron talleres para auditar.");

  console.log(`Auditando ${slugs.length} talleres, 4 rutas por taller (${slugs.length * 4} peticiones base).`);
  console.log(`Concurrencia: ${options.concurrency}`);

  const audits = await mapLimit(slugs, options.concurrency, async (slug) => {
    const variants = variantsForSlug(slug);
    const inspected = [];

    for (const variant of variants) {
      const result = await inspectUrl(variant.url);
      inspected.push({
        slug,
        variant: variant.key,
        requestedUrl: variant.url,
        initialStatus: result.initialStatus,
        finalStatus: result.finalStatus,
        redirectCount: result.redirectCount,
        finalUrl: result.finalUrl,
        canonical: result.canonical,
        title: result.title,
        contentHash: result.contentHash,
        bodyBytes: result.bodyBytes,
        redirectChain: result.chain.map((step) => `${step.status}:${step.url}${step.location ? ` -> ${step.location}` : ""}`).join(" || "),
        error: result.error
      });
    }

    return { slug, inspected, summary: classifyWorkshop(slug, inspected) };
  });

  const detailRows = audits.flatMap((audit) => audit.inspected);
  const summaryRows = audits.map((audit) => audit.summary);
  const problems = summaryRows.filter((row) => row.status !== "OK");
  const duplicateAlternatives = summaryRows.filter((row) => row.alternative200Count > 0);

  await mkdir(options.output, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const detailPath = path.join(options.output, `taller-url-audit-${stamp}.csv`);
  const uniquePath = path.join(options.output, `taller-url-unicas-${stamp}.csv`);
  const jsonPath = path.join(options.output, `taller-url-resumen-${stamp}.json`);

  await writeFile(detailPath, toCsv(detailRows, [
    "slug", "variant", "requestedUrl", "initialStatus", "finalStatus", "redirectCount", "finalUrl",
    "canonical", "title", "contentHash", "bodyBytes", "redirectChain", "error"
  ]), "utf8");

  await writeFile(uniquePath, toCsv(summaryRows, [
    "slug", "uniqueUrl", "status", "alternative200Count", "alternative200", "redirectCount",
    "canonicalMismatchCount", "errors"
  ]), "utf8");

  const summary = {
    generatedAt: new Date().toISOString(),
    site: SITE_URL,
    sitemap: SITEMAP_URL,
    workshopsAudited: slugs.length,
    urlsChecked: detailRows.length,
    clean: summaryRows.length - problems.length,
    withProblems: problems.length,
    withAlternative200: duplicateAlternatives.length,
    uniqueRule: "/talleres/:slug debe ser la unica URL 200; las alternativas deben redirigir o desaparecer",
    reportFiles: { detailPath, uniquePath }
  };
  await writeFile(jsonPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log("\n=== RESUMEN ===");
  console.log(`Talleres auditados: ${summary.workshopsAudited}`);
  console.log(`URLs comprobadas: ${summary.urlsChecked}`);
  console.log(`Talleres sin conflicto: ${summary.clean}`);
  console.log(`Talleres con problema: ${summary.withProblems}`);
  console.log(`Talleres con otra variante devolviendo 200: ${summary.withAlternative200}`);
  console.log(`Detalle: ${detailPath}`);
  console.log(`Una URL por taller: ${uniquePath}`);
  console.log(`Resumen JSON: ${jsonPath}`);

  if (problems.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error("Error en auditoria:", error);
  process.exitCode = 1;
});
