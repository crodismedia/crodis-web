import fs from "node:fs";
import path from "node:path";
import { escapeHTML, slugify, supabaseRpc } from "../lib/server-utils.js";

const INITIAL_WORKSHOPS = 24;
const COOKIE_SCRIPT_VERSION = "20260809-4";
const FRONTEND_VERSION = "20260810-1";

function titleFromSlug(slug) {
    return String(slug || "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchInitialWorkshops() {
    return supabaseRpc("listar_talleres_sitemap", {
        p_limite: INITIAL_WORKSHOPS,
        p_desde: 0
    });
}

function renderInitialWorkshopLinks(workshops) {
    const unique = Array.from(
        new Map(
            workshops
                .map((workshop) => [slugify(workshop?.slug), workshop])
                .filter(([slug]) => Boolean(slug))
        ).values()
    );

    if (!unique.length) {
        return '<p class="mensaje-talleres">Consulta talleres publicados por población, código postal o servicio.</p>';
    }

    return unique.map((workshop) => {
        const slug = slugify(workshop.slug);
        const name = workshop.nombre || workshop.name || titleFromSlug(slug);
        const city = workshop.ciudad || workshop.poblacion || workshop.municipio || "";
        const province = workshop.provincia || "";
        const location = [city, province].filter(Boolean).join(", ");

        return `
            <article class="taller-card taller-card-inicial" data-taller-slug="${escapeHTML(slug)}">
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

export default async function handler(_request, response) {
    let html;

    try {
        html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer index.html:", error);
        response.status(500).send("No se pudo renderizar la portada.");
        return;
    }

    try {
        const workshops = await fetchInitialWorkshops();
        html = injectWorkshopLinks(html, renderInitialWorkshopLinks(workshops));
        response.setHeader(
            "X-TallerMap-Initial-Workshop-Links",
            String(Math.min(workshops.length, INITIAL_WORKSHOPS))
        );
    } catch (error) {
        console.error("No se pudieron renderizar talleres iniciales:", error);
        response.setHeader("X-TallerMap-Initial-Workshop-Links", "0");
    }

    html = prepareFrontendScripts(html);

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("X-TallerMap-Home-SSR", "1");
    response.status(200).send(html);
}
