import fs from "node:fs";
import path from "node:path";
import {
    escapeHTML,
    formatPhoneDisplay,
    renderWorkshopMedia,
    reviewStatusLabel,
    safePhone,
    safeWeb,
    serviceLabel,
    slugify,
    supabaseRpc,
    workshopSlug
} from "../lib/server-utils.js";

const PAGE_SIZE = 30;
const PROVINCIAS = { alicante: "Alicante", castellon: "Castellón", valencia: "Valencia" };

function renderMunicipios(rows) {
    if (!rows.length) return '<li class="mensaje-talleres">No hay municipios con talleres publicados.</li>';
    return rows
        .filter((row) => Number(row.total_talleres) > 0 && row.municipio && row.codigo_municipal)
        .sort((a, b) => String(a.municipio).localeCompare(String(b.municipio), "es", { sensitivity: "base" }))
        .map((row) => {
            const total = Number(row.total_talleres) || 0;
            const archivo = `${slugify(row.municipio)}-${escapeHTML(row.codigo_municipal)}.html`;
            return `<li><a href="../municipios/${archivo}"><strong>${escapeHTML(row.municipio)}</strong><span>${total} ${total === 1 ? "taller" : "talleres"}</span></a></li>`;
        }).join("");
}

function mapsURL(row, rawName) {
    const query = [rawName, row.direccion, row.codigo_postal, row.ciudad, row.provincia, "España"]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(", ");
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function renderTalleres(rows) {
    if (!rows.length) return '<p class="mensaje-talleres">Todavía no hay talleres publicados en esta provincia.</p>';
    return rows.map((row) => {
        const rawName = row.nombre || row.nombre_taller || "Taller sin nombre";
        const nombre = escapeHTML(rawName);
        const ubicacion = [row.direccion, row.codigo_postal, row.ciudad, row.provincia]
            .filter(Boolean).map(escapeHTML).join(", ");
        const slug = workshopSlug(row);
        const phone = safePhone(row.telefono);
        const phoneDisplay = formatPhoneDisplay(row.telefono);
        const web = safeWeb(row.web);
        const map = mapsURL(row, rawName);
        const services = Array.isArray(row.servicios) ? row.servicios.slice(0, 4) : [];
        const serviceHTML = services.length
            ? services.map((service) => `<span>${escapeHTML(serviceLabel(service))}</span>`).join("")
            : "<span>Taller mecánico</span>";
        const contacts = [];
        if (phone) contacts.push(`<a href="tel:${escapeHTML(phone)}" aria-label="Llamar a ${nombre}">${escapeHTML(phoneDisplay || "Llamar")}</a>`);
        if (map) contacts.push(`<a class="accion-mapa" href="${escapeHTML(map)}" target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a ${nombre}">Cómo llegar</a>`);
        if (web) contacts.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);

        return `<article class="taller-card taller-card-inicial" data-taller-slug="${escapeHTML(slug)}">${renderWorkshopMedia(row, rawName)}<div class="taller-informacion"><span class="verificado verificado-en-contenido">${escapeHTML(reviewStatusLabel(Boolean(row.verificado)))}</span><h3>${slug ? `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${nombre}</a>` : nombre}</h3><p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p><div class="especialidades">${serviceHTML}</div><div class="taller-pie"><span class="taller-contactos">${contacts.join("") || "Sin contacto publicado"}</span></div></div></article>`;
    }).join("");
}

function pageURL(slug, page) {
    return `/provincias/${slug}.html${page > 1 ? `?pagina=${page}` : ""}`;
}

function injectPagination(html, slug, page, total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const previous = page <= 1
        ? '<span class="boton boton-claro deshabilitado" aria-disabled="true">← Anterior</span>'
        : `<a class="boton boton-claro" href="${escapeHTML(pageURL(slug, page - 1))}">← Anterior</a>`;
    const next = page >= totalPages
        ? '<span class="boton deshabilitado" aria-disabled="true">Siguiente →</span>'
        : `<a class="boton" href="${escapeHTML(pageURL(slug, page + 1))}">Siguiente →</a>`;
    const pagination = total > PAGE_SIZE ? `
        <div id="contenedor-cargar-mas-provincia" class="cargar-mas-contenedor municipio-paginacion">
            ${previous}
            <span aria-live="polite">Página ${page} de ${totalPages}</span>
            ${next}
        </div>` : '<div id="contenedor-cargar-mas-provincia" class="cargar-mas-contenedor" hidden></div>';

    return html.replace(
        /<div id="contenedor-cargar-mas-provincia" class="cargar-mas-contenedor" hidden>[\s\S]*?<\/div>/i,
        pagination
    );
}

