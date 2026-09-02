import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MUNICIPIOS_DIR = path.join(ROOT, "municipios");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const PAGE_SIZE = 100;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function workshopSlug(workshop) {
  return workshop.slug || `${slugify(workshop.nombre)}-${String(workshop.id || "").slice(0, 8)}`;
}

function serviceLabel(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function safePhone(value) {
  const phone = String(value || "").trim();
  return /^[+0-9][0-9 ()-]{5,24}$/.test(phone) ? phone : "";
}

function safeWeb(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") return "";
  const days = [["lunes","Lunes"],["martes","Martes"],["miercoles","Miércoles"],["jueves","Jueves"],["viernes","Viernes"],["sabado","Sábado"],["domingo","Domingo"]];
  const rows = days.map(([key,label]) => {
    const value = schedule[key];
    if (!value) return "";
    const text = value.cerrado ? "Cerrado" : (Array.isArray(value.turnos) ? value.turnos : [])
      .map(slot => `${slot.apertura || ""}–${slot.cierre || ""}`)
      .filter(slot => slot !== "–").join(" y ");
    return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
  }).filter(Boolean).join("");
  return rows ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>` : "";
}

function mapsURL(workshop, rawName) {
  const location = [rawName, workshop.direccion, workshop.codigo_postal, workshop.ciudad, workshop.provincia, "España"]
    .filter(Boolean).map(v => String(v).trim()).filter(Boolean).join(", ");
  return location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : "";
}

function renderWorkshop(workshop, index) {
  const rawName = workshop.nombre || "Taller sin nombre";
  const name = escapeHTML(rawName);
  const slug = workshopSlug(workshop);
  const address = [workshop.direccion, workshop.codigo_postal, workshop.ciudad, workshop.provincia].filter(Boolean).map(escapeHTML).join(", ");
  const phone = safePhone(workshop.telefono);
  const web = safeWeb(workshop.web);
  const map = mapsURL(workshop, rawName);
  const description = escapeHTML(workshop.descripcion || "Consulta servicios, datos de contacto y ubicación del taller.");
  const services = Array.isArray(workshop.servicios) ? workshop.servicios : [];
  const serviceHTML = services.length ? services.map(s => `<span>${escapeHTML(serviceLabel(s))}</span>`).join("") : "<span>Taller mecánico</span>";
  const contacts = [];
  if (phone) contacts.push(`<a href="tel:${escapeHTML(phone)}" aria-label="Llamar a ${name}">Llamar</a>`);
  contacts.push(`<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}" aria-label="Ver servicios de ${name}">Ver servicios</a>`);
  if (map) contacts.push(`<a class="accion-mapa" href="${escapeHTML(map)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${name} en Google Maps">Abrir en Google Maps</a>`);
  if (web) contacts.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
  return `<article class="taller-card" data-taller-index="${index}" data-taller-slug="${escapeHTML(slug)}"><div class="taller-informacion"><h3><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${name}</a></h3><p class="ubicacion">⌖ ${address || "Ubicación no indicada"}</p><p class="taller-descripcion">${description}</p><div class="especialidades">${serviceHTML}</div>${renderSchedule(workshop.horarios)}<div class="taller-pie"><span class="taller-contactos">${contacts.join("") || "Sin contacto publicado"}</span></div></div></article>`;
}

function readMunicipalityData(html, fileName) {
  const match = html.match(/id="lista-talleres"[\s\S]*?data-municipio="([^"]+)"[\s\S]*?data-codigo-municipal="([^"]+)"/i);
  if (!match) throw new Error(`No se pudieron leer nombre/código de ${fileName}`);
  return { name: match[1], code: match[2] };
}

async function rpcMunicipality(code, from = 0) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/buscar_talleres_municipio`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_codigo_municipal: code, p_servicio: "", p_desde: from, p_limite: PAGE_SIZE })
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json();
}

async function fetchAllWorkshops(code) {
  const all = [];
  let from = 0;
  let total = Infinity;
  while (from < total) {
    const rows = await rpcMunicipality(code, from);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    total = Number(rows[0]?.total_resultados) || all.length;
    from += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

async function fetchServiceCatalog() {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/servicios`);
  endpoint.searchParams.set("select", "slug,nombre,categoria,orden");
  endpoint.searchParams.set("activo", "eq.true");
  endpoint.searchParams.set("order", "orden.asc,nombre.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) throw new Error(`Supabase servicios ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("El catálogo de servicios está vacío");
  return rows.filter(row => String(row?.slug || "").trim() && String(row?.nombre || "").trim());
}

