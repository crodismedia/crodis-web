import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const INITIAL_WORKSHOPS = 24;
const COOKIE_SCRIPT_VERSION = "20260809-4";
const FRONTEND_VERSION = "20260810-1";

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
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
        body: JSON.stringify({ p_limite: INITIAL_WORKSHOPS, p_desde: 0 })
    });
    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }
    const rows = await result.json();
    return Array.isArray(rows) ? rows : [];
}

function renderInitialWorkshopLinks(workshops) {
    const unique = Array.from(new Map(
        workshops.map((workshop) => [safeSlug(workshop?.slug), workshop]).filter(([slug]) => Boolean(slug))
    ).values());
    if (!unique.length) return '<p class="mensaje-talleres">Consulta talleres publicados por población, código postal o servicio.</p>';
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
                    <div class="taller-pie"><span class="taller-contactos"><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a></span></div>
                </div>
            </article>`;
    }).join("");
}

function injectWorkshopLinks(html, workshopHTML) {
    const pattern = /(<div\s+class="talleres-grid"\s+id="lista-talleres"[^>]*>)([\s\S]*?)(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i;
    if (!pattern.test(html)) throw new Error("No se encontró el contenedor #lista-talleres en index.html");
    return html.replace(pattern, `$1${workshopHTML}$3`);
}

function injectMobileMenu(html) {
    const styles = `
<style id="tallermap-menu-movil-estilos">
#lista-talleres .valoracion,#lista-talleres .abierto{display:none!important}
.menu-movil-control,.menu-movil-label,.menu-movil-panel{display:none}
@media(max-width:1050px){
.cabecera-contenido{position:relative}
.menu-movil-control{position:absolute;opacity:0;pointer-events:none}
.menu-movil-label{display:grid;width:48px;height:48px;margin-left:auto;place-items:center;flex:0 0 auto;color:#071a33;background:#fff;border:1px solid #dfe6ef;border-radius:12px;box-shadow:0 8px 20px rgba(20,36,64,.08);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;z-index:1002}
.menu-movil-icono,.menu-movil-icono:before,.menu-movil-icono:after{display:block;width:23px;height:3px;background:#071a33;border-radius:5px;content:""}
.menu-movil-icono{position:relative}.menu-movil-icono:before{position:absolute;top:-7px;left:0}.menu-movil-icono:after{position:absolute;top:7px;left:0}
.menu-movil-panel{position:fixed;top:68px;right:0;left:0;z-index:1001;gap:4px;padding:12px 18px 20px;background:#fff;border-top:1px solid #dfe6ef;border-bottom:1px solid #dfe6ef;box-shadow:0 18px 30px rgba(20,36,64,.15)}
.menu-movil-control:checked~.menu-movil-panel{display:grid}
.menu-movil-control:checked+.menu-movil-label .menu-movil-icono{background:transparent}
.menu-movil-control:checked+.menu-movil-label .menu-movil-icono:before{top:0;transform:rotate(45deg)}
.menu-movil-control:checked+.menu-movil-label .menu-movil-icono:after{top:0;transform:rotate(-45deg)}
.menu-movil-panel a{display:block;padding:14px 15px;color:#071a33;font-weight:800;border-radius:10px}
.menu-movil-panel a:active,.menu-movil-panel a:focus-visible{background:#eaf2ff;outline:none}
.menu-movil-panel .menu-movil-registro{margin-top:6px;color:#fff;text-align:center;background:linear-gradient(135deg,#1457d9,#0b43ad)}
}
@media(max-width:750px){.cabecera-contenido{min-height:68px!important;flex-direction:row!important;align-items:center!important;gap:10px!important}.acciones-cabecera{display:none!important}.marca{min-width:0}.marca-texto strong{font-size:20px}.marca-texto small{font-size:10px}}
</style>`;
    const menu = `
<input class="menu-movil-control" type="checkbox" id="menu-movil-control" aria-hidden="true">
<label class="menu-movil-label" for="menu-movil-control" aria-label="Abrir o cerrar menú de navegación"><span class="menu-movil-icono" aria-hidden="true"></span></label>
<nav class="menu-movil-panel" aria-label="Navegación móvil"><a href="/">Inicio</a><a href="#servicios">Servicios</a><a href="#provincias">Provincias</a><a href="#talleres">Talleres</a><a href="#como-funciona">Cómo funciona</a><a class="menu-movil-registro" href="/pages/registro.html">Registrar taller</a></nav>`;
    const headerPattern = /(<nav class="menu">[\s\S]*?<\/nav>)(<div class="acciones-cabecera">)/i;
    if (!headerPattern.test(html)) return html;
    return html.replace("</head>", `${styles}\n</head>`).replace(headerPattern, `$1${menu}$2`);
}

function prepareFrontendScripts(html) {
    let result = html.replace(/js\/cookie-consent\.js(?:\?[^\"']*)?/g, `js/cookie-consent.js?v=${COOKIE_SCRIPT_VERSION}`);
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
        return response.status(500).send("No se pudo renderizar la portada.");
    }
    try {
        const workshops = await fetchInitialWorkshops();
        html = injectWorkshopLinks(html, renderInitialWorkshopLinks(workshops));
        response.setHeader("X-TallerMap-Initial-Workshop-Links", String(Math.min(workshops.length, INITIAL_WORKSHOPS)));
    } catch (error) {
        console.error("No se pudieron renderizar talleres iniciales:", error);
        response.setHeader("X-TallerMap-Initial-Workshop-Links", "0");
    }
    html = injectMobileMenu(html);
    html = prepareFrontendScripts(html);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(200).send(html);
}