function injectSEO(html, slug, page, total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    let result = html;
    if (total > 0 && page > 1 && page <= totalPages) {
        result = result
            .replace(/<title>([^<]+)<\/title>/i, `<title>Página ${page} · $1</title>`)
            .replace(/<meta name="description" content="([^"]*)">/i, `<meta name="description" content="Página ${page}. $1">`)
            .replace(/<link rel="canonical" href="[^"]+">/i, `<link rel="canonical" href="https://www.tallermap.es${pageURL(slug, page)}">`);
    }
    const links = [];
    if (page > 1 && page <= totalPages) links.push(`<link rel="prev" href="https://www.tallermap.es${pageURL(slug, page - 1)}">`);
    if (page < totalPages) links.push(`<link rel="next" href="https://www.tallermap.es${pageURL(slug, page + 1)}">`);
    if (links.length) result = result.replace("</head>", `${links.join("\n")}\n</head>`);
    return result;
}

function stripProvinceRuntime(html) {
    return html
        .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, "")
        .replace(/\s*<script src="\.\.\/js\/provincia\.js"><\/script>/i, "");
}

function noindexOnFailure(html) {
    return html.replace(/<meta name="robots" content="[^"]*">/i, '<meta name="robots" content="noindex,follow,max-image-preview:large">');
}

function inject(html, municipiosHTML, talleresHTML, total) {
    html = html.replace(/(<ul id="lista-municipios-provincia"[^>]*>)[\s\S]*?(<\/ul>)/i, `$1${municipiosHTML}$2`);
    html = html.replace(/(<div id="lista-talleres-provincia"[^>]*>)[\s\S]*?(<\/div>\s*<div id="contenedor-cargar-mas-provincia")/i, `$1${talleresHTML}$2`);
    html = html.replace(/(<span id="estado-provincia"[^>]*>)[\s\S]*?(<\/span>)/i, `$1${total} ${total === 1 ? "taller" : "talleres"}$2`);
    return html;
}

export default async function handler(request, response) {
    const slug = String(request.query?.provincia || "").toLowerCase().replace(/\.html$/, "");
    const provincia = PROVINCIAS[slug];
    if (!provincia) { response.status(404).send("Provincia no encontrada"); return; }

    let html;
    try { html = fs.readFileSync(path.join(process.cwd(), "provincias", `${slug}.html`), "utf8"); }
    catch (error) { console.error(error); response.status(500).send("No se pudo renderizar la provincia"); return; }

    try {
        const pagina = Math.max(1, Number.parseInt(String(request.query?.pagina || "1"), 10) || 1);
        const desde = (pagina - 1) * PAGE_SIZE;
        const [municipios, talleres] = await Promise.all([
            supabaseRpc("listar_municipios_publicos", { p_provincia: provincia }),
            supabaseRpc("buscar_talleres_provincia", { p_provincia: provincia, p_desde: desde, p_limite: PAGE_SIZE })
        ]);
        const total = Number(talleres[0]?.total_resultados) || talleres.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        html = inject(html, renderMunicipios(municipios), renderTalleres(talleres), total);
        html = injectPagination(html, slug, pagina, total);
        html = injectSEO(html, slug, pagina, total);
        html = stripProvinceRuntime(html);

        response.setHeader("X-TallerMap-Province-SSR", "1");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        if (total > 0 && pagina > totalPages) {
            response.status(404).send(html);
            return;
        }
        response.status(200).send(html);
    } catch (error) {
        console.error("SSR provincia falló:", error);
        html = stripProvinceRuntime(noindexOnFailure(html));
        response.setHeader("X-TallerMap-Province-SSR", "0");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Retry-After", "60");
        response.status(503).send(html);
    }
}
