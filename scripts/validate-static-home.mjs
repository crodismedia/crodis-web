import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const errors = [];
const requireCondition = (condition, message) => {
  if (!condition) errors.push(message);
};

const home = read("index.html");
const searchRuntime = read("js/buscador-portada-estatico.js");
const catalogRuntime = read("js/catalogo-municipios-estatico.js");
const prefix = "window.TallerMapMunicipiosEstaticos=Object.freeze(";
const start = catalogRuntime.indexOf(prefix);
const end = catalogRuntime.lastIndexOf(");");

requireCondition(start !== -1 && end > start, "El catálogo estático no tiene el formato esperado.");

let catalog = [];
if (start !== -1 && end > start) {
  catalog = JSON.parse(catalogRuntime.slice(start + prefix.length, end));
}

requireCondition(catalog.length === 542, `El catálogo debe contener 542 municipios; contiene ${catalog.length}.`);
requireCondition(/<form[^>]+id="formulario-buscador-publico"[^>]+action="\/municipios\/"[^>]+method="get"/i.test(home), "Falta el formulario con salida HTML estática.");
requireCondition(!/js\/(?:servicios|autocomplete-municipios|taller-urls|imagenes-automaticas)\.js/i.test(home), "La portada todavía carga un runtime dinámico retirado.");
requireCondition(!/supabase|fetch\s*\(/i.test(searchRuntime), "El buscador de portada no debe consultar API ni recursos remotos.");
requireCondition((home.match(/<h1\b/gi) || []).length === 1, "La portada debe tener exactamente un H1.");
requireCondition(/<meta name="robots" content="index,follow,max-image-preview:large">/i.test(home), "La portada debe seguir indexable.");
requireCondition(/<link rel="canonical" href="https:\/\/www\.tallermap\.es\/">/i.test(home), "El canonical de la portada es incorrecto.");

const staticMunicipalityLinks = [...home.matchAll(/href="(\/municipios\/[^"?#]+\.html)"/g)].map(match => match[1]);
requireCondition(staticMunicipalityLinks.length >= 9, "La portada debe mostrar enlaces municipales estáticos.");

for (const item of catalog) {
  requireCondition(fs.existsSync(path.join(ROOT, item.ruta.replace(/^\//, ""))), `Falta la página ${item.ruta}.`);
}

for (const match of home.matchAll(/href="(\/servicios\/[^"?#]+\.html)"/g)) {
  requireCondition(fs.existsSync(path.join(ROOT, match[1].slice(1))), `Falta el servicio ${match[1]}.`);
}

const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const resolve = query => {
  const term = normalize(query);
  const digits = String(query).replace(/\D/g, "");
  return catalog.filter(item =>
    normalize(item.nombre) === term
    || String(item.nombre).split("/").map(normalize).includes(term)
    || (digits.length === 5 && item.postales.includes(digits))
  );
};

for (const [query, expectedPath] of [
  ["Requena", "/municipios/requena-46213.html"],
  ["Valencia", "/municipios/valencia-46250.html"],
  ["Alicante", "/municipios/alacant-alicante-03014.html"],
  ["46460", "/municipios/silla-46230.html"]
]) {
  const matches = resolve(query);
  requireCondition(matches.length === 1 && matches[0].ruta === expectedPath, `${query} no resuelve a ${expectedPath}.`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("OK: portada estática, 542 municipios y rutas principales validadas.");
