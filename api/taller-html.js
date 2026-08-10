import fs from "node:fs";
import path from "node:path";
import {
    escapeHTML,
    formatPhoneDisplay,
    slugify,
    safeWeb,
    safePhone,
    reviewStatusLabel,
    serviceLabel,
    supabaseRpc,
    workshopPhotoSource
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
    const supplied = cleanText(workshop?.descripcion || "", 155);
    if (supplied) return supplied;
    const location = [city, province].filter(Boolean).join(", ");
    return cleanText(`Consulta teléfono, dirección, horarios, servicios y cómo llegar a ${name}${location ? ` en ${location}` : ""}.`, 155);
}

function workshopAddress(workshop) {
    return [workshop?.direccion, workshop?.codigo_postal, workshop?.ciudad, workshop?.provincia]
        .filter(Boolean)
        .map((value) => cleanText(value, 100))
        .filter((value, index, all) => all.findIndex((other) => other.toLocaleLowerCase("es") === value.toLocaleLowerCase("es")) === index)
        .join(", ");
}

function postalAddress(workshop) {
    const streetAddress = cleanText(workshop?.direccion || "", 120);
    const postalCode = cleanText(workshop?.codigo_postal || "", 12);
    const addressLocality = cleanText(workshop?.ciudad || "", 80);
    const addressRegion = cleanText(workshop?.provincia || "", 80);
    if (!streetAddress && !postalCode && !addressLocality && !addressRegion) return undefined;
    return {
        "@type": "PostalAddress",
        ...(streetAddress ? { streetAddress } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(addressLocality ? { addressLocality } : {}),
        ...(addressRegion ? { addressRegion } : {}),
        addressCountry: "ES"
    };
}

function renderServices(workshop) {
    const services = Array.isArray(workshop?.servicios)
        ? workshop.servicios.map(serviceLabel).filter(Boolean).slice(0, 16)
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
                .map((slot) => `${slot?.apertura || ""}–${slot?.cierre || ""}`)
                .filter((slot) => slot !== "–")
                .join(" y ");
        return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
    }).filter(Boolean).join("");
    return rows ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>` : "";
}

function openingHoursSpecifications(schedule) {
    if (!schedule || typeof schedule !== "object") return undefined;
    const dayNames = {
        lunes: "Monday", martes: "Tuesday", miercoles: "Wednesday",
        jueves: "Thursday", viernes: "Friday", sabado: "Saturday", domingo: "Sunday"
    };
    const result = [];
    for (const [key, dayOfWeek] of Object.entries(dayNames)) {
        const value = schedule[key];
        if (!value || value.cerrado) continue;
        for (const slot of Array.isArray(value.turnos) ? value.turnos : []) {
            const opens = String(slot?.apertura || "").trim();
            const closes = String(slot?.cierre || "").trim();
            if (!/^\d{2}:\d{2}$/.test(opens) || !/^\d{2}:\d{2}$/.test(closes)) continue;
            result.push({ "@type": "OpeningHoursSpecification", dayOfWeek, opens, closes });
        }
    }
    return result.length ? result : undefined;
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return cleanText(value, 40);
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function provinceURL(province) {
    const primaryName = String(province || "").split("/")[0].trim();
    const slug = slugify(primaryName);
    return slug ? `/provincias/${slug}.html` : "/provincias/";
}

function municipalityURL(workshop) {
    const city = String(workshop?.ciudad || "").trim();
    const municipalCode = String(workshop?.codigo_municipal || "").replace(/\D/g, "").slice(0, 5);
    if (city && municipalCode) return `/municipios/${slugify(city)}-${municipalCode}.html`;
    const params = new URLSearchParams();
    if (city) params.set("poblacion", city);
    return `/${params.toString() ? `?${params.toString()}` : ""}#talleres`;
}

function whatsappPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (/^[67]\d{8}$/.test(digits)) return `34${digits}`;
    if (/^34[67]\d{8}$/.test(digits)) return digits;
    return "";
}

function primaryImage(workshop) {
    const source = workshopPhotoSource(workshop);
    return source.url || DEFAULT_IMAGE;
}

