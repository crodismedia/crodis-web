import fs from "node:fs";
import path from "node:path";
import {
    escapeHTML,
    slugify,
    safeWeb,
    safePhone,
    supabaseRpc
} from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";
const DEFAULT_IMAGE = `${SITE_URL}/images/cartel-tallermap.png`;

function cleanText(value, maxLength = 160) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > maxLength
        ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
        : text;
}

function titleFor(workshop) {
    const name = cleanText(workshop?.nombre || "Taller", 70);
    const city = cleanText(workshop?.ciudad || "", 45);
    const province = cleanText(workshop?.provincia || "", 45);
    if (city && province) return cleanText(`${name} | Taller en ${city} (${province}) | TallerMap`, 68);
    if (city) return cleanText(`${name} | Taller en ${city} | TallerMap`, 68);
    return cleanText(`${name} | TallerMap`, 68);
}

function descriptionFor(workshop) {
    const name = cleanText(workshop?.nombre || "este taller", 70);
    const city = cleanText(workshop?.ciudad || "", 45);
    const province = cleanText(workshop?.provincia || "", 45);
    const base = cleanText(workshop?.descripcion || "", 155);
    if (base) return base;
    const location = [city, province].filter(Boolean).join(", ");
    return cleanText(`Consulta teléfono, dirección, horarios y servicios de ${name}${location ? ` en ${location}` : ""} en TallerMap.`, 155);
}

function workshopAddress(workshop) {
    return [workshop?.direccion, workshop?.codigo_postal, workshop?.ciudad, workshop?.provincia]
        .filter(Boolean)
        .map((value) => cleanText(value, 100))
        .join(", ");
}

const SERVICE_LABELS = {
    "mecanica-general": "Mecánica general",
    "cambio-aceite-filtros": "Cambio de aceite y filtros",
    "chapa-pintura": "Chapa y pintura",
    "neumaticos": "Neumáticos",
    "diagnosis-electronica": "Diagnosis electrónica",
    "aire-acondicionado": "Aire acondicionado",
    "hibridos-electricos": "Híbridos y eléctricos",
    "baterias": "Baterías",
    "lunas-cristales": "Lunas y cristales",
    "tapiceria": "Tapicería",
    "electricidad": "Electricidad",
    "frenos": "Frenos",
    "embrague": "Embrague",
    "suspension": "Suspensión",
    "direccion": "Dirección",
    "escape": "Escape",
    "pre-itv": "Pre-ITV",
    "itv": "ITV",
    "motor": "Motor",
    "caja-cambios": "Caja de cambios",
    "climatizacion": "Climatización",
    "alineacion": "Alineación",
    "equilibrado": "Equilibrado"
};

function serviceLabel(service) {
    const raw = typeof service === "string"
        ? service
        : (service?.nombre || service?.slug || "");

    const value = String(raw || "").trim();

    if (!value) return "";

    if (SERVICE_LABELS[value]) {
        return SERVICE_LABELS[value];
    }

    return value
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^./, letra => letra.toUpperCase());
}

function renderServices(workshop) {
    const services = Array.isArray(workshop?.servicios)
        ? workshop.servicios.map(serviceLabel).filter(Boolean).slice(0, 12)
        : [];
    if (!services.length) return '<span>Taller mecánico</span>';
    return services.map((service) => `<span>${escapeHTML(service)}</span>`).join("");
}

function renderSchedule(schedule) {
    if (!schedule || typeof schedule !== "object") return "";
    const days = [
        ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
        ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
        ["domingo", "Domingo"]
    ];
    const rows = days.map(([key, label]) => {
        const value = schedule[key];
        if (!value) return "";
        const text = value.cerrado
            ? "Cerrado"
            : (Array.isArray(value.turnos) ? value.turnos : [])
                .map((slot) => `${slot.apertura || ""}–${slot.cierre || ""}`)
                .filter((slot) => slot !== "–")
                .join(" y ");
        return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
    }).filter(Boolean).join("");
    return rows ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>` : "";
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return cleanText(value, 40);
    return new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function provinceURL(province) {
    const primaryName = String(province || "").split("/")[0].trim();
    const slug = slugify(primaryName);
    return slug ? `/provincias/${slug}.html` : "/provincias/";
}

function municipalityURL(workshop) {
    const city = String(workshop?.ciudad || "").trim();
    const municipalCode = String(workshop?.codigo_municipal || "")
        .replace(/\D/g, "")
        .slice(0, 5);

    if (city && municipalCode) {
        return `/municipios/${slugify(city)}-${municipalCode}.html`;
    }

    const params = new URLSearchParams();

    if (city) {
        params.set("poblacion", city);
    }

    return `/${params.toString() ? `?${params.toString()}` : ""}#talleres`;
}

