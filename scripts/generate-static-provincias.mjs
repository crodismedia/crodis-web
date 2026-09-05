import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MUNICIPIOS_INDEX = path.join(ROOT, "municipios", "index.html");
const MUNICIPIOS_DIR = path.join(ROOT, "municipios");
const PROVINCIAS_DIR = path.join(ROOT, "provincias");

const PROVINCIAS = {
  "03": { key: "alicante", nombre: "Alicante" },
  "12": { key: "castellon", nombre: "Castellón" },
  "46": { key: "valencia", nombre: "Valencia" }
};

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readMunicipios() {
  const html = fs.readFileSync(MUNICIPIOS_INDEX, "utf8");
  const rx = /<li\s+data-nombre="([^"]*)">\s*<a\s+href="([^"]+)">\s*<strong>([\s\S]*?)<\/strong>\s*<span>(\d{5})<\/span>\s*<\/a>\s*<\/li>/gi;
  const rows = [];
  let match;
  while ((match = rx.exec(html))) {
    rows.push({
      dataNombre: match[1],
      href: match[2],
      nombreHTML: match[3],
      codigo: match[4]
    });
  }
  if (!rows.length) throw new Error("No se pudieron leer los municipios estáticos");
  return rows;
}

function workshopCount(fileName) {
  const filePath = path.join(MUNICIPIOS_DIR, fileName);
  if (!fs.existsSync(filePath)) return 0;
  const html = fs.readFileSync(filePath, "utf8");
  const matches = html.match(/<article\b[^>]*class="[^"]*\btaller-card\b[^"]*"/gi);
  return matches ? matches.length : 0;
}

function renderMunicipios(rows) {
  return rows.map(row => {
    const count = workshopCount(row.href);
    const etiqueta = count === 1 ? "1 taller" : `${count} talleres`;
    return `                <li data-nombre="${escapeHTML(row.dataNombre)}"><a href="../municipios/${escapeHTML(row.href)}"><strong>${row.nombreHTML}</strong><span>${etiqueta}</span></a></li>`;
  }).join("\n");
}

function injectMunicipios(html, rendered) {
  const rx = /(<ul\s+id="lista-municipios-provincia"\s+class="lista-municipios"[^>]*>)[\s\S]*?(<\/ul>)/i;
  if (!rx.test(html)) throw new Error("No se encontró lista-municipios-provincia");
  return html.replace(rx, `$1\n${rendered}\n            $2`);
}

function removeDynamicProvinceSection(html) {
  return html.replace(/\n\s*<section class="seccion seccion-gris">[\s\S]*?<\/section>\s*(?=\n\s*<section class="seccion">)/i, "\n");
}

function removeProvinceRuntime(html) {
  return html
    .replace(/\n\s*<script>[\s\S]*?listaTalleres(?:Alicante|Castellon|Valencia)[\s\S]*?<\/script>/gi, "")
    .replace(/\n\s*<script\s+src="[^\"]*(?:provincia|supabase)[^\"]*"[^>]*><\/script>/gi, "");
}

function addStaticNote(html, provinceName, totalMunicipios, totalTalleres) {
  const marker = /(<ul\s+id="lista-municipios-provincia"[\s\S]*?<\/ul>)/i;
  const note = `\n            <p class="municipio-intro" style="margin-top:18px">Directorio estático: ${totalMunicipios} municipios y ${totalTalleres} ${totalTalleres === 1 ? "taller publicado" : "talleres publicados"} enlazados directamente en HTML.</p>`;
  return html.replace(marker, `$1${note}`);
}

const municipios = readMunicipios();
let changed = 0;

for (const [prefix, provincia] of Object.entries(PROVINCIAS)) {
  const rows = municipios.filter(row => row.codigo.startsWith(prefix));
  if (!rows.length) throw new Error(`No hay municipios para ${provincia.nombre}`);

  const counts = rows.map(row => workshopCount(row.href));
  const totalTalleres = counts.reduce((a, b) => a + b, 0);
  const rendered = renderMunicipios(rows);
  const filePath = path.join(PROVINCIAS_DIR, `${provincia.key}.html`);
  let html = fs.readFileSync(filePath, "utf8");

  html = injectMunicipios(html, rendered);
  html = removeDynamicProvinceSection(html);
  html = removeProvinceRuntime(html);
  html = html.replace(/<p class="municipio-intro" style="margin-top:18px">Directorio estático:[\s\S]*?<\/p>/i, "");
  html = addStaticNote(html, provincia.nombre, rows.length, totalTalleres);

  fs.writeFileSync(filePath, html, "utf8");
  changed += 1;
  console.log(`${provincia.nombre}: ${rows.length} municipios · ${totalTalleres} talleres`);
}

console.log(`OK: ${changed} páginas provinciales convertidas a directorios HTML estáticos.`);
