import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MUNICIPIOS_DIR = path.join(ROOT, "municipios");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const PAGE_SIZE = 100;
const SITE_URL = "https://www.tallermap.es";
const EXPECTED_MUNICIPALITIES = 542;
// Politica solicitada: permitir indexar tambien municipios sin talleres.
// Cambiar a false si se quieren excluir las paginas vacias de la indexacion.
const INDEX_EMPTY_MUNICIPALITIES = true;
const DRY_RUN = process.argv.includes("--dry-run");

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
  const days = [["lunes","Lunes"],["martes","Martes"],["miercoles","Mi\u00e9rcoles"],["jueves","Jueves"],["viernes","Viernes"],["sabado","S\u00e1bado"],["domingo","Domingo"]];
  const rows = days.map(([key,label]) => {
    const value = schedule[key];
    if (!value) return "";
    const text = value.cerrado ? "Cerrado" : (Array.isArray(value.turnos) ? value.turnos : [])
      .map(slot => `${slot.apertura || ""}\u2013${slot.cierre || ""}`)
      .filter(slot => slot !== "\u2013").join(" y ");
    return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
  }).filter(Boolean).join("");
  return rows ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>` : "";
}

function mapsURL(workshop, rawName) {
  const location = [rawName, workshop.direccion, workshop.codigo_postal, workshop.ciudad, workshop.provincia, "Espa\u00f1a"]
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
  const description = escapeHTML(workshop.descripcion || "Consulta servicios, datos de contacto y ubicaci\u00f3n del taller.");
  const services = Array.isArray(workshop.servicios) ? workshop.servicios : [];
  const serviceHTML = services.length ? services.map(s => `<span>${escapeHTML(serviceLabel(s))}</span>`).join("") : "<span>Taller mec\u00e1nico</span>";
  const contacts = [];
  if (phone) contacts.push(`<a href="tel:${escapeHTML(phone)}" aria-label="Llamar a ${name}">Llamar</a>`);
  contacts.push(`<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}" aria-label="Ver servicios de ${name}">Ver servicios</a>`);
  if (map) contacts.push(`<a class="accion-mapa" href="${escapeHTML(map)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${name} en Google Maps">Abrir en Google Maps</a>`);
  if (web) contacts.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
  return `<article class="taller-card" data-taller-index="${index}" data-taller-slug="${escapeHTML(slug)}"><div class="taller-informacion"><h3><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${name}</a></h3><p class="ubicacion">\u2316 ${address || "Ubicaci\u00f3n no indicada"}</p><p class="taller-descripcion">${description}</p><div class="especialidades">${serviceHTML}</div>${renderSchedule(workshop.horarios)}<div class="taller-pie"><span class="taller-contactos">${contacts.join("") || "Sin contacto publicado"}</span></div></div></article>`;
}

// Lee atributos HTML sin depender de su orden ni del tipo de comillas.
function getAttribute(tag, name) {
  const attributes = tag.matchAll(/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g);
  for (const match of attributes) {
    if (match[1].toLowerCase() === name.toLowerCase()) {
      return match[2] ?? match[3] ?? match[4] ?? "";
    }
  }
  return null;
}

function decodeHTML(value) {
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, key) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    if (key[0] !== "#") return named[key.toLowerCase()] ?? entity;
    const hex = key[1].toLowerCase() === "x";
    const code = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function readMunicipalityData(html, fileName) {
  const tag = [...html.matchAll(/<div\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)]
    .map(match => match[0])
    .find(tag => getAttribute(tag, "id") === "lista-talleres");
  const name = tag && getAttribute(tag, "data-municipio");
  const code = tag && getAttribute(tag, "data-codigo-municipal");
  if (!name || !/^\d{5}$/.test(code || "") || !fileName.endsWith(`-${code}.html`)) {
    throw new Error(`Nombre o c\u00f3digo municipal inv\u00e1lido en ${fileName}`);
  }
  return { name: decodeHTML(name).trim(), code, fileName };
}

function provinceFromCode(code) {
  const prefix = String(code || "").slice(0, 2);
  if (prefix === "03") return "Alicante";
  if (prefix === "12") return "Castell\u00f3n";
  if (prefix === "46") return "Valencia";
  return "Comunidad Valenciana";
}

