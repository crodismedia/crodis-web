import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "municipios");

function provinceFromCode(code) {
  const p = String(code || "").slice(0, 2);
  if (p === "03") return "Alicante";
  if (p === "12") return "Castellón";
  if (p === "46") return "Valencia";
  return "Comunidad Valenciana";
}

function escAttr(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

const files = fs.readdirSync(DIR).filter(n => /^[a-z0-9-]+-\d{5}\.html$/i.test(n)).sort();
let changed = 0, skippedNoindex = 0, skippedSpecific = 0;

for (const file of files) {
  const full = path.join(DIR, file);
  let html = fs.readFileSync(full, "utf8");
  const robots = (html.match(/<meta name="robots" content="([^"]+)"/i) || [])[1] || "";
  if (/\bnoindex\b/i.test(robots)) { skippedNoindex++; continue; }

  const titleName = (html.match(/<title>\s*Talleres mecánicos en ([\s\S]*?) \| TallerMap<\/title>/i) || [])[1]?.trim();
  const code = (file.match(/-(\d{5})\.html$/) || [])[1];
  const old = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "";
  if (!titleName || !code) continue;

  // Conservar metas ya trabajadas a mano; cambiar solo el patrón antiguo/genérico.
  if (!/Código municipal|publicados en/i.test(old)) { skippedSpecific++; continue; }

  const desc = `Encuentra talleres mecánicos en ${titleName}, ${provinceFromCode(code)}. Consulta servicios, teléfonos, horarios, ubicación y fichas de talleres en TallerMap.`;
  html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escAttr(desc)}">`);
  html = html.replace(/("description"\s*:\s*)"[^"]*"/i, (_m, p1) => p1 + JSON.stringify(desc));
  fs.writeFileSync(full, html, "utf8");
  changed++;
}

console.log(JSON.stringify({total: files.length, changed, skippedNoindex, skippedSpecific}, null, 2));
