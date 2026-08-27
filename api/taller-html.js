import fs from "node:fs";
import path from "node:path";

import {
    escapeHTML,
    formatPhoneDisplay,
    safePhone,
    safeWeb,
    serviceLabel,
    slugify,
    supabaseRpc
} from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";

function cleanText(value, maxLength = 160) {
    const text = String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    return text.length > maxLength
        ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
        : text;
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return cleanText(value, 40);
    }

    return new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function titleFor(workshop) {
    const name = cleanText(workshop?.nombre || "Taller", 70);
    const city = cleanText(workshop?.ciudad || "", 45);

    return city
        ? cleanText(`${name} | Taller en ${city} | TallerMap`, 68)
        : cleanText(`${name} | TallerMap`, 68);
}

function descriptionFor(workshop) {
    const name = cleanText(workshop?.nombre || "este taller", 70);
    const city = cleanText(workshop?.ciudad || "", 45);

    return cleanText(
        `Consulta teléfono, dirección, horarios, servicios y cómo llegar a ${name}${city ? ` en ${city}` : ""}.`,
        155
    );
}

function workshopAddress(workshop) {
    return [
        workshop?.direccion,
        workshop?.codigo_postal,
        workshop?.ciudad,
        workshop?.provincia
    ]
        .filter(Boolean)
        .map((value) => cleanText(value, 120))
        .filter(
            (value, index, all) =>
                all.findIndex(
                    (other) => other.toLocaleLowerCase("es") === value.toLocaleLowerCase("es")
                ) === index
        )
        .join(", ");
}

function provinceURL(province) {
    const primaryName = String(province || "").split("/")[0].trim();
    const slug = slugify(primaryName);
    return slug ? `/provincias/${slug}.html` : "/provincias/";
}

function municipalityName(workshop) {
    return String(workshop?.municipio || workshop?.ciudad || "").trim();
}

function municipalityURL(workshop) {
    const city = municipalityName(workshop);
    const code = String(workshop?.codigo_municipal || "")
        .replace(/\D/g, "")
        .slice(0, 5);

    if (city && code) {
        return `/municipios/${slugify(city)}-${code}.html`;
    }

    return city
        ? `/?poblacion=${encodeURIComponent(city)}#talleres`
        : "/#talleres";
}

function whatsappPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");

    if (/^[67]\d{8}$/.test(digits)) return `34${digits}`;
    if (/^34[67]\d{8}$/.test(digits)) return digits;

    return "";
}

function scheduleRows(schedule) {
    if (!schedule || typeof schedule !== "object") return "";

    const days = [
        ["lunes", "Lunes"],
        ["martes", "Martes"],
        ["miercoles", "Miércoles"],
        ["jueves", "Jueves"],
        ["viernes", "Viernes"],
        ["sabado", "Sábado"],
        ["domingo", "Domingo"]
    ];

    return days
        .map(([key, label]) => {
            const value = schedule[key];

            if (!value || typeof value !== "object") return "";

            const text = value.cerrado === true
                ? "Cerrado"
                : (Array.isArray(value.turnos) ? value.turnos : [])
                    .map((slot) => {
                        const opening = String(slot?.apertura || "").trim();
                        const closing = String(slot?.cierre || "").trim();
                        return opening && closing ? `${opening}–${closing}` : "";
                    })
                    .filter(Boolean)
                    .join(" y ");

            return text
                ? `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(text)}</dd></div>`
                : "";
        })
        .filter(Boolean)
        .join("");
}

function renderGreenCover(workshop) {
    const rows = scheduleRows(workshop?.horarios);

    return `
        <div id="taller-foto" class="ficha-publica-foto ficha-publica-portada-verde">
            <div class="tm-auto-portada tm-auto-portada-grande tm-auto-portada-horario" role="group" aria-label="Horario de atención">
                <div class="tm-portada-identidad" aria-hidden="true">
                    <img src="/favicon.svg" alt="" width="58" height="58">
                    <strong>TallerMap</strong>
                    <span>Conectamos conductores<br>con talleres de confianza</span>
                </div>

                <div class="tm-portada-horario-contenido">
                    <h2><span aria-hidden="true">◷</span> Horario de atención</h2>
                    ${rows
                        ? `<dl class="taller-horario-visible">${rows}</dl>`
                        : `<p class="taller-horario-no-disponible">Horario no disponible</p>`}
                </div>
            </div>
        </div>
    `;
}