function municipalityTitle(name) {
  const full = `Talleres mec\u00e1nicos en ${name} | TallerMap`;
  if (full.length <= 65) return full;
  const compact = `Talleres en ${name} | TallerMap`;
  if (compact.length <= 65) return compact;
  const brandOnly = `${name} | TallerMap`;
  if (brandOnly.length <= 65) return brandOnly;
  const suffix = ' | TallerMap';
  const max = 65 - suffix.length - 1;
  let short = String(name).slice(0, max).trim();
  const cut = short.lastIndexOf(' ');
  if (cut >= Math.floor(max * 0.65)) short = short.slice(0, cut).trim();
  return `${short}\u2026${suffix}`;
}

function seoDescription(municipality, count) {
  const { name, code } = municipality;
  const province = provinceFromCode(code);
  if (!count) {
    const empty = `Directorio de talleres mec\u00e1nicos en ${name}, ${province}. Todav\u00eda no hay talleres publicados. Consulta c\u00f3mo registrar un taller en TallerMap.`;
    if (empty.length <= 155) return empty;
    return `Talleres en ${name}. Todav\u00eda no hay talleres publicados. Registra tu taller en TallerMap.`;
  }
  const quantity = count === 1 ? "1 taller publicado" : `${count} talleres publicados`;
  const full = `Encuentra talleres mec\u00e1nicos en ${name}, ${province}: ${quantity}. Consulta servicios, tel\u00e9fonos, horarios y ubicaci\u00f3n.`;
  if (full.length <= 155) return full;
  return `Talleres mec\u00e1nicos en ${name}: ${quantity}. Consulta servicios y datos de contacto en TallerMap.`;
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
  let expected = null;
  const seenPages = new Set();
  while (true) {
    const rows = await rpcMunicipality(code, from);
    if (!Array.isArray(rows)) throw new Error(`Respuesta inv\u00e1lida en municipio ${code}`);
    if (rows.length === 0) {
      if (expected !== null && from < expected) {
        throw new Error(`Paginaci\u00f3n incompleta en ${code}: ${from}/${expected}`);
      }
      break;
    }
    const signature = JSON.stringify(rows.map(row => [row.id, row.slug, row.nombre]));
    if (seenPages.has(signature)) throw new Error(`P\u00e1gina de resultados repetida en ${code}`);
    seenPages.add(signature);
    const rawTotal = rows[0]?.total_resultados;
    if (rawTotal != null && rawTotal !== "") {
      const total = Number(rawTotal);
      if (!Number.isSafeInteger(total) || total < from + rows.length) {
        throw new Error(`Total de resultados incoherente en ${code}`);
      }
      if (expected !== null && expected !== total) {
        throw new Error(`Los datos de ${code} cambiaron durante la generaci\u00f3n. Reintenta.`);
      }
      expected = total;
    }
    all.push(...rows);
    from += rows.length;
    if (expected !== null && from >= expected) break;
    if (expected === null && rows.length < PAGE_SIZE) break;
  }
  return all;
}

// Conserva los slugs publicados. No fusiona talleres diferentes por nombre.
function uniqueWorkshops(workshops, code, globalSlugs, globalIds) {
  const seen = new Set();
  const result = [];
  for (const workshop of workshops) {
    const slug = workshopSlug(workshop);
    if (!slug || (!workshop.slug && !workshop.id)) {
      throw new Error(`Taller sin identificador o slug v\u00e1lido en ${code}`);
    }
    const id = workshop.id == null ? null : String(workshop.id);
    if (id !== null) {
      const existing = globalIds.get(id);
      if (existing && existing.slug !== slug) {
        throw new Error(`El taller ${id} tiene dos slugs: ${existing.slug} y ${slug}`);
      }
      if (existing && existing.code !== code) {
        console.warn(`\nAVISO: taller ${id} aparece en municipios ${existing.code} y ${code}`);
      }
      globalIds.set(id, { slug, code });
    }
    const previous = globalSlugs.get(slug);
    if (previous && previous.id !== id) {
      throw new Error(`Slug compartido por talleres diferentes: ${slug}`);
    }
    globalSlugs.set(slug, { id, code });
    if (seen.has(slug)) {
      console.warn(`\nAVISO: ficha repetida en ${code}: ${slug}. Se mostrar\u00e1 una sola vez.`);
      continue;
    }
    seen.add(slug);
    result.push(workshop);
  }
  return result;
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
  if (!Array.isArray(rows) || !rows.length) throw new Error("El cat\u00e1logo de servicios est\u00e1 vac\u00edo");
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

function ensurePublicAssets(html) {
  let out = html;
  if (!out.includes('cookie-consent.css')) {
    out = out.replace(/<\/head>/i, '    <link rel="stylesheet" href="../css/cookie-consent.css?v=20260809-5">\n</head>');
  }
  if (!out.includes('cookie-consent.js')) {
    out = out.replace(/<\/body>/i, '    <script src="../js/cookie-consent.js?v=20260903-1" defer></script>\n</body>');
  }
  if (!out.includes('../js/municipio-ui.js')) {
    out = out.replace(/<\/body>/i, '    <script src="../js/municipio-ui.js" defer></script>\n</body>');
  }
  return out;
}

// Actualiza una etiqueta unica del <head>, o la crea si falta.
function upsertHeadTag(head, pattern, matchesTag, replacement) {
  let inserted = false;
  const updated = head.replace(pattern, tag => {
    if (!matchesTag(tag)) return tag;
    if (inserted) return "";
    inserted = true;
    return replacement;
  });
  return inserted ? updated : `${updated.trimEnd()}\n    ${replacement}\n`;
}

function updatePageStructuredData(head, description) {
  return head.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, block => {
    const opening = block.match(/^<script\b[^>]*>/i)?.[0];
    if (getAttribute(opening || "", "type")?.toLowerCase() !== "application/ld+json") return block;
    try {
      const data = JSON.parse(block.slice(opening.length, block.lastIndexOf("</")));
      let changed = false;
      function visit(node) {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== "object") return;
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (types.some(type => ["WebPage", "CollectionPage", "SearchResultsPage"].includes(type))) {
          node.description = description;
          changed = true;
        }
        if (node["@graph"]) visit(node["@graph"]);
      }
      visit(data);
      return changed ? `${opening}\n${JSON.stringify(data, null, 2).replaceAll("<", "\\u003c")}\n</script>` : block;
    } catch {
      return block;
    }
  });
}

