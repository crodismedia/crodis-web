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

const rows = fs.readFileSync(SOURCE, "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1);

const catalog = rows.map((row) => {
  const [nombre, codigo, archivo] = row.split(";");
  const filePath = path.join(ROOT, archivo || "");

  if (!nombre || !codigo || !archivo || !fs.existsSync(filePath)) {
    throw new Error(`Municipio incompleto o sin HTML: ${row}`);
  }

  return {
    nombre,
    codigo,
    ruta: `/${archivo.replaceAll("\\", "/")}`,
    postales: postalCodesFrom(fs.readFileSync(filePath, "utf8"))
  };
});

if (catalog.length !== 542) {
  throw new Error(`Se esperaban 542 municipios y se encontraron ${catalog.length}`);
}

const output = [
  "/* Archivo generado desde datos/municipios.csv y los HTML municipales. */",
  "/* No consulta bases de datos ni API en el navegador. */",
  `window.TallerMapMunicipiosEstaticos=Object.freeze(${JSON.stringify(catalog)});`,
  ""
].join("\n");

fs.writeFileSync(OUTPUT, output, "utf8");
console.log(`OK: catálogo estático de portada generado con ${catalog.length} municipios.`);
