import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TALLERES_DIR = path.join(ROOT, "talleres");
const SERVICIOS_JS = path.join(ROOT, "js", "servicios.js");
const OUTPUT = path.join(ROOT, "datos", "servicios-fichas.json");

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-");
}

function readCanonicalServices() {
  if (!fs.existsSync(SERVICIOS_JS)) throw new Error("No existe js/servicios.js");
  const source = fs.readFileSync(SERVICIOS_JS, "utf8");
  const pairPattern = /\[\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\]/g;
  const byLabel = new Map();
  const bySlug = new Map();
  let match;

  while ((match = pairPattern.exec(source))) {
    const slug = String(match[1] || "").trim();
    const label = String(match[2] || "").trim();
    if (!slug || !label || !slug.includes("-")) continue;
    const item = { slug, label };
    byLabel.set(normalize(label), item);
    bySlug.set(slug, item);
  }

  if (!byLabel.size) throw new Error("No se pudo leer el catálogo canónico de js/servicios.js");
  return { byLabel, bySlug };
}

const canonical = readCanonicalServices();

function canonicalize(label) {
  const normalized = normalize(label);
  const direct = canonical.byLabel.get(normalized);
  if (direct) return { ...direct, fuente_slug: "catalogo" };

  const fallbackSlug = slugify(label);
  const bySlug = canonical.bySlug.get(fallbackSlug);
  if (bySlug) return { ...bySlug, fuente_slug: "catalogo" };

  return { label, slug: fallbackSlug, fuente_slug: "fallback" };
}

function extractServices(html) {
  const block = html.match(/<div[^>]+id=["']taller-servicios["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const services = [];
  const seen = new Set();
  const spanPattern = /<span[^>]*>([\s\S]*?)<\/span>/gi;
  let match;

  while ((match = spanPattern.exec(block))) {
    const rawLabel = cleanText(match[1]);
    if (!rawLabel) continue;
    const service = canonicalize(rawLabel);
    if (!service.slug || seen.has(service.slug)) continue;
    seen.add(service.slug);
    services.push(service);
  }

  return services;
}

if (!fs.existsSync(TALLERES_DIR)) throw new Error("No existe la carpeta talleres");

const entries = fs.readdirSync(TALLERES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

const talleres = {};
const catalogo = new Map();
const noCanonicos = new Map();
let conServicios = 0;
let sinServicios = 0;

for (const entry of entries) {
  const ficha = path.join(TALLERES_DIR, entry.name, "index.html");
  if (!fs.existsSync(ficha)) continue;

  const services = extractServices(fs.readFileSync(ficha, "utf8"));
  talleres[entry.name] = services;

  if (services.length) conServicios += 1;
  else sinServicios += 1;

  for (const service of services) {
    if (!catalogo.has(service.slug)) catalogo.set(service.slug, service.label);
    if (service.fuente_slug === "fallback") {
      noCanonicos.set(service.slug, service.label);
    }
  }
}

const payload = {
  generado_desde: "talleres/*/index.html#taller-servicios",
  catalogo_canonico: "js/servicios.js",
  total_fichas: Object.keys(talleres).length,
  fichas_con_servicios: conServicios,
  fichas_sin_servicios: sinServicios,
  servicios_unicos: [...catalogo.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([slug, label]) => ({ slug, label })),
  servicios_no_canonicos: [...noCanonicos.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([slug, label]) => ({ slug, label })),
  talleres
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`OK: ${payload.total_fichas} fichas revisadas; ${payload.servicios_unicos.length} servicios únicos.`);
console.log(`Fichas con servicios: ${payload.fichas_con_servicios}; sin servicios: ${payload.fichas_sin_servicios}.`);
console.log(`Servicios fuera del catálogo canónico: ${payload.servicios_no_canonicos.length}.`);
