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
    supabaseRpc,
    workshopSlug
} from "../lib/server-utils.js";

const PAGE_SIZE = 30;
const ALLOWED = new Set([
    "mecanica-general","neumaticos","chapa-pintura","diagnosis-electronica",
    "aire-acondicionado","hibridos-electricos","frenos","embrague",
    "cambio-aceite-filtros","baterias","suspension-amortiguadores",
    "alineacion-direccion","electricidad-automovil","correa-distribucion",
    "pre-itv","reparacion-motor","caja-cambios","sistema-refrigeracion",
    "escape-catalizador","cadena-distribucion","alternador-motor-arranque",
    "lunas-cristales","carroceria","equilibrado-ruedas",
    "centralitas-electronica","calefaccion-climatizacion"
]);

function safeSlug(value) {
    const slug = String(value || "").trim().toLowerCase();
    return ALLOWED.has(slug) ? slug : "";
}

async function fetchWorkshops(service) {
    return supabaseRpc("buscar_talleres_profesional", {
        p_ubicacion: "",
        p_servicio: service,
        p_desde: 0,
        p_limite: PAGE_SIZE
    });
}

function renderWorkshop(workshop) {
    const raw = workshop.nombre || "Taller sin nombre";
    const name = escapeHTML(raw);
    const slug = workshopSlug(workshop);
    const location = [workshop.direccion, workshop.codigo_postal, workshop.ciudad, workshop.provincia]
        .filter(Boolean).map(escapeHTML).join(", ");
    const phone = safePhone(workshop.telefono);
    const phoneDisplay = formatPhoneDisplay(workshop.telefono);
    const web = safeWeb(workshop.web);
    const services = Array.isArray(workshop.servicios) ? workshop.servicios.slice(0, 4) : [];
    const contacts = [];

    if (phone) contacts.push(`<a href="tel:${escapeHTML(phone)}">${escapeHTML(phoneDisplay || "Llamar")}</a>`);
    if (web) contacts.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
    if (slug) contacts.push(`<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a>`);

    return `<article class="taller-card">${renderWorkshopMedia(workshop, raw)}<div class="taller-informacion"><span class="verificado verificado-en-contenido">${escapeHTML(reviewStatusLabel(Boolean(workshop.verificado)))}</span><h3>${slug ? `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${name}</a>` : name}</h3><p class="ubicacion">⌖ ${location || "Ubicación no indicada"}</p>${services.length ? `<div class="especialidades">${services.map((s) => `<span>${escapeHTML(serviceLabel(s))}</span>`).join("")}</div>` : ""}<div class="taller-pie"><span class="taller-contactos">${contacts.join("") || "Sin contacto publicado"}</span></div></div></article>`;
}

function buildSection(workshops, total) {
    const cards = workshops.length
        ? workshops.map(renderWorkshop).join("")
        : '<p class="mensaje-talleres">No hay talleres publicados para este servicio.</p>';

    return `<section class="seccion seccion-gris" id="talleres-servicio"><div class="contenedor"><div class="cabecera-seccion"><div class="titulo-seccion alineado-izquierda"><span>Directorio por servicio</span><h2>Talleres publicados para este servicio</h2><p>Mostramos una selección de talleres. La navegación territorial completa se realiza por provincia y municipio.</p></div><span class="orden-talleres mapa-estado">${total} ${total === 1 ? "taller" : "talleres"}</span></div><div class="talleres-grid">${cards}</div></div></section>`;
}

function injectDirectory(html, section) {
    const flexible = /(<section class="seccion"[^>]*>[\s\S]*?<span>Explorar TallerMap<\/span>)/i;
    let result = flexible.test(html)
        ? html.replace(flexible, `${section}\n$1`)
        : html.replace("</main>", `${section}\n</main>`);

    if (!/imagenes-automaticas\.js/i.test(result)) {
        result = result.replace("</body>", '<script defer src="../js/imagenes-automaticas.js?v=20260810-2"></script>\n</body>');
    }
    return result;
}

export default async function handler(request, response) {
    const service = safeSlug(request.query?.servicio);
    if (!service) {
        response.status(404).send("Servicio no encontrado.");
        return;
    }

    // Una especialidad = una URL pública. Las antiguas paginaciones no forman
    // parte de la arquitectura y se consolidan hacia la URL canónica del servicio.
    const requestedPage = Number.parseInt(String(request.query?.pagina || "1"), 10) || 1;
    if (requestedPage > 1) {
        response.setHeader("Cache-Control", "no-store");
        response.redirect(301, `/servicios/${service}.html`);
        return;
    }

    let html;
    try {
        html = fs.readFileSync(path.join(process.cwd(), "servicios", `${service}.html`), "utf8");
    } catch {
        response.status(404).send("Servicio no encontrado.");
        return;
    }

    try {
        const workshops = await fetchWorkshops(service);
        const total = workshops.length
            ? Number(workshops[0]?.total_resultados) || workshops.length
            : 0;

        html = injectDirectory(html, buildSection(workshops, total));
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Servicio", service);
        response.setHeader("X-TallerMap-Servicio-Talleres", String(total));
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar servicio:", error);
        html = html.replace(
            /<meta name="robots" content="[^"]*">/i,
            '<meta name="robots" content="noindex,follow,max-image-preview:large">'
        );
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Retry-After", "60");
        response.status(503).send(html);
    }
}