function renderServices(workshop) {
    const services = Array.isArray(workshop?.servicios)
        ? workshop.servicios.map(serviceLabel).filter(Boolean).slice(0, 24)
        : [];

    const items = (services.length ? services : ["Taller mecánico"])
        .map((service) => `<span>${escapeHTML(service)}</span>`)
        .join("");

    return `
        <section class="ficha-servicios-ofrecidos" aria-labelledby="servicios-ofrecidos-titulo">
            <h2 id="servicios-ofrecidos-titulo">Servicios que se ofrecen</h2>
            <p>Servicios confirmados en esta ficha</p>
            <div id="taller-servicios" class="especialidades especialidades-destacadas">
                ${items}
            </div>
        </section>
    `;
}

function renderDataRows(workshop, phone) {
    const rows = [];

    if (phone) {
        rows.push(`<p><strong>Teléfono:</strong> <a href="tel:${escapeHTML(phone)}">${escapeHTML(formatPhoneDisplay(phone))}</a></p>`);
    }

    if (workshop?.direccion) {
        rows.push(`<p><strong>Dirección:</strong> ${escapeHTML(workshop.direccion)}</p>`);
    }

    if (workshop?.codigo_postal) {
        rows.push(`<p><strong>Código postal:</strong> ${escapeHTML(workshop.codigo_postal)}</p>`);
    }

    if (workshop?.ciudad) {
        rows.push(`<p><strong>Municipio:</strong> ${escapeHTML(workshop.ciudad)}</p>`);
    }

    if (workshop?.provincia) {
        rows.push(`<p><strong>Provincia:</strong> ${escapeHTML(workshop.provincia)}</p>`);
    }

    return rows.join("");
}

function mapsURL(name, address) {
    const query = [name, address, "España"].filter(Boolean).join(", ");

    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : "";
}

function renderActions(workshop, name, address, phone) {
    const actions = [];
    const web = safeWeb(workshop?.web);
    const whatsapp = whatsappPhone(phone);
    const map = mapsURL(name, address);

    if (phone) {
        actions.push(`<a class="boton accion-principal" href="tel:${escapeHTML(phone)}">☎ Llamar ahora</a>`);
    }

    if (map) {
        actions.push(`<a class="boton boton-claro accion-mapa" href="${escapeHTML(map)}" target="_blank" rel="noopener noreferrer">⌖ Cómo llegar</a>`);
    }

    if (whatsapp) {
        actions.push(`
            <a class="boton accion-whatsapp" href="https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, he encontrado vuestro taller en TallerMap y quisiera pedir información.")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        `);
    }

    if (web) {
        actions.push(`<a class="boton boton-claro accion-web" href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Página web</a>`);
    }

    return actions.join("");
}

async function fetchWorkshop(slug) {
    const rows = await supabaseRpc("obtener_taller_publico", {
        p_id: null,
        p_slug: slug
    });

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
            ciudad: workshop.ciudad || context.municipio || "",
            municipio: context.municipio || workshop.ciudad || "",
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
    const cards = rows
        .filter((row) => row?.slug)
        .slice(0, 6)
        .map((row) => {
            const name = cleanText(row?.nombre || "Taller", 100);
            const address = [row?.direccion, row?.codigo_postal, row?.ciudad]
                .filter(Boolean)
                .join(", ");

            return `
                <a class="taller-relacionado" href="/talleres/${encodeURIComponent(slugify(row.slug))}">
                    <strong>${escapeHTML(name)}</strong>
                    <small>${escapeHTML(address)}</small>
                </a>
            `;
        })
        .join("");

    return {
        title: workshop?.ciudad
            ? `Otros talleres en ${workshop.ciudad}`
            : "Otros talleres que pueden interesarte",
        cards,
        state: cards
            ? ""
            : `<p id="relacionados-estado" class="ficha-relacionados-vacio">Todavía no hay otros talleres relacionados disponibles.</p>`
    };
}

