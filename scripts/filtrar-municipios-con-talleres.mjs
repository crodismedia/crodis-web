import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSV = path.join(ROOT, "datos", "municipios.csv");
const CATALOG = path.join(ROOT, "js", "catalogo-municipios-estatico.js");
const DIRECTORY = path.join(ROOT, "municipios", "index.html");
const WRITE = process.argv.includes("--write");

function postalCodesFrom(html) {
  const postales = new Set();
  const locationPattern = /<p\s+class="ubicacion"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = locationPattern.exec(html))) {
    const codes = match[1].match(/\b(?:03|12|46)\d{3}\b/g) || [];
    codes.forEach(code => postales.add(code));
  }
  return [...postales].sort();
}

function workshopCount(html) {
  return (html.match(/<article\b[^>]*\bclass="[^"]*\btaller-card\b[^"]*"/gi) || []).length;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

const rows = fs.readFileSync(CSV, "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1);

if (rows.length !== 542) {
  throw new Error(`Se esperaban 542 municipios en CSV y hay ${rows.length}.`);
}

const all = rows.map(row => {
  const [nombre, codigo, archivo] = row.split(";");
  const filePath = path.join(ROOT, archivo || "");
  if (!nombre || !codigo || !archivo || !fs.existsSync(filePath)) {
    throw new Error(`Municipio incompleto o sin HTML: ${row}`);
  }
  const html = fs.readFileSync(filePath, "utf8");
  const talleres = workshopCount(html);
  return {
    nombre,
    codigo,
    archivo: archivo.replaceAll("\\", "/"),
    ruta: `/${archivo.replaceAll("\\", "/")}`,
    postales: postalCodesFrom(html),
    talleres
  };
});

const visible = all.filter(item => item.talleres > 0);
const hidden = all.filter(item => item.talleres === 0);

console.log(`TOTAL_MUNICIPIOS=${all.length}`);
console.log(`CON_TALLERES=${visible.length}`);
console.log(`SIN_TALLERES=${hidden.length}`);
console.log("EJEMPLOS_SIN_TALLERES=" + hidden.slice(0, 20).map(x => x.nombre).join(" | "));

if (!WRITE) {
  console.log("MODO=DRY_RUN");
  process.exit(0);
}

const catalogPayload = visible.map(({ nombre, codigo, ruta, postales }) => ({ nombre, codigo, ruta, postales }));
const catalogOutput = [
  "/* Archivo generado desde datos/municipios.csv y HTML municipales con al menos un taller publicado. */",
  "/* No consulta bases de datos ni API en el navegador. */",
  `window.TallerMapMunicipiosEstaticos=Object.freeze(${JSON.stringify(catalogPayload)});`,
  ""
].join("\n");
fs.writeFileSync(CATALOG, catalogOutput, "utf8");

let directoryHtml = fs.readFileSync(DIRECTORY, "utf8");
const listStart = directoryHtml.indexOf('<ul class="lista-municipios" id="lista-municipios">');
if (listStart < 0) throw new Error("No se encontró lista-municipios en municipios/index.html");
const itemsStart = directoryHtml.indexOf("\n", listStart) + 1;
const listEnd = directoryHtml.indexOf("</ul>", itemsStart);
if (itemsStart <= 0 || listEnd < 0) throw new Error("No se pudo delimitar la lista de municipios.");

const items = visible.map(item => {
  const href = path.posix.basename(item.archivo);
  return `                    <li data-nombre="${escapeHtml(item.nombre.toLocaleLowerCase("es"))}"><a href="${escapeHtml(href)}"><strong>${escapeHtml(item.nombre)}</strong><span>${escapeHtml(item.codigo)}</span></a></li>`;
}).join("\n");

directoryHtml = directoryHtml.slice(0, itemsStart) + items + "\n                " + directoryHtml.slice(listEnd);
fs.writeFileSync(DIRECTORY, directoryHtml, "utf8");

console.log(`MODO=WRITE`);
console.log(`OK: ocultados ${hidden.length} municipios con 0 talleres; visibles ${visible.length}.`);
