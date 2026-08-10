import fs from "node:fs";
import path from "node:path";
import {
    escapeHTML,
    renderWorkshopMedia,
    slugify,
    workshopSlug,
    supabaseRpc
} from "../lib/server-utils.js";

const INITIAL_WORKSHOPS = 24;
const SEARCH_PAGE_SIZE = 20;
const COOKIE_SCRIPT_VERSION = "20260809-4";
const FRONTEND_VERSION = "20260810-2";
const MAX_TERM = 80;

function safeTerm(value) {
    return String(value || "")
        .replace(/[,%().]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TERM);
}

function requestedPage(value) {
    const page = Number(value);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function titleFromSlug(slug) {
    return String(slug || "")
        .replace(/-[0-9a-f]{8}$/i, "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchInitialWorkshops() {
    return supabaseRpc("buscar_talleres_profesional", {
        p_ubicacion: "",
        p_servicio: "",
        p_desde: 0,
        p_limite: INITIAL_WORKSHOPS
    });
}

async function fetchSearchResults(location, service, page) {
    return supabaseRpc("buscar_talleres_profesional", {
        p_ubicacion: location,
        p_servicio: service,
        p_desde: (page - 1) * SEARCH_PAGE_SIZE,
        p_limite: SEARCH_PAGE_SIZE
    });
}

function renderWorkshopLinks(workshops, detailed = false) {
    const unique = Array.from(
        new Map(
            workshops
                .map((workshop) => [workshopSlug(workshop), workshop])
                .filter(([slug]) => Boolean(slug))
        ).values()
    );

    if (!unique.length) {
        return '<p class="mensaje-talleres">No hemos encontrado talleres con esos criterios. Prueba otra población, código postal o servicio.</p>';
    }

    return unique.map((workshop) => {
        const slug = workshopSlug(workshop);
        const name = workshop.nombre || workshop.name || titleFromSlug(slug);
        const city = workshop.ciudad || workshop.poblacion || workshop.municipio || "";
        const province = workshop.provincia || "";
        const address = workshop.direccion || "";
        const postalCode = workshop.codigo_postal || "";
        const location = detailed
            ? [address, postalCode, city, province].filter(Boolean).join(", ")
            : [city, province].filter(Boolean).join(", ");

        return `
            <article class="taller-card taller-card-inicial" data-taller-slug="${escapeHTML(slug)}">
                ${renderWorkshopMedia(workshop, name)}
                <div class="taller-informacion">
                    <h3><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${escapeHTML(name)}</a></h3>
                    ${location ? `<p class="ubicacion">⌖ ${escapeHTML(location)}</p>` : ""}
                    <p class="taller-descripcion">Consulta la ficha del taller, sus servicios y datos de contacto.</p>
                    <div class="taller-pie">
                        <span class="taller-contactos"><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a></span>
                    </div>
                </div>
            </article>`;
    }).join("");
}

function injectWorkshopLinks(html, workshopHTML) {
    const pattern = /(<div\s+class="talleres-grid"\s+id="lista-talleres"[^>]*>)([\s\S]*?)(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i;
    if (!pattern.test(html)) {
        throw new Error("No se encontró el contenedor #lista-talleres en index.html");
    }
    return html.replace(pattern, `$1${workshopHTML}$3`);
}

function searchURL(location, service, page = 1) {
    const params = new URLSearchParams();
    if (location) params.set("poblacion", location);
    if (service) params.set("servicio", service);
    if (page > 1) params.set("pagina", String(page));
    const query = params.toString();
    return `/${query ? `?${query}` : ""}#talleres`;
}

function prepareSearchForm(html, location, service) {
    let result = html.replace(
        /<form class="buscador" id="formulario-buscador-publico"([^>]*)>/i,
        '<form class="buscador" id="formulario-buscador-publico"$1 method="get" action="/#talleres">'
    );

    if (location) {
        result = result.replace(
            /(<input id="poblacion"[^>]*\bvalue=")[^"]*(")/i,
            `$1${escapeHTML(location)}$2`
        );
        if (!/id="poblacion"[^>]*\bvalue=/i.test(result)) {
            result = result.replace(
                /<input id="poblacion"/i,
                `<input value="${escapeHTML(location)}" id="poblacion"`
            );
        }
    }

    if (service) {
        const escapedService = service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const optionPattern = new RegExp(`(<option\\s+value="${escapedService}")([^>]*>)`, "i");
        result = result.replace(optionPattern, "$1 selected$2");
    }

    const popular = ["cambio-aceite-filtros", "neumaticos", "chapa-pintura", "pre-itv"];
    popular.forEach((slug) => {
        const pattern = new RegExp(`href="#talleres"(\\s+data-servicio="${slug}")`, "i");
        result = result.replace(pattern, `href="${escapeHTML(searchURL("", slug))}"$1`);
    });

    return result;
}

function injectSearchState(html, total, location, service) {
    const hasSearch = Boolean(location || service);
    if (!hasSearch) return html;

    let result = html.replace(
        /(<span class="mapa-estado">)[\s\S]*?(<\/span>)/i,
        `$1${total} ${total === 1 ? "disponible" : "disponibles"}$2`
    );

    result = result.replace(
        /(<section id="talleres"[\s\S]*?<div class="titulo-seccion alineado-izquierda"><span>[^<]*<\/span><h2>)[\s\S]*?(<\/h2>)/i,
        `$1${total ? `${total.toLocaleString("es-ES")} talleres encontrados` : "Sin resultados"}$2`
    );

    result = result.replace(
        /<meta name="robots" content="[^"]*">/i,
        '<meta name="robots" content="noindex,follow,max-image-preview:large">'
    );

    return result;
}

function injectNoScriptPagination(html, location, service, page, total) {
    if (!location && !service) return html;

    const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
    if (totalPages <= 1) return html;

    const links = [];
    if (page > 1) {
        links.push(`<a class="boton boton-claro" href="${escapeHTML(searchURL(location, service, page - 1))}">← Anterior</a>`);
    }
    if (page < totalPages) {
        links.push(`<a class="boton" href="${escapeHTML(searchURL(location, service, page + 1))}">Siguiente →</a>`);
    }

    const fallback = `<noscript><style>#boton-cargar-mas{display:none!important}</style><nav class="cargar-mas-contenedor municipio-paginacion" aria-label="Paginación de resultados">${links.join("")}<span>Página ${page} de ${totalPages}</span></nav></noscript>`;

    return html.replace(
        /(<div id="contenedor-cargar-mas" class="cargar-mas-contenedor" hidden>)/i,
        `${fallback}$1`
    );
}

function prepareFrontendScripts(html) {
    let result = html.replace(
        /js\/cookie-consent\.js(?:\?[^\"']*)?/g,
        `js/cookie-consent.js?v=${COOKIE_SCRIPT_VERSION}`
    );

    result = result.replace(
        /<script defer src="js\/supabase\.js(?:\?[^\"]*)?"><\/script>/i,
        `<script defer src="js/taller-ui.js?v=${FRONTEND_VERSION}"></script><script defer src="js/supabase.js?v=${FRONTEND_VERSION}"></script>`
    );

    return result;
}

export default async function handler(request, response) {
    let html;

    try {
        html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer index.html:", error);
        response.status(500).send("No se pudo renderizar la portada.");
        return;
    }

    const location = safeTerm(request.query?.poblacion);
    const service = slugify(safeTerm(request.query?.servicio)).slice(0, MAX_TERM);
    const page = requestedPage(request.query?.pagina);
    const hasSearch = Boolean(location || service);

    html = prepareSearchForm(html, location, service);

    try {
        const workshops = hasSearch
            ? await fetchSearchResults(location, service, page)
            : await fetchInitialWorkshops();

        const total = hasSearch
            ? (workshops.length ? Number(workshops[0]?.total_resultados) || workshops.length : 0)
            : workshops.length;

        html = injectWorkshopLinks(html, renderWorkshopLinks(workshops, hasSearch));
        html = injectSearchState(html, total, location, service);
        html = injectNoScriptPagination(html, location, service, page, total);

        response.setHeader(
            "X-TallerMap-Initial-Workshop-Links",
            String(workshops.length)
        );
        response.setHeader("X-TallerMap-Search-SSR", hasSearch ? "1" : "0");
    } catch (error) {
        console.error("No se pudieron renderizar talleres iniciales:", error);
        response.setHeader("X-TallerMap-Initial-Workshop-Links", "0");
        response.setHeader("X-TallerMap-Search-SSR", "0");
    }

    html = prepareFrontendScripts(html);

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("X-TallerMap-Home-SSR", "1");
    response.status(200).send(html);
}
