import fs from "node:fs";
import path from "node:path";
import {
    escapeHTML,
    renderWorkshopMedia,
    reviewStatusLabel,
    safePhone,
    safeWeb,
    serviceLabel,
    supabaseRpc,
    workshopSlug
} from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";
const MUNICIPALITY_LIMIT = 5000;

function safeFileName(value) {
    const fileName = String(value || "").trim().toLowerCase();
    return /^[a-z0-9-]+-\d{5}\.html$/.test(fileName) ? fileName : "";
}

function safeService(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 80);
}

function humanizeSlug(value) {
    return String(value || "")
        .replace(/-\d{5}\.html$/i, "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toLocaleUpperCase("es") + part.slice(1))
        .join(" ");
}

function readMunicipalityMeta(fileName) {
    const fallbackCode = (fileName.match(/(\d{5})\.html$/) || [])[1] || "";
    const fallbackName = humanizeSlug(fileName);

    try {
        const source = fs.readFileSync(path.join(process.cwd(), "municipios", fileName), "utf8");
        const match = source.match(
            /id="lista-talleres"[\s\S]*?data-municipio="([^"]+)"[\s\S]*?data-codigo-municipal="([^"]+)"/i
        );

        if (match) {
            return {
                name: String(match[1] || fallbackName).trim(),
                code: String(match[2] || fallbackCode).replace(/\D/g, "").slice(0, 5)
            };
        }
    } catch (_error) {
        // El HTML histórico solo aporta nombre y código municipal.
    }

    return { name: fallbackName, code: fallbackCode };
}

function cleanDescription(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || /^servicios\b/i.test(text) || text.length > 220) {
        return "Consulta la ficha del taller para conocer sus servicios y datos de contacto.";
    }
    return text;
}

