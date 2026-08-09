import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const INITIAL_WORKSHOPS = 24;

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeSlug(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
    return String(slug || "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchInitialWorkshops() {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`;
    const result = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_limite: INITIAL_WORKSHOPS,
            p_desde: 0
        })
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const rows = await result.json();
    return Array.isArray(rows) ? rows : [];
}

function renderInitialWorkshopLinks(workshops) {
    const unique = Array.from(
        new Map(
            workshops
                .map((workshop) => {
                    const slug = safeSlug(workshop?.slug);
                    return [slug, workshop];
                })
                .filter(([slug]) => Boolean(slug))
        ).values()
    );

    if (!unique.length) {
        return '<p class="mensaje-talleres">Consulta talleres publicados por población, código postal o servicio.</p>';
    }

    return unique.map((workshop) => {
        const slug = safeSlug(workshop.slug);
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
            </article>
        `;
    }).join("");
}

function injectWorkshopLinks(html, workshopHTML) {
    const pattern = /(<div\s+class="talleres-grid"\s+id="lista-talleres"[^>]*>)([\s\S]*?)(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i;

    if (!pattern.test(html)) {
        throw new Error("No se encontró el contenedor #lista-talleres en index.html");
    }

    return html.replace(pattern, `$1${workshopHTML}$3`);
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
        response.setHeader("X-TallerMap-Initial-Workshop-Links", String(Math.min(workshops.length, INITIAL_WORKSHOPS)));
    } catch (error) {
        console.error("No se pudieron renderizar talleres iniciales:", error);
        response.setHeader("X-TallerMap-Initial-Workshop-Links", "0");
    }

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    response.status(200).send(html);
}
