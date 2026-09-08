import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TALLERES_DIR = path.join(ROOT, "talleres");
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

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractServices(html) {
  const block = html.match(/<div[^>]+id=["']taller-servicios["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const services = [];
  const spanPattern = /<span[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = spanPattern.exec(block))) {
    const label = cleanText(match[1]);
    if (label) services.push({ label, slug: slugify(label) });
  }
  return services;
}

if (!fs.existsSync(TALLERES_DIR)) throw new Error("No existe la carpeta talleres");

const entries = fs.readdirSync(TALLERES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

const talleres = {};
const catalogo = new Map();
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
  }
}

const payload = {
  generado_desde: "talleres/*/index.html#taller-servicios",
  total_fichas: Object.keys(talleres).length,
  fichas_con_servicios: conServicios,
  fichas_sin_servicios: sinServicios,
  servicios_unicos: [...catalogo.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([slug, label]) => ({ slug, label })),
  talleres
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`OK: ${payload.total_fichas} fichas revisadas; ${payload.servicios_unicos.length} servicios únicos.`);