function structuredData(workshop, canonical, name, description, address, phone) {
    const openingHoursSpecification = [];
    const schedule = workshop?.horarios;

    if (schedule && typeof schedule === "object") {
        const dayNames = {
            lunes: "Monday",
            martes: "Tuesday",
            miercoles: "Wednesday",
            jueves: "Thursday",
            viernes: "Friday",
            sabado: "Saturday",
            domingo: "Sunday"
        };

        for (const [key, dayOfWeek] of Object.entries(dayNames)) {
            const value = schedule[key];

            if (!value || value.cerrado) continue;

            for (const slot of Array.isArray(value.turnos) ? value.turnos : []) {
                const opens = String(slot?.apertura || "").trim();
                const closes = String(slot?.cierre || "").trim();

                if (/^\d{2}:\d{2}$/.test(opens) && /^\d{2}:\d{2}$/.test(closes)) {
                    openingHoursSpecification.push({
                        "@type": "OpeningHoursSpecification",
                        dayOfWeek,
                        opens,
                        closes
                    });
                }
            }
        }
    }

    const services = Array.isArray(workshop?.servicios)
        ? workshop.servicios.map(serviceLabel).filter(Boolean)
        : [];

    const data = {
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        "@id": `${canonical}#negocio`,
        name,
        url: canonical,
        description,
        telephone: phone || undefined,
        address: address
            ? {
                "@type": "PostalAddress",
                streetAddress: workshop?.direccion || undefined,
                postalCode: workshop?.codigo_postal || undefined,
                addressLocality: workshop?.ciudad || undefined,
                addressRegion: workshop?.provincia || undefined,
                addressCountry: "ES"
            }
            : undefined,
        openingHoursSpecification: openingHoursSpecification.length
            ? openingHoursSpecification
            : undefined,
        serviceType: services.length ? services : undefined
    };

    Object.keys(data).forEach((key) => {
        if (data[key] === undefined) delete data[key];
    });

    return data;
}

function breadcrumbData(workshop, canonical, name) {
    const municipality = municipalityName(workshop);
    const items = [{
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: `${SITE_URL}/`
    }];

    let position = 2;

    if (workshop?.provincia) {
        items.push({
            "@type": "ListItem",
            position: position++,
            name: workshop.provincia,
            item: `${SITE_URL}${provinceURL(workshop.provincia)}`
        });
    }

    if (municipality) {
        items.push({
            "@type": "ListItem",
            position: position++,
            name: municipality,
            item: `${SITE_URL}${municipalityURL(workshop)}`
        });
    }

    items.push({
        "@type": "ListItem",
        position,
        name,
        item: canonical
    });

    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items
    };
}

function stripConflictingRuntime(html) {
    return html
        .replace(/\s*<script[^>]+src="[^"]*taller\.js[^"]*"[^>]*><\/script>/gi, "")
        .replace(/\s*<script[^>]+src="[^"]*taller-urls\.js[^"]*"[^>]*><\/script>/gi, "")
        .replace(/\s*<script[^>]+src="[^"]*imagenes-automaticas\.js[^"]*"[^>]*><\/script>/gi, "")
        .replace(/\s*<script[^>]+src="https:\/\/unpkg\.com\/@supabase\/supabase-js@[^"]+"[^>]*><\/script>/gi, "");
}