function renderServiceOptions(services) {
  const groups = new Map();
  for (const service of services) {
    const category = String(service.categoria || "Otros servicios").trim() || "Otros servicios";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(service);
  }

  const renderedGroups = [...groups.entries()].map(([category, items]) => {
    const options = items.map(service => `                                <option value="${escapeHTML(service.slug)}">${escapeHTML(service.nombre)}</option>`).join("\n");
    return `                            <optgroup label="${escapeHTML(category)}">\n${options}\n                            </optgroup>`;
  }).join("\n");

  return `                                <option value="">Todos los servicios</option>\n${renderedGroups}`;
}

function stripRuntime(html) {
  return html
    .replace(/\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"><\/script>/i, "")
    .replace(/\s*<script\s+src="\.\.\/js\/servicios\.js"><\/script>/i, "")
    .replace(/\s*<script\s+src="\.\.\/js\/municipio\.js"><\/script>/i, "");
}

function ensureMunicipioUI(html) {
  if (html.includes('../js/municipio-ui.js')) return html;
  return html.replace(/<\/body>/i, '    <script src="../js/municipio-ui.js" defer></script>\n</body>');
}

function inject(html, municipality, workshops, serviceCatalog) {
  const workshopHTML = workshops.length
    ? workshops.map(renderWorkshop).join("")
    : `<div class="municipio-sin-talleres"><h3>Todavía no hay talleres publicados en ${escapeHTML(municipality.name)}</h3><p>Un taller de esta población puede solicitar gratuitamente su alta en TallerMap.</p><a class="boton" href="../pages/registro.html">Registrar un taller</a></div>`;

  let out = html.replace(/(<div\s+class="talleres-grid"\s+id="lista-talleres"[\s\S]*?>)[\s\S]*?(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i, `$1${workshopHTML}$2`);
  out = out.replace(/<span class="orden-talleres mapa-estado"[^>]*>[\s\S]*?<\/span>/i, `<span class="orden-talleres mapa-estado" aria-live="polite">${workshops.length} ${workshops.length === 1 ? "taller publicado" : "talleres publicados"}</span>`);
  out = out.replace(/(<select\s+id="servicio"\s+name="servicio"[^>]*>)[\s\S]*?(<\/select>)/i, `$1\n${renderServiceOptions(serviceCatalog)}\n                            $2`);
  out = out.replace(/<meta name="robots" content="[^"]*">/i, '<meta name="robots" content="index,follow,max-image-preview:large">');
  out = stripRuntime(out);
  out = ensureMunicipioUI(out);
  return out;
}

const files = fs.readdirSync(MUNICIPIOS_DIR)
  .filter(name => /^[a-z0-9-]+-\d{5}\.html$/i.test(name))
  .sort();

if (!files.length) throw new Error("No se encontraron páginas municipales");

const serviceCatalog = await fetchServiceCatalog();
console.log(`Servicios activos sincronizados desde Supabase: ${serviceCatalog.length}`);

let generated = 0;
let totalWorkshops = 0;
for (const fileName of files) {
  const filePath = path.join(MUNICIPIOS_DIR, fileName);
  const html = fs.readFileSync(filePath, "utf8");
  const municipality = readMunicipalityData(html, fileName);
  const workshops = await fetchAllWorkshops(municipality.code);
  fs.writeFileSync(filePath, inject(html, municipality, workshops, serviceCatalog), "utf8");
  generated += 1;
  totalWorkshops += workshops.length;
  process.stdout.write(`\rGenerados ${generated}/${files.length} municipios · ${totalWorkshops} talleres`);
}

console.log(`\nOK: ${generated} HTML municipales generados con contenido estático.`);
if (generated !== 542) {
  console.warn(`AVISO: se esperaban 542 municipios y se encontraron ${generated}. No cambies todavía el routing hasta revisar esta diferencia.`);
}