function updateSEO(html, municipality, workshopCount) {
  const title = municipalityTitle(municipality.name);
  const description = seoDescription(municipality, workshopCount);
  const canonical = `${SITE_URL}/municipios/${municipality.fileName}`;
  const robots = workshopCount || INDEX_EMPTY_MUNICIPALITIES
    ? "index,follow,max-image-preview:large" : "noindex,follow";
  const headPattern = /(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i;
  if (!headPattern.test(html)) throw new Error(`Falta <head> en ${municipality.fileName}`);
  return html.replace(headPattern, (_, opening, head, closing) => {
    const metaPattern = /<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
    const linkPattern = /<link\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
    const meta = (name, content) => `<meta name="${name}" content="${escapeHTML(content)}">`;
    head = upsertHeadTag(head, /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, () => true, `<title>${escapeHTML(title)}</title>`);
    head = upsertHeadTag(head, metaPattern, tag => getAttribute(tag, "name")?.toLowerCase() === "description", meta("description", description));
    head = upsertHeadTag(head, metaPattern, tag => getAttribute(tag, "name")?.toLowerCase() === "robots", meta("robots", robots));
    // Evita directivas contradictorias especificas de Google o Bing, si existen.
    for (const bot of ["googlebot", "bingbot"]) {
      const hasBot = [...head.matchAll(metaPattern)].some(match => getAttribute(match[0], "name")?.toLowerCase() === bot);
      if (hasBot) head = upsertHeadTag(head, metaPattern, tag => getAttribute(tag, "name")?.toLowerCase() === bot, meta(bot, robots));
    }
    head = upsertHeadTag(head, linkPattern, tag => (getAttribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"), `<link rel="canonical" href="${escapeHTML(canonical)}">`);
    // Sincroniza Open Graph si ya estaba presente, sin anadir etiquetas innecesarias.
    for (const [property, content] of [["og:title", title], ["og:description", description], ["og:url", canonical]]) {
      if ([...head.matchAll(metaPattern)].some(match => getAttribute(match[0], "property")?.toLowerCase() === property)) {
        head = upsertHeadTag(head, metaPattern, tag => getAttribute(tag, "property")?.toLowerCase() === property, `<meta property="${property}" content="${escapeHTML(content)}">`);
      }
    }
    head = updatePageStructuredData(head, description);
    return opening + head + closing;
  });
}

function replaceRequired(html, pattern, replacement, label, fileName) {
  if (!pattern.test(html)) throw new Error(`No se encontr\u00f3 ${label} en ${fileName}`);
  return html.replace(pattern, replacement);
}

function inject(html, municipality, workshops, serviceCatalog) {
  const workshopHTML = workshops.length
    ? workshops.map(renderWorkshop).join("")
    : `<div class="municipio-sin-talleres"><h3>Todav\u00eda no hay talleres publicados en ${escapeHTML(municipality.name)}</h3><p>Un taller de esta poblaci\u00f3n puede solicitar gratuitamente su alta en TallerMap.</p><a class="boton" href="../pages/registro.html">Registrar un taller</a></div>`;

  const file = municipality.fileName;
  const divTag = /<div\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  const divs = [...html.matchAll(divTag)];
  const start = divs.find(match => getAttribute(match[0], "id") === "lista-talleres");
  const end = divs.find(match => match.index > (start?.index ?? Infinity) && getAttribute(match[0], "id") === "contenedor-cargar-mas");
  if (!start || !end) throw new Error(`No se encontr\u00f3 el bloque de talleres en ${file}`);
  const contentStart = start.index + start[0].length;
  const originalContent = html.slice(contentStart, end.index);
  const closing = originalContent.match(/<\/div\s*>\s*$/i);
  if (!closing) throw new Error(`Cierre del bloque de talleres inv\u00e1lido en ${file}`);
  let out = html.slice(0, contentStart) + workshopHTML + originalContent.slice(closing.index) + html.slice(end.index);
  out = replaceRequired(out, /<span\b(?=[^>]*\bclass=["'][^"']*\bmapa-estado\b[^"']*["'])[^>]*>[\s\S]*?<\/span>/i,
    () => `<span class="orden-talleres mapa-estado" aria-live="polite">${workshops.length} ${workshops.length === 1 ? "taller publicado" : "talleres publicados"}</span>`, "contador de talleres", file);
  out = replaceRequired(out, /(<select\b(?=[^>]*\bid=["']servicio["'])[^>]*>)[\s\S]*?(<\/select>)/i,
    (_, open, close) => `${open}\n${renderServiceOptions(serviceCatalog)}\n                            ${close}`, "selector de servicios", file);
  out = updateSEO(out, municipality, workshops.length);
  out = stripRuntime(out);
  out = ensurePublicAssets(out);
  return out;
}

async function main() {
  const files = fs.readdirSync(MUNICIPIOS_DIR)
    .filter(name => /^[a-z0-9-]+-\d{5}\.html$/i.test(name))
    .sort();
  if (!files.length) throw new Error("No se encontraron p\u00e1ginas municipales");
  if (files.length !== EXPECTED_MUNICIPALITIES) {
    throw new Error(`Se esperaban ${EXPECTED_MUNICIPALITIES} municipios y se encontraron ${files.length}. Revisa la carpeta antes de generar.`);
  }
  const catalog = await fetchServiceCatalog();
  if (!catalog.length) throw new Error("No hay servicios v\u00e1lidos en el cat\u00e1logo");
  console.log(`Servicios activos sincronizados desde Supabase: ${catalog.length}`);
  const pending = [];
  const globalSlugs = new Map();
  const globalIds = new Map();
  const codes = new Set();
  let totalWorkshops = 0;
  let emptyMunicipalities = 0;
  // Primero valida y genera todo en memoria. Si falla Supabase o una plantilla,
  // no se sobrescribe ningun HTML municipal.
  for (const fileName of files) {
    const filePath = path.join(MUNICIPIOS_DIR, fileName);
    const html = fs.readFileSync(filePath, "utf8");
    const municipality = readMunicipalityData(html, fileName);
    if (codes.has(municipality.code)) throw new Error(`C\u00f3digo municipal duplicado: ${municipality.code}`);
    codes.add(municipality.code);
    const workshops = uniqueWorkshops(await fetchAllWorkshops(municipality.code), municipality.code, globalSlugs, globalIds);
    pending.push({ filePath, html: inject(html, municipality, workshops, catalog) });
    totalWorkshops += workshops.length;
    if (!workshops.length) emptyMunicipalities++;
    process.stdout.write(`\rPreparados ${pending.length}/${files.length} municipios \u00b7 ${totalWorkshops} talleres`);
  }
  if (!totalWorkshops) throw new Error("Supabase no devolvi\u00f3 ning\u00fan taller. Se cancela la generaci\u00f3n para proteger el directorio.");
  console.log(`\nMunicipios sin talleres: ${emptyMunicipalities}`);
  if (DRY_RUN) {
    console.log("OK: simulaci\u00f3n completada. No se ha modificado ning\u00fan HTML.");
    return;
  }
  for (const { filePath, html } of pending) {
    fs.writeFileSync(filePath, html, "utf8");
  }
  console.log(`OK: ${pending.length} HTML municipales generados con contenido est\u00e1tico.`);
}

main().catch(error => {
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
