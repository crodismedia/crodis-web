import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "datos", "municipios.csv");
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "municipios-nombres-castellanos.json"), "utf8"));
const replacementsProvince = [
  ["Alicante/Alacant", "Alicante"],
  ["Alicante / Alacant", "Alicante"],
  ["Castellón/Castelló", "Castellon"],
  ["Castellón / Castelló", "Castellon"],
  ["Valencia/València", "Valencia"],
  ["Valencia / València", "Valencia"],
  ["Castellón", "Castellon"]
];

function entities(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("'", "&#39;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function variants(s) {
  return [...new Set([s, s.replaceAll("'", "&#x27;"), s.replaceAll("'", "&#39;"), s.replaceAll("'", "&apos;")])];
}
function canonicalize(s, original, name) {
  let out = s;
  for (const [a,b] of replacementsProvince) out = out.replaceAll(a,b);
  for (const a of variants(original)) out = out.replaceAll(a, entities(a) === a ? name : entities(name));
  // The Valencia page previously used "Valencia y València" in editorial text.
  out = out.replaceAll(name + " y " + name, name).replaceAll(name + "/" + name, name);
  return out;
}
function titleFor(name) {
  const first = "Talleres mecánicos en " + name + " | TallerMap";
  if (first.length <= 65) return first;
  const next = "Talleres en " + name + " | TallerMap";
  return next.length <= 65 ? next : name + " | TallerMap";
}
function fixMunicipality(html, original, newName, fileName) {
  const originalCanonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!originalCanonical) throw Error("Falta canonical en " + fileName);
  const originalCards = (html.match(/<article\b[^>]*class="[^"]*\btaller-card\b/g) || []).length;
  const stored = [];
  // Workshop names/descriptions remain verbatim. Only geographic labels are changed.
  let out = html.replace(/<article\b[^>]*class="[^"]*\btaller-card\b[^"]*>[\s\S]*?<\/article>/gi, block => {
    const updated = block.replace(/(<p class="ubicacion">)([\s\S]*?)(<\/p>)/gi, (all,a,location,b) =>
      a + canonicalize(location, original, newName) + b);
    stored.push(updated);
    return "PLACEHOLDER_TALLERMAP_CARD_" + (stored.length - 1) + "_END";
  });
  out = canonicalize(out, original, newName);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + entities(titleFor(newName)) + "</title>");
  out = out.replace(/PLACEHOLDER_TALLERMAP_CARD_(\d+)_END/g, (_m,i) => stored[Number(i)]);
  const newCanonical = out.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  const newCards = (out.match(/<article\b[^>]*class="[^"]*\btaller-card\b/g) || []).length;
  if (originalCanonical !== newCanonical || newCards !== originalCards) {
    throw Error("Cambio inesperado en enlaces o tarjetas de " + fileName);
  }
  if (!out.includes("data-codigo-municipal=")) throw Error("Sin codigo municipal: " + fileName);
  return out;
}
const rows = fs.readFileSync(CSV,"utf8").replace(/^\uFEFF/,"").trim().split(/\r?\n/).slice(1);
if (rows.length !== 542) throw Error("Se esperaban 542 municipios; encontrados " + rows.length);
let changed=0;
for (const row of rows) {
  const [original,code,relative] = row.split(";");
  const name = NAMES[code];
  if (!name || !relative || !/^\d{5}$/.test(code) || name.includes("/")) throw Error("Nombre municipal no valido: " + row);
  const target = path.join(ROOT,relative);
  const html = fs.readFileSync(target,"utf8");
  const revised = fixMunicipality(html,original,name,relative);
  if (revised !== html) {
    fs.writeFileSync(target,revised,"utf8");
    changed++;
  }
}
const homepage = path.join(ROOT,"index.html");
let home = fs.readFileSync(homepage,"utf8");
const firstHome = home;
home = home.replace(/(<a class="selector-provincia" href="\/municipios\/[^"]+-(\d{5})\.html">\s*<strong>)[\s\S]*?(<\/strong>)/g,(all,a,code,b) => {
  if (!NAMES[code]) throw Error("No se encontro el nombre de " + code + " en la portada");
  return a + entities(NAMES[code]) + b;
});
if (home !== firstHome) fs.writeFileSync(homepage,home,"utf8");
const indexFile = path.join(ROOT,"municipios","index.html");
let index = fs.readFileSync(indexFile,"utf8");
let fixed = index.replaceAll("Castellón","Castellon");
if (fixed !== index) fs.writeFileSync(indexFile,fixed,"utf8");
console.log("MUNICIPIOS_VERIFICADOS="+rows.length);
console.log("MUNICIPIOS_CORREGIDOS="+changed);
console.log("PORTADA_ACTUALIZADA="+(home !== firstHome));
