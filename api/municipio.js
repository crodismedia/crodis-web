import fs from "node:fs";
import path from "node:path";
import { escapeHTML, renderWorkshopMedia, reviewStatusLabel, safePhone, safeWeb, serviceLabel, supabaseRpc, workshopSlug } from "../lib/server-utils.js";

const PAGE_SIZE = 30;

function safeFileName(value) {
    const name = String(value || "").trim();
    if (!/^[a-z0-9-]+\.html$/i.test(name)) return "";
    return name;
}

function safeService(value) {
    return String(value || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
}

function requestedPage(value) {
    const page = Number(value);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function readMunicipalityData(html) {
    const match = html.match(/id="lista-talleres"[\s\S]*?data-municipio="([^"]+)"[\s\S]*?data-codigo-municipal="([^"]+)"/i);
    if (!match) throw new Error("No se encontraron los datos del municipio en la plantilla");
    return { name: match[1], code: match[2] };
}

function renderSchedule(schedule) {
    if (!schedule || typeof schedule !== "object") return "";
    const days = [["lunes","Lunes"],["martes","Martes"],["miercoles","Miércoles"],["jueves","Jueves"],["viernes","Viernes"],["sabado","Sábado"],["domingo","Domingo"]];
    const rows = days.map(([key, label]) => {
        const value = schedule[key];
        if (!value) return "";
        const text = value.cerrado ? "Cerrado" : (Array.isArray(value.turnos) ? value.turnos : [])
            .map((slot) => `${slot.apertura || ""}–${slot.cierre || ""}`)
            .filter((slot) => slot !== "–").join(" y ");
        return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
    }).filter(Boolean).join("");
    return rows ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>` : "";
}

function renderWorkshop(workshop, index) {
    const rawName = workshop.nombre || workshop.nombre_taller || "Taller sin nombre";
    const name = escapeHTML(rawName);
    const slug = workshopSlug(workshop);
    const address = [workshop.direccion, workshop.codigo_postal, workshop.ciudad, workshop.provincia]
        .filter(Boolean).map(escapeHTML).join(", ");
    const phone = safePhone(workshop.telefono);
    const web = safeWeb(workshop.web);
    const description = escapeHTML(workshop.descripcion || "Consulta la ficha del taller para conocer sus servicios y datos de contacto.");
    const services = Array.isArray(workshop.servicios) ? workshop.servicios.slice(0, 4) : [];
    const serviceHTML = services.length
        ? services.map((service) => `<span>${escapeHTML(serviceLabel(service))}</span>`).join("")
        : "<span>Taller mecánico</span>";
    const contacts = [];
    if (phone) contacts.push(`<a href="tel:${escapeHTML(phone)}" aria-label="Llamar a ${name}">Llamar</a>`);
    if (web) contacts.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
    if (slug) contacts.push(`<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a>`);

    return `<article class="taller-card" data-taller-index="${index}" data-taller-slug="${escapeHTML(slug)}">${renderWorkshopMedia(workshop, rawName)}<div class="taller-informacion"><span class="verificado verificado-en-contenido">${escapeHTML(reviewStatusLabel(Boolean(workshop.verificado)))}</span><h3>${slug ? `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${name}</a>` : name}</h3><p class="ubicacion">⌖ ${address || "Ubicación no indicada"}</p><p class="taller-descripcion">${description}</p><div class="especialidades">${serviceHTML}</div>${renderSchedule(workshop.horarios)}<div class="taller-pie"><span class="taller-contactos">${contacts.join("") || "Sin contacto publicado"}</span></div></div></article>`;
}

function pageURL(fileName, page, service) {
    const params = new URLSearchParams();
    if (page > 1) params.set("pagina", String(page));
    if (service) params.set("servicio", service);
    const query = params.toString();
    return `/municipios/${fileName}${query ? `?${query}` : ""}`;
}

function selectService(html, service) {
    if (!service) return html;
    const pattern = new RegExp(`(<option\\s+value="${service.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}")([^>]*>)`, "i");
    return html.replace(pattern, "$1 selected$2");
}

function stripMunicipalityRuntime(html) {
    const result = html
        .replace(/\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, "")
        .replace(/\s*<script\s+src="\.\.\/js\/servicios\.js"><\/script>/i, "")
        .replace(/\s*<script\s+src="\.\.\/js\/municipio\.js"><\/script>/i, "");
    return /imagenes-automaticas\.js/i.test(result)
        ? result
        : result.replace("</body>", '<script defer src="../js/imagenes-automaticas.js?v=20260810-2"></script>\n</body>');
}

function injectPagination(html, fileName, page, total, service) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const previousDisabled = page <= 1;
    const nextDisabled = page >= totalPages;
    const previous = previousDisabled
        ? '<span id="boton-pagina-anterior" class="boton boton-claro deshabilitado" aria-disabled="true">← Anterior</span>'
        : `<a id="boton-pagina-anterior" class="boton boton-claro" href="${escapeHTML(pageURL(fileName, page - 1, service))}">← Anterior</a>`;
    const next = nextDisabled
        ? '<span id="boton-pagina-siguiente" class="boton deshabilitado" aria-disabled="true">Siguiente →</span>'
        : `<a id="boton-pagina-siguiente" class="boton" href="${escapeHTML(pageURL(fileName, page + 1, service))}">Siguiente →</a>`;
    const pagination = total > PAGE_SIZE ? `<div id="contenedor-cargar-mas" class="cargar-mas-contenedor municipio-paginacion">${previous}<span id="estado-paginacion" aria-live="polite">Página ${page} de ${totalPages}</span>${next}</div>` : `<div id="contenedor-cargar-mas" class="cargar-mas-contenedor" hidden></div>`;
    return html.replace(/<div id="contenedor-cargar-mas" class="cargar-mas-contenedor" hidden>[\s\S]*?<\/div>/i, pagination);
}

function injectHeadSEO(html, fileName, page, total, service) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const validPage = total > 0 && page <= totalPages;
    const indexable = validPage && !service;
    let result = html;
    if (!indexable) result = result.replace(/<meta name="robots" content="[^"]*">/i, '<meta name="robots" content="noindex,follow,max-image-preview:large">');
    if (indexable && page > 1) {
        result = result.replace(/<title>([^<]+)<\/title>/i, `<title>Página ${page} · $1</title>`)
            .replace(/<meta name="description" content="([^"]*)">/i, `<meta name="description" content="Página ${page}. $1">`)
            .replace(/<link rel="canonical" href="[^"]+">/i, `<link rel="canonical" href="https://www.tallermap.es${pageURL(fileName, page, "")}">`);
    }
    const links = [];
    if (indexable && page > 1) links.push(`<link rel="prev" href="https://www.tallermap.es${pageURL(fileName, page - 1, "")}">`);
    if (indexable && page < totalPages) links.push(`<link rel="next" href="https://www.tallermap.es${pageURL(fileName, page + 1, "")}">`);
    if (links.length) result = result.replace("</head>", `${links.join("\n")}\n</head>`);
    return result;
}

export default async function handler(request, response) {
    const fileName = safeFileName(request.query?.archivo);
    const page = requestedPage(request.query?.pagina);
    const service = safeService(request.query?.servicio);
    if (!fileName) { response.status(404).send("Municipio no encontrado."); return; }

    const filePath = path.join(process.cwd(), "municipios", fileName);
    let html;
    try { html = fs.readFileSync(filePath, "utf8"); }
    catch (_error) { response.status(404).send("Municipio no encontrado."); return; }

    let municipality;
    try { municipality = readMunicipalityData(html); }
    catch (error) { console.error("No se pudo leer la plantilla municipal:", error); response.status(500).send("No se pudo renderizar el municipio."); return; }

    try {
        const from = (page - 1) * PAGE_SIZE;
        const workshops = await supabaseRpc("buscar_talleres_municipio", { p_codigo_municipal: municipality.code, p_servicio: service, p_desde: from, p_limite: PAGE_SIZE });
        const total = workshops.length ? Number(workshops[0]?.total_resultados) || workshops.length : 0;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (page > totalPages && total > 0) {
            html = injectHeadSEO(html, fileName, page, total, service);
            html = html.replace(/(<div\s+class="talleres-grid"\s+id="lista-talleres"[\s\S]*?>)[\s\S]*?(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i, `$1<p class="mensaje-talleres">Esta página de resultados no existe.</p>$2`);
            html = stripMunicipalityRuntime(html);
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
            response.status(404).send(html); return;
        }

        const workshopHTML = workshops.length ? workshops.map(renderWorkshop).join("") : `<div class="municipio-sin-talleres"><h3>Todavía no hay talleres publicados en ${escapeHTML(municipality.name)}</h3><p>Un taller de esta población puede solicitar gratuitamente su alta en TallerMap.</p><a class="boton" href="../pages/registro.html">Registrar un taller</a></div>`;
        html = html.replace(/(<div\s+class="talleres-grid"\s+id="lista-talleres"[\s\S]*?>)[\s\S]*?(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i, `$1${workshopHTML}$2`);
        html = html.replace(/<span class="orden-talleres mapa-estado"[^>]*>[\s\S]*?<\/span>/i, `<span class="orden-talleres mapa-estado" aria-live="polite">${total} ${total === 1 ? "taller publicado" : "talleres publicados"}</span>`);
        html = injectPagination(html, fileName, page, total, service);
        html = injectHeadSEO(html, fileName, page, total, service);
        html = selectService(html, service);
        html = stripMunicipalityRuntime(html);

        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", service ? "no-store" : "public, s-maxage=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Municipio", municipality.code);
        response.setHeader("X-TallerMap-Municipio-Talleres", String(total));
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar el municipio desde Supabase:", error);
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.status(200).send(html);
    }
}