async function fetchWorkshop(slug) {
    const rows = await supabaseRpc("obtener_taller_publico", { p_id: null, p_slug: slug });
    if (!rows.length) return null;
    const workshop = rows[0];
    try {
        const contextRows = await supabaseRpc("obtener_contexto_taller", {
            p_id: workshop?.id || null,
            p_slug: slug
        });
        const context = contextRows[0];
        if (!context) return workshop;
        return {
            ...workshop,
            ciudad: context.municipio || workshop.ciudad || "",
            codigo_municipal: context.codigo_municipal || workshop.codigo_municipal || "",
            provincia: workshop.provincia || context.provincia || "",
            provincia_slug: context.provincia_slug || workshop.provincia_slug || ""
        };
    } catch (error) {
        console.warn("No se pudo obtener contexto municipal:", error);
        return workshop;
    }
}

async function fetchRelated(workshop, slug) {
    try {
        return await supabaseRpc("buscar_talleres_relacionados", {
            p_id: workshop?.id || null,
            p_slug: workshop?.slug || slug,
            p_limite: 6
        });
    } catch (error) {
        console.warn("No se pudieron obtener talleres relacionados:", error);
        return [];
    }
}

function renderRelated(rows, workshop) {
    const cards = rows.filter((row) => row?.slug).slice(0, 6).map((row) => {
        const name = cleanText(row?.nombre || "Taller", 100);
        const address = [row?.direccion, row?.codigo_postal, row?.ciudad].filter(Boolean).join(", ");
        return `<a class="taller-relacionado" href="/talleres/${encodeURIComponent(row.slug)}"><strong>${escapeHTML(name)}</strong><small>${escapeHTML(address)}</small></a>`;
    }).join("");
    const title = workshop?.ciudad ? `Otros talleres en ${workshop.ciudad}` : "Otros talleres que pueden interesarte";
    const state = cards ? "" : '<p id="relacionados-estado" class="ficha-relacionados-vacio">Todavía no hay otros talleres relacionados disponibles.</p>';
    return { title, cards, state };
}

function renderPhoto(workshop, name) {
    const source = workshopPhotoSource(workshop);
    if (!source.url) return '<div id="taller-foto" class="ficha-publica-foto" hidden></div>';
    return `<div id="taller-foto" class="ficha-publica-foto"><img id="taller-foto-imagen" src="${escapeHTML(source.url)}" alt="Fotografía de ${escapeHTML(name)}" loading="lazy" decoding="async"></div>`;
}

function stripContentRuntime(html) {
    return html
        .replace(/\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, "")
        .replace(/\s*<script\s+src="\.\.\/js\/taller\.js[^\"]*"><\/script>/i, "")
        .replace(/\s*<script\s+src="\.\.\/js\/taller-urls\.js[^\"]*"><\/script>/i, "");
}

