import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MUNICIPIOS_DIR = path.join(ROOT, "municipios");
const DATA_FILE = path.join(ROOT, "datos", "servicios-fichas.json");
const WRITE = process.argv.includes("--write");

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

if (!fs.existsSync(DATA_FILE)) {
  throw new Error("Falta datos/servicios-fichas.json. Ejecuta antes npm run recopilar:servicios-fichas");
}
if (!fs.existsSync(MUNICIPIOS_DIR)) throw new Error("No existe la carpeta municipios");

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const talleres = data?.talleres || {};

const files = fs.readdirSync(MUNICIPIOS_DIR)
  .filter(name => /^[a-z0-9-]+-\d{5}\.html$/i.test(name))
  .sort((a, b) => a.localeCompare(b, "es"));

let municipiosConCambios = 0;
let tarjetasRevisadas = 0;
let tarjetasCambiadas = 0;
let tarjetasSinFicha = 0;
let tarjetasSinServicios = 0;
const ejemplosSinFicha = [];

for (const fileName of files) {
  const filePath = path.join(MUNICIPIOS_DIR, fileName);
  const original = fs.readFileSync(filePath, "utf8");
  let changedInFile = 0;

  const updated = original.replace(
    /<article\b([^>]*\bclass=["'][^"']*\btaller-card\b[^"']*["'][^>]*)>([\s\S]*?)<\/article>/gi,
    (articleFull, attrs, body) => {
      tarjetasRevisadas += 1;
      const slug = attrs.match(/\bdata-taller-slug=["']([^"']+)["']/i)?.[1] || "";
      if (!slug || !Object.prototype.hasOwnProperty.call(talleres, slug)) {
        tarjetasSinFicha += 1;
        if (ejemplosSinFicha.length < 20) ejemplosSinFicha.push(`${fileName} :: ${slug || "sin-slug"}`);
        return articleFull;
      }

      const services = Array.isArray(talleres[slug]) ? talleres[slug] : [];
      if (!services.length) {
        tarjetasSinServicios += 1;
        return articleFull;
      }

      const serviceHTML = services
        .filter(item => item && item.label)
        .map(item => `<span data-servicio="${escapeHTML(item.slug || "")}">${escapeHTML(item.label)}</span>`)
        .join("");

      if (!serviceHTML) {
        tarjetasSinServicios += 1;
        return articleFull;
      }

      let replaced = false;
      const newBody = body.replace(
        /<div\b([^>]*\bclass=["'][^"']*\bespecialidades\b[^"']*["'][^>]*)>[\s\S]*?<\/div>/i,
        (_old, divAttrs) => {
          replaced = true;
          return `<div${divAttrs}>${serviceHTML}</div>`;
        }
      );

      if (!replaced || newBody === body) return articleFull;
      changedInFile += 1;
      tarjetasCambiadas += 1;
      return `<article${attrs}>${newBody}</article>`;
    }
  );

  if (changedInFile > 0) {
    municipiosConCambios += 1;
    if (WRITE) fs.writeFileSync(filePath, updated, "utf8");
  }
}

console.log(`Municipios revisados: ${files.length}`);
console.log(`Tarjetas revisadas: ${tarjetasRevisadas}`);
console.log(`Tarjetas con servicios distintos: ${tarjetasCambiadas}`);
console.log(`Municipios con cambios: ${municipiosConCambios}`);
console.log(`Tarjetas sin ficha individual asociada: ${tarjetasSinFicha}`);
console.log(`Tarjetas cuya ficha no publica servicios: ${tarjetasSinServicios}`);
console.log(WRITE ? "MODO ESCRITURA: cambios aplicados." : "MODO COMPROBACIÓN: no se ha modificado ningún HTML.");

if (ejemplosSinFicha.length) {
  console.log("Ejemplos sin ficha asociada:");
  ejemplosSinFicha.forEach(item => console.log(` - ${item}`));
}