async function fetchWorkshop(slug) {
    const rows = await supabaseRpc("obtener_taller_publico", {
        p_id: null,
        p_slug: slug
    });

    if (!rows.length) {
        return null;
    }

    const workshop = rows[0];

    try {
        const contextRows = await supabaseRpc("obtener_contexto_taller", {
            p_id: workshop?.id || null,
            p_slug: slug
        });

        const context = contextRows.length ? contextRows[0] : null;

        if (!context) {
            return workshop;
        }

        return {
            ...workshop,

            ciudad:
                context.municipio ||
                workshop.ciudad ||
                "",

            codigo_municipal:
                context.codigo_municipal ||
                workshop.codigo_municipal ||
                "",

            provincia:
                workshop.provincia ||
                context.provincia ||
                "",

            provincia_slug:
                context.provincia_slug ||
                workshop.provincia_slug ||
                ""
        };
    } catch (error) {
        console.warn(
            "No se pudo obtener el contexto municipal de la ficha:",
            error
        );

        return workshop;
    }
}

function injectCoreContent(html, workshop, slug) {
    const canonical = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
    const title = titleFor(workshop);
    const description = descriptionFor(workshop);
    const name = cleanText(workshop?.nombre || "Ficha de taller", 100);
    const address = workshopAddress(workshop);
    const phone = safePhone(workshop?.telefono);
    const web = safeWeb(workshop?.web);
    const city = cleanText(workshop?.ciudad || "", 80);
    const province = cleanText(workshop?.provincia || "", 80);
    const updated = formatDate(workshop?.updated_at);
    const verified = Boolean(workshop?.verificado);

    const actions = [];
    if (phone) actions.push(`<a class="boton accion-principal" href="tel:${escapeHTML(phone)}">Llamar</a>`);
    if (web) actions.push(`<a class="boton boton-claro" href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
    if (address) {
        actions.push(`<a class="boton boton-claro" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`);
    }

    const dataRows = [];
    if (phone) dataRows.push(`<p><strong>Teléfono:</strong> <a href="tel:${escapeHTML(phone)}">${escapeHTML(phone)}</a></p>`);
    if (web) dataRows.push(`<p><strong>Web:</strong> <a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Visitar sitio web</a></p>`);
    const schedule = renderSchedule(workshop?.horarios);
    if (schedule) dataRows.push(schedule);

    const crumbs = [
        '<a href="/">Inicio</a>',
        province ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(provinceURL(province))}">${escapeHTML(province)}</a>` : "",
        city ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(municipalityURL(workshop))}">${escapeHTML(city)}</a>` : "",
        `<span class="ficha-migas-separador" aria-hidden="true">›</span><span>${escapeHTML(name)}</span>`
    ].filter(Boolean).join("");

    html = html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHTML(description)}">`)
        .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" id="canonical-taller" href="${escapeHTML(canonical)}">`)
        .replace(/<h1\s+id="taller-nombre">[\s\S]*?<\/h1>/i, `<h1 id="taller-nombre">${escapeHTML(name)}</h1>`)
        .replace(/<p\s+id="taller-direccion"\s+class="ficha-publica-direccion">[\s\S]*?<\/p>/i, `<p id="taller-direccion" class="ficha-publica-direccion">${escapeHTML(address || "Ubicación no indicada")}</p>`)
        .replace(/<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">[\s\S]*?<\/nav>/i, `<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">${crumbs}</nav>`)
        .replace(/<span id="taller-verificacion" class="ficha-insignia">[\s\S]*?<\/span>/i, `<span id="taller-verificacion" class="ficha-insignia${verified ? " verificada" : ""}">${verified ? "✓ Taller verificado" : "Datos públicos pendientes de verificar"}</span>`)
        .replace(/<span id="taller-actualizacion" class="ficha-fecha">[\s\S]*?<\/span>/i, `<span id="taller-actualizacion" class="ficha-fecha">${updated ? `Última actualización: ${escapeHTML(updated)}` : ""}</span>`)
        .replace(/<div id="taller-acciones" class="ficha-publica-acciones">[\s\S]*?<\/div>/i, `<div id="taller-acciones" class="ficha-publica-acciones">${actions.join("")}</div>`)
        .replace(/<p id="taller-descripcion">[\s\S]*?<\/p>/i, `<p id="taller-descripcion">${escapeHTML(description)}</p>`)
        .replace(/<div id="taller-servicios" class="especialidades">[\s\S]*?<\/div>/i, `<div id="taller-servicios" class="especialidades">${renderServices(workshop)}</div>`)
        .replace(/<div id="taller-datos" class="ficha-publica-datos">[\s\S]*?<\/div>/i, `<div id="taller-datos" class="ficha-publica-datos">${dataRows.join("")}</div>`)
        .replace(/\.\.\/index\.html#talleres/g, "/#talleres")
        .replace(/\.\.\/index\.html/g, "/");

    if (city || province) {
        const localLinks = [
            city ? `<a class="boton" href="${escapeHTML(municipalityURL(workshop))}">Ver talleres en ${escapeHTML(city)}</a>` : "",
            province ? `<a class="boton boton-claro" href="${escapeHTML(provinceURL(province))}">Ver talleres en ${escapeHTML(province)}</a>` : ""
        ].filter(Boolean).join("");
        html = html
            .replace(/<section id="contexto-local" class="ficha-contexto" hidden>/i, '<section id="contexto-local" class="ficha-contexto">')
            .replace(/<h2 id="contexto-titulo">[\s\S]*?<\/h2>/i, `<h2 id="contexto-titulo">${escapeHTML(city ? `Talleres en ${city}` : `Talleres en ${province}`)}</h2>`)
            .replace(/<p id="contexto-texto">[\s\S]*?<\/p>/i, `<p id="contexto-texto">Consulta otros talleres publicados en esta zona.</p>`)
            .replace(/<div id="contexto-enlaces" class="ficha-contexto-enlaces">[\s\S]*?<\/div>/i, `<div id="contexto-enlaces" class="ficha-contexto-enlaces">${localLinks}</div>`);
    }

    const social = `\n    <meta property="og:type" content="website">\n    <meta property="og:site_name" content="TallerMap">\n    <meta property="og:title" content="${escapeHTML(title)}">\n    <meta property="og:description" content="${escapeHTML(description)}">\n    <meta property="og:url" content="${escapeHTML(canonical)}">\n    <meta property="og:image" content="${escapeHTML(DEFAULT_IMAGE)}">\n    <meta property="og:locale" content="es_ES">\n    <meta name="twitter:card" content="summary_large_image">\n    <meta name="twitter:title" content="${escapeHTML(title)}">\n    <meta name="twitter:description" content="${escapeHTML(description)}">\n    <meta name="twitter:image" content="${escapeHTML(DEFAULT_IMAGE)}">`;
    if (!/property="og:title"/i.test(html)) {
        html = html.replace(/(<link\s+rel="canonical"[^>]*>)/i, `$1${social}`);
    }

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        name,
        url: canonical,
        description,
        address: address || undefined,
        telephone: phone || undefined,
        sameAs: web || undefined
    };
    const breadcrumbItems = [];

breadcrumbItems.push({
    "@type": "ListItem",
    position: 1,
    name: "Inicio",
    item: `${SITE_URL}/`
});

let breadcrumbPosition = 2;

if (province) {
    breadcrumbItems.push({
        "@type": "ListItem",
        position: breadcrumbPosition++,
        name: province,
        item: `${SITE_URL}${provinceURL(province)}`
    });
}

if (city) {
    breadcrumbItems.push({
        "@type": "ListItem",
        position: breadcrumbPosition++,
        name: city,
        item: `${SITE_URL}${municipalityURL(workshop)}`
    });
}

breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbPosition,
    name,
    item: canonical
});

const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems
};

html = html.replace(
    /<script\s+type="application\/ld\+json"\s+id="datos-estructurados-migas">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" id="datos-estructurados-migas">${JSON.stringify(breadcrumbStructuredData).replace(/</g, "\\u003c")}</script>`
);
    Object.keys(structuredData).forEach((key) => structuredData[key] === undefined && delete structuredData[key]);
    html = html.replace(
        /<script\s+type="application\/ld\+json"\s+id="datos-estructurados-taller">[\s\S]*?<\/script>/i,
        `<script type="application/ld+json" id="datos-estructurados-taller">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    );

    const legacyRewrite = /<script>\s*\(function\(\)\s*\{[\s\S]*?window\.__TALLERMAP_URL_LIMPIA__[\s\S]*?<\/script>\s*/i;
    html = html.replace(legacyRewrite, "");

    return html;
}

export default async function handler(request, response) {
    let html;
    try {
        html = fs.readFileSync(path.join(process.cwd(), "pages", "taller.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer pages/taller.html:", error);
        response.status(500).send("No se pudo renderizar la ficha.");
        return;
    }

    const rawSlug = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
    const slug = slugify(rawSlug);
    if (!slug) {
        response.status(404).send("Ficha no encontrada.");
        return;
    }

    try {
        const workshop = await fetchWorkshop(slug);
        if (!workshop) {
            response.status(404).send("Ficha no encontrada.");
            return;
        }
        html = injectCoreContent(html, workshop, slug);
        response.setHeader("X-TallerMap-SEO-SSR", "1");
        response.setHeader("X-TallerMap-Ficha-SSR", "1");
    } catch (error) {
        console.error("No se pudo preparar la ficha SSR:", error);
        response.setHeader("X-TallerMap-SEO-SSR", "0");
        response.setHeader("X-TallerMap-Ficha-SSR", "0");
    }

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    response.status(200).send(html);
}