function mapsURL(workshop, name) {
    const query = [
        name,
        workshop?.direccion,
        workshop?.codigo_postal,
        workshop?.ciudad,
        workshop?.provincia,
        "España"
    ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(", ");

    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : "";
}

function renderWorkshop(workshop) {
    const rawName = workshop?.nombre || workshop?.nombre_taller || "Taller sin nombre";
    const slug = workshopSlug(workshop);
    const phone = safePhone(workshop?.telefono);
    const web = safeWeb(workshop?.web);
    const map = mapsURL(workshop, rawName);
    const address = [
        workshop?.direccion,
        workshop?.codigo_postal,
        workshop?.ciudad,
        workshop?.provincia
    ]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(", ");

    const services = Array.isArray(workshop?.servicios)
        ? workshop.servicios.map(serviceLabel).filter(Boolean).slice(0, 4)
        : [];

    const serviceMarkup = (services.length ? services : ["Taller mecánico"])
        .map((service) => `<span>${escapeHTML(service)}</span>`)
        .join("");

    const buttons = [];
    if (phone) buttons.push(`<a class="tm-card-btn tm-card-btn-call" href="tel:${escapeHTML(phone)}">Llamar</a>`);
    if (slug) buttons.push(`<a class="tm-card-btn tm-card-btn-profile" href="/talleres/${encodeURIComponent(slug)}">▤ Ver ficha</a>`);
    if (map) buttons.push(`<a class="tm-card-btn tm-card-btn-map" href="${escapeHTML(map)}" target="_blank" rel="noopener noreferrer">⌖ Abrir en Google Maps</a>`);
    if (web) buttons.push(`<a class="tm-card-btn tm-card-btn-web" href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);

    return `
        <article class="taller-card taller-card-unificada" data-taller-slug="${escapeHTML(slug)}">
            ${renderWorkshopMedia(workshop, rawName)}
            <div class="taller-informacion">
                <span class="verificado verificado-en-contenido">${escapeHTML(reviewStatusLabel(Boolean(workshop?.verificado)))}</span>
                <h3>${slug ? `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${escapeHTML(rawName)}</a>` : escapeHTML(rawName)}</h3>
                <p class="ubicacion">⌖ ${escapeHTML(address || "Ubicación no indicada")}</p>
                <p class="taller-descripcion">${escapeHTML(cleanDescription(workshop?.descripcion))}</p>
                <div class="especialidades">${serviceMarkup}</div>
                <div class="tm-card-actions">${buttons.join("") || "<span>Sin datos de contacto publicados</span>"}</div>
            </div>
        </article>
    `;
}

function renderServiceOptions(selected) {
    const options = [
        ["", "Todos los servicios"],
        ["mecanica-general", "Mecánica general"],
        ["cambio-aceite-filtros", "Cambio de aceite y filtros"],
        ["chapa-pintura", "Chapa y pintura"],
        ["neumaticos", "Neumáticos"],
        ["diagnosis-electronica", "Diagnosis electrónica"],
        ["aire-acondicionado", "Aire acondicionado"],
        ["pre-itv", "Pre-ITV"],
        ["hibridos-electricos", "Híbridos y eléctricos"]
    ];

    return options
        .map(([value, label]) => `<option value="${escapeHTML(value)}"${value === selected ? " selected" : ""}>${escapeHTML(label)}</option>`)
        .join("");
}

function renderPage({ fileName, municipality, workshops, service }) {
    const name = municipality.name;
    const code = municipality.code;
    const canonicalPath = `/municipios/${fileName}`;
    const canonical = `${SITE_URL}${canonicalPath}`;
    const indexable = !service;
    const title = `Talleres mecánicos en ${name} | TallerMap`;
    const description = `Encuentra talleres mecánicos publicados en ${name}. Consulta servicios, dirección, teléfono, ficha del taller y cómo llegar en TallerMap.`;
    const total = workshops.length;

    const cards = total
        ? workshops.map(renderWorkshop).join("")
        : `
            <div class="municipio-sin-talleres">
                <h3>Todavía no hay talleres publicados en ${escapeHTML(name)}</h3>
                <p>Un taller de esta población puede solicitar gratuitamente su alta en TallerMap.</p>
                <a class="boton" href="/pages/registro.html">Registrar un taller</a>
            </div>
        `;

    const structuredData = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Talleres mecánicos en ${name}`,
        description,
        url: canonical,
        isPartOf: { "@type": "WebSite", name: "TallerMap", url: `${SITE_URL}/` },
        about: { "@type": "Place", name, identifier: code },
        breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Municipios", item: `${SITE_URL}/municipios/` },
                { "@type": "ListItem", position: 3, name, item: canonical }
            ]
        }
    }).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(title)}</title>
    <meta name="description" content="${escapeHTML(description)}">
    <meta name="robots" content="${indexable ? "index,follow,max-image-preview:large" : "noindex,follow,max-image-preview:large"}">
    <link rel="canonical" href="${escapeHTML(canonical)}">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/css/estilo.css">
    <link rel="stylesheet" href="/css/municipios.css">
    <script type="application/ld+json">${structuredData}</script>
    <style>
        .taller-card-unificada{display:flex;flex-direction:column;overflow:hidden}
        .taller-card-unificada .taller-imagen{min-height:154px}
        .tm-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid #e4e9f0}
        .tm-card-btn{min-height:44px;display:flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:10px;text-decoration:none;font-weight:800;text-align:center}
        .tm-card-btn-call{border:1px solid #cfe0fb;background:#f3f8ff;color:#0d47a1}
        .tm-card-btn-profile{background:#1457d9;color:#fff;box-shadow:0 7px 16px rgba(20,87,217,.18)}
        .tm-card-btn-map{grid-column:1/-1;background:#079447;color:#fff;box-shadow:0 7px 16px rgba(7,148,71,.18)}
        .tm-card-btn-web{grid-column:1/-1;border:1px solid #d9e0e8;background:#fff;color:#17223b}
        @media (max-width:640px){.tm-card-actions{grid-template-columns:1fr}.tm-card-btn-map,.tm-card-btn-web{grid-column:auto}}
    </style>
</head>
<body class="pagina-municipio">
    <header class="cabecera">
        <div class="contenedor cabecera-contenido">
            <a href="/" class="marca" aria-label="Volver al inicio de TallerMap">
                <img class="marca-icono marca-icono-logo" src="/favicon.svg" alt="" width="46" height="46">
                <span class="marca-texto"><strong>TallerMap</strong><small>Talleres cerca de ti</small></span>
            </a>
            <nav class="menu" aria-label="Navegación principal">
                <a href="/">Inicio</a>
                <a href="/municipios/">Municipios</a>
                <a href="/#servicios">Servicios</a>
                <a href="/pages/registro.html">Registrar taller</a>
            </nav>
        </div>
    </header>

    <main>
        <section class="municipio-hero">
            <div class="contenedor">
                <nav class="migas" aria-label="Migas de pan">
                    <a href="/">Inicio</a><span aria-hidden="true">›</span>
                    <a href="/municipios/">Municipios</a><span aria-hidden="true">›</span>
                    <span>${escapeHTML(name)}</span>
                </nav>

                <div class="municipio-hero-grid">
                    <div>
                        <span class="etiqueta">Directorio local de talleres</span>
                        <h1>Talleres mecánicos en ${escapeHTML(name)}</h1>
                        <p class="municipio-intro">Consulta talleres de reparación y mantenimiento publicados en TallerMap para <strong>${escapeHTML(name)}</strong>. Filtra por servicio y abre la ficha individual para revisar horarios, contacto y cómo llegar.</p>
                        <p class="municipio-codigo">Código municipal: <strong>${escapeHTML(code)}</strong></p>
                    </div>

                    <aside class="municipio-panel">
                        <h2>Buscar en ${escapeHTML(name)}</h2>
                        <form class="buscador municipio-buscador" method="get" action="${escapeHTML(canonicalPath)}">
                            <label for="servicio">Servicio del vehículo</label>
                            <select id="servicio" name="servicio">${renderServiceOptions(service)}</select>
                            <button type="submit" class="boton boton-buscar">Filtrar talleres</button>
                        </form>
                    </aside>
                </div>
            </div>
        </section>

        <section id="talleres" class="seccion seccion-gris">
            <div class="contenedor">
                <div class="cabecera-seccion">
                    <div class="titulo-seccion alineado-izquierda">
                        <span>Resultados locales</span>
                        <h2>Talleres publicados en ${escapeHTML(name)}</h2>
                        <p>Todos los resultados usan la misma tarjeta pública de TallerMap.</p>
                    </div>
                    <span class="orden-talleres mapa-estado" aria-live="polite">${total} ${total === 1 ? "taller publicado" : "talleres publicados"}</span>
                </div>

                <div class="talleres-grid" id="lista-talleres" data-municipio="${escapeHTML(name)}" data-codigo-municipal="${escapeHTML(code)}">${cards}</div>
            </div>
        </section>
    </main>

    <footer class="pie">
        <div class="contenedor copyright">
            <span>© 2026 TallerMap</span>
            <span>Una plataforma de CRODIS Media</span>
        </div>
    </footer>
</body>
</html>`;
}

export default async function handler(request, response) {
    const fileName = safeFileName(request.query?.archivo);
    const service = safeService(request.query?.servicio);

    if (!fileName) {
        response.status(404).send("Municipio no encontrado.");
        return;
    }

    const municipality = readMunicipalityMeta(fileName);
    if (!municipality.code) {
        response.status(404).send("Municipio no encontrado.");
        return;
    }

    // Arquitectura: una sola URL pública por municipio.
    // Las antiguas URLs paginadas se consolidan de forma permanente.
    if (request.query?.pagina !== undefined) {
        const destination = service
            ? `/municipios/${fileName}?servicio=${encodeURIComponent(service)}`
            : `/municipios/${fileName}`;
        response.setHeader("Cache-Control", "public, max-age=3600");
        response.redirect(301, destination);
        return;
    }

    try {
        const workshops = await supabaseRpc("buscar_talleres_municipio", {
            p_codigo_municipal: municipality.code,
            p_servicio: service,
            p_desde: 0,
            p_limite: MUNICIPALITY_LIMIT
        });

        const html = renderPage({ fileName, municipality, workshops, service });

        if (service) response.setHeader("X-Robots-Tag", "noindex, follow");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Municipio-Renderer", "unico-v2");
        response.setHeader("X-TallerMap-Municipio", municipality.code);
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar el municipio:", error);
        response.setHeader("Retry-After", "60");
        response.status(503).send("No se pudo cargar el municipio en este momento.");
    }
}
