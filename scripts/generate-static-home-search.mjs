import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "datos", "municipios.csv");
const OUTPUT = path.join(ROOT, "js", "catalogo-municipios-estatico.js");

function postalCodesFrom(html) {
  const postales = new Set();
  const locationPattern = /<p\s+class="ubicacion"[^>]*>([\s\S]*?)<\/p>/gi;
  let locationMatch;

  while ((locationMatch = locationPattern.exec(html))) {
    const matches = locationMatch[1].match(/\b(?:03|12|46)\d{3}\b/g) || [];
    matches.forEach(code => postales.add(code));
  }

  return [...postales].sort();
}

function workshopCount(html) {
  return (html.match(/<article\b[^>]*\bclass="[^"]*\btaller-card\b[^"]*"/gi) || []).length;
}

const rows = fs.readFileSync(SOURCE, "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1);

if (rows.length !== 542) {
  throw new Error(`Se esperaban 542 municipios en la fuente y se encontraron ${rows.length}`);
}

const catalog = rows.map((row) => {
  const [nombre, codigo, archivo] = row.split(";");
  const filePath = path.join(ROOT, archivo || "");

  if (!nombre || !codigo || !archivo || !fs.existsSync(filePath)) {
    throw new Error(`Municipio incompleto o sin HTML: ${row}`);
  }

  const html = fs.readFileSync(filePath, "utf8");

  return {
    nombre,
    codigo,
    ruta: `/${archivo.replaceAll("\\", "/")}`,
    postales: postalCodesFrom(html),
    talleres: workshopCount(html)
  };
})
.filter(item => item.talleres > 0)
.map(({ talleres, ...item }) => item);

if (!catalog.length) {
  throw new Error("No se encontraron municipios con talleres publicados.");
}

const output = [
  "/* Archivo generado desde datos/municipios.csv y HTML municipales con al menos un taller publicado. */",
  "/* No consulta bases de datos ni API en el navegador. */",
  `window.TallerMapMunicipiosEstaticos=Object.freeze(${JSON.stringify(catalog)});`,
  ""
].join("\n");

fs.writeFileSync(OUTPUT, output, "utf8");
console.log(`OK: catálogo estático de portada generado con ${catalog.length} municipios con talleres; ${rows.length - catalog.length} municipios vacíos excluidos.`);