function inject(template, workshop, canonicalSlug, relatedRows) {
    const canonical = `${SITE_URL}/talleres/${encodeURIComponent(canonicalSlug)}`;
    const title = titleFor(workshop);
    const description = descriptionFor(workshop);
    const name = cleanText(workshop?.nombre || "Ficha de taller", 100);
    const address = workshopAddress(workshop);
    const phone = safePhone(workshop?.telefono);
    const updated = formatDate(workshop?.updated_at);
    const related = renderRelated(relatedRows, workshop);
    const municipality = municipalityName(workshop);

    const crumbs = [
        `<a href="/">Inicio</a>`,
        workshop?.provincia
            ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(provinceURL(workshop.provincia))}">${escapeHTML(workshop.provincia)}</a>`
            : "",
        municipality
            ? `<span class="ficha-migas-separador" aria-hidden="true">›</span><a href="${escapeHTML(municipalityURL(workshop))}">${escapeHTML(municipality)}</a>`
            : "",
        `<span class="ficha-migas-separador" aria-hidden="true">›</span><span>${escapeHTML(name)}</span>`
    ].filter(Boolean).join("");

    let html = template
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHTML(description)}">`)
        .replace(/<meta\s+name="robots"[^>]*>/i, `<meta name="robots" id="robots-taller" content="index,follow,max-image-preview:large">`)
        .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" id="canonical-taller" href="${escapeHTML(canonical)}">`)
        .replace(/<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">[\s\S]*?<\/nav>/i, `<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan">${crumbs}</nav>`)
        .replace(/<h1\s+id="taller-nombre">[\s\S]*?<\/h1>/i, `<h1 id="taller-nombre">${escapeHTML(name)}</h1>`)
        .replace(/<p\s+id="taller-direccion"\s+class="ficha-publica-direccion">[\s\S]*?<\/p>/i, `<p id="taller-direccion" class="ficha-publica-direccion">${escapeHTML(address || "Ubicación no indicada")}</p>`)
        .replace(/<div id="taller-foto" class="ficha-publica-foto" hidden><\/div>/i, renderGreenCover(workshop))
        .replace(/<span id="taller-actualizacion" class="ficha-fecha">[\s\S]*?<\/span>/i, `<span id="taller-actualizacion" class="ficha-fecha">${updated ? `Última actualización: ${escapeHTML(updated)}` : ""}</span>`)
        .replace(/<div id="taller-acciones" class="ficha-publica-acciones"><\/div>/i, `<div id="taller-acciones" class="ficha-publica-acciones ficha-publica-acciones-alicante">${renderActions(workshop, name, address, phone)}</div>`)
        .replace(/<p id="taller-descripcion"><\/p>/i, "")
        .replace(/<div id="taller-servicios" class="especialidades"><\/div>/i, renderServices(workshop))
        .replace(/<div id="taller-datos" class="ficha-publica-datos"><\/div>/i, `<div id="taller-datos" class="ficha-publica-datos ficha-publica-datos-alicante">${renderDataRows(workshop, phone)}</div>`)
        .replace(/<section id="contexto-local" class="ficha-contexto" hidden>/i, `<section id="contexto-local" class="ficha-contexto">`)
        .replace(/<h2 id="contexto-titulo">[\s\S]*?<\/h2>/i, `<h2 id="contexto-titulo">${escapeHTML(municipality ? `Talleres en ${municipality}` : "Talleres de la zona")}</h2>`)
        .replace(/<p id="contexto-texto"><\/p>/i, `<p id="contexto-texto">Consulta otros talleres publicados${municipality ? ` en ${escapeHTML(municipality)}` : ""}.</p>`)
        .replace(/<div id="contexto-enlaces" class="ficha-contexto-enlaces"><\/div>/i, `<div id="contexto-enlaces" class="ficha-contexto-enlaces">${municipality ? `<a class="boton" href="${escapeHTML(municipalityURL(workshop))}">Ver talleres en ${escapeHTML(municipality)}</a>` : ""}${workshop?.provincia ? `<a class="boton boton-claro" href="${escapeHTML(provinceURL(workshop.provincia))}">Ver talleres en ${escapeHTML(workshop.provincia)}</a>` : ""}</div>`)
        .replace(/<h2 id="relacionados-titulo">[\s\S]*?<\/h2>/i, `<h2 id="relacionados-titulo">${escapeHTML(related.title)}</h2>`)
        .replace(/<p id="relacionados-estado" class="ficha-cargando">[\s\S]*?<\/p>/i, related.state)
        .replace(/<div id="talleres-relacionados" class="ficha-relacionados-lista"><\/div>/i, `<div id="talleres-relacionados" class="ficha-relacionados-lista">${related.cards}</div>`)
        .replace(/\.\.\/index\.html#talleres/g, "/#talleres")
        .replace(/\.\.\/index\.html/g, "/")
        .replace(/\.\.\/favicon/g, "/favicon")
        .replace(/\.\.\/css\//g, "/css/")
        .replace(/\.\.\/js\//g, "/js/")
        .replace(/\.\.\/pages\//g, "/pages/");

    const businessData = structuredData(workshop, canonical, name, description, address, phone);
    const breadcrumbs = breadcrumbData(workshop, canonical, name);

    html = html
        .replace(/<script\s+type="application\/ld\+json"\s+id="datos-estructurados-taller">[\s\S]*?<\/script>/i, `<script type="application/ld+json" id="datos-estructurados-taller">${JSON.stringify(businessData).replace(/</g, "\\u003c")}</script>`)
        .replace(/<script\s+type="application\/ld\+json"\s+id="datos-estructurados-migas">[\s\S]*?<\/script>/i, `<script type="application/ld+json" id="datos-estructurados-migas">${JSON.stringify(breadcrumbs).replace(/</g, "\\u003c")}</script>`);

    return stripConflictingRuntime(html);
}

export default async function handler(request, response) {
    const rawSlug = Array.isArray(request.query?.slug)
        ? request.query.slug[0]
        : request.query?.slug;

    const requestedSlug = slugify(rawSlug);

    if (!requestedSlug) {
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
        const workshop = await fetchWorkshop(requestedSlug);

        if (!workshop) {
            response.status(404).send("Ficha no encontrada.");
            return;
        }

        const canonicalSlug = slugify(workshop?.slug || requestedSlug) || requestedSlug;

        if (canonicalSlug !== requestedSlug) {
            response.setHeader("Location", `/talleres/${encodeURIComponent(canonicalSlug)}`);
            response.status(308).send("Redirigiendo a la ficha canónica.");
            return;
        }

        const related = await fetchRelated(workshop, canonicalSlug);
        const html = inject(template, workshop, canonicalSlug, related);

        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Ficha-Renderer", "unico-verde-v1");
        response.setHeader("X-TallerMap-Canonical-Slug", canonicalSlug);
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar la ficha pública:", error);
        response.status(500).send("No se pudo renderizar la ficha.");
    }
}