function inject(html, workshop, slug, relatedRows) {
    const canonical = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
    const title = titleFor(workshop);
    const description = descriptionFor(workshop);
    const name = cleanText(workshop?.nombre || "Ficha de taller", 100);
    const address = workshopAddress(workshop);
    const phone = safePhone(workshop?.telefono);
    const web = safeWeb(workshop?.web);
    const whatsapp = whatsappPhone(phone);
    const city = cleanText(workshop?.ciudad || "", 80);
    const province = cleanText(workshop?.provincia || "", 80);
    const updated = formatDate(workshop?.updated_at);
    const verified = Boolean(workshop?.verificado);
    const image = primaryImage(workshop);

    const actions = [];
    if (phone) actions.push(`<a class="boton accion-principal" href="tel:${escapeHTML(phone)}">☎ Llamar ahora</a>`);
    if (address) actions.push(`<a class="boton boton-claro accion-mapa" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}, España`)}" target="_blank" rel="noopener noreferrer">⌖ Cómo llegar</a>`);
    if (whatsapp) actions.push(`<a class="boton accion-whatsapp" href="https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, he encontrado vuestro taller en TallerMap y quisiera pedir información.")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`);
    if (web) actions.push(`<a class="boton boton-claro accion-web" href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Página web</a>`);

    const dataRows = [];
    if (phone) dataRows.push(`<p><strong>Teléfono:</strong> <a href="tel:${escapeHTML(phone)}">${escapeHTML(formatPhoneDisplay(phone))}</a></p>`);
    if (workshop?.direccion) dataRows.push(`<p><strong>Dirección:</strong> ${escapeHTML(workshop.direccion)}</p>`);
    if (workshop?.codigo_postal) dataRows.push(`<p><strong>Código postal:</strong> ${escapeHTML(workshop.codigo_postal)}</p>`);
    if (city) dataRows.push(`<p><strong>Municipio:</strong> ${escapeHTML(city)}</p>`);
    if (province) dataRows.push(`<p><strong>Provincia:</strong> ${escapeHTML(province)}</p>`);
    const schedule = renderSchedule(workshop?.horarios);
    if (schedule) dataRows.push(schedule);

    const crumbs = [
        '<a href="/">Inicio</a>',
        province ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(provinceURL(province))}">${escapeHTML(province)}</a>` : "",
        city ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(municipalityURL(workshop))}">${escapeHTML(city)}</a>` : "",
        `<span class="ficha-migas-separador" aria-hidden="true">›</span><span>${escapeHTML(name)}</span>`
    ].filter(Boolean).join("");

    const related = renderRelated(relatedRows, workshop);

    html = html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHTML(description)}">`)
        .replace(/<meta\s+name="robots"[^>]*>/i, '<meta name="robots" id="robots-taller" content="index,follow,max-image-preview:large">')
        .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" id="canonical-taller" href="${escapeHTML(canonical)}">`)
        .replace(/<h1\s+id="taller-nombre">[\s\S]*?<\/h1>/i, `<h1 id="taller-nombre">${escapeHTML(name)}</h1>`)
        .replace(/<p\s+id="taller-direccion"\s+class="ficha-publica-direccion">[\s\S]*?<\/p>/i, `<p id="taller-direccion" class="ficha-publica-direccion">${escapeHTML(address || "Ubicación no indicada")}</p>`)
        .replace(/<div id="taller-foto" class="ficha-publica-foto" hidden>[\s\S]*?<\/div>/i, renderPhoto(workshop, name))
        .replace(/<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">[\s\S]*?<\/nav>/i, `<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">${crumbs}</nav>`)
        .replace(/<span id="taller-verificacion" class="ficha-insignia">[\s\S]*?<\/span>/i, `<span id="taller-verificacion" class="ficha-insignia${verified ? " verificada" : ""}">${reviewStatusLabel(verified)}</span>`)
        .replace(/<span id="taller-actualizacion" class="ficha-fecha">[\s\S]*?<\/span>/i, `<span id="taller-actualizacion" class="ficha-fecha">${updated ? `Última actualización: ${escapeHTML(updated)}` : ""}</span>`)
        .replace(/<div id="taller-acciones" class="ficha-publica-acciones">[\s\S]*?<\/div>/i, `<div id="taller-acciones" class="ficha-publica-acciones">${actions.join("")}</div>`)
        .replace(/<p id="taller-descripcion">[\s\S]*?<\/p>/i, `<p id="taller-descripcion">${escapeHTML(description)}</p>`)
        .replace(/<div id="taller-servicios" class="especialidades">[\s\S]*?<\/div>/i, `<div id="taller-servicios" class="especialidades">${renderServices(workshop)}</div>`)
        .replace(/<div id="taller-datos" class="ficha-publica-datos">[\s\S]*?<\/div>/i, `<div id="taller-datos" class="ficha-publica-datos">${dataRows.join("")}</div>`)
        .replace(/<h2 id="relacionados-titulo">[\s\S]*?<\/h2>/i, `<h2 id="relacionados-titulo">${escapeHTML(related.title)}</h2>`)
        .replace(/<p id="relacionados-estado" class="ficha-cargando">[\s\S]*?<\/p>/i, related.state)
        .replace(/<div id="talleres-relacionados" class="ficha-relacionados-lista">[\s\S]*?<\/div>/i, `<div id="talleres-relacionados" class="ficha-relacionados-lista">${related.cards}</div>`)
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
            .replace(/<p id="contexto-texto">[\s\S]*?<\/p>/i, `<p id="contexto-texto">Consulta otros talleres publicados${city ? ` en ${escapeHTML(city)}` : ""}.</p>`)
            .replace(/<div id="contexto-enlaces" class="ficha-contexto-enlaces">[\s\S]*?<\/div>/i, `<div id="contexto-enlaces" class="ficha-contexto-enlaces">${localLinks}</div>`);
    }

    const social = `\n    <meta property="og:type" content="website">\n    <meta property="og:site_name" content="TallerMap">\n    <meta property="og:title" content="${escapeHTML(title)}">\n    <meta property="og:description" content="${escapeHTML(description)}">\n    <meta property="og:url" content="${escapeHTML(canonical)}">\n    <meta property="og:image" content="${escapeHTML(image)}">\n    <meta property="og:locale" content="es_ES">\n    <meta name="twitter:card" content="summary_large_image">\n    <meta name="twitter:title" content="${escapeHTML(title)}">\n    <meta name="twitter:description" content="${escapeHTML(description)}">\n    <meta name="twitter:image" content="${escapeHTML(image)}">`;
    html = html.replace(/(<link\s+rel="canonical"[^>]*>)/i, `$1${social}`);

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        "@id": `${canonical}#negocio`,
        name,
        url: canonical,
        description,
        image,
        address: postalAddress(workshop),
        telephone: phone || undefined,
        sameAs: web ? [web] : undefined,
        openingHoursSpecification: openingHoursSpecifications(workshop?.horarios),
        areaServed: city ? { "@type": "City", name: city } : undefined,
        serviceType: Array.isArray(workshop?.servicios) ? workshop.servicios.map(serviceLabel).filter(Boolean) : undefined
    };
    Object.keys(structuredData).forEach((key) => {
        if (structuredData[key] === undefined || (Array.isArray(structuredData[key]) && !structuredData[key].length)) delete structuredData[key];
    });

    const breadcrumbItems = [{ "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` }];
    let position = 2;
    if (province) breadcrumbItems.push({ "@type": "ListItem", position: position++, name: province, item: `${SITE_URL}${provinceURL(province)}` });
    if (city) breadcrumbItems.push({ "@type": "ListItem", position: position++, name: city, item: `${SITE_URL}${municipalityURL(workshop)}` });
    breadcrumbItems.push({ "@type": "ListItem", position, name, item: canonical });

    html = html.replace(
        /<script\s+type="application\/ld\+json"\s+id="datos-estructurados-taller">[\s\S]*?<\/script>/i,
        `<script type="application/ld+json" id="datos-estructurados-taller">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    );
    html = html.replace(
        /<script\s+type="application\/ld\+json"\s+id="datos-estructurados-migas">[\s\S]*?<\/script>/i,
        `<script type="application/ld+json" id="datos-estructurados-migas">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbItems }).replace(/</g, "\\u003c")}</script>`
    );

    return stripContentRuntime(html);
}

export default async function handler(request, response) {
    const rawSlug = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
    const slug = slugify(rawSlug);
    if (!slug) {
        response.status(404).send("Ficha no encontrada.");
        return;
    }

    let template;
    try {
        template = fs.readFileSync(path.join(process.cwd(), "pages", "taller.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer la plantilla de taller:", error);
        response.status(500).send("No se pudo renderizar la ficha.");
        return;
    }

    try {
        const workshop = await fetchWorkshop(slug);
        if (!workshop) {
            response.status(404).send("Ficha no encontrada.");
            return;
        }
        const related = await fetchRelated(workshop, slug);
        const html = inject(template, workshop, slug, related);
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
        response.setHeader("X-TallerMap-HTML-First", "1");
        response.setHeader("X-TallerMap-Ficha-SSR", "2");
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar la ficha HTML-first:", error);
        response.status(500).send("No se pudo renderizar la ficha.");
    }
}
