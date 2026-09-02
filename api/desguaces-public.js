import fs from "node:fs";
import path from "node:path";
import {
    SUPABASE_URL,
    SUPABASE_KEY,
    escapeHTML,
    formatPhoneDisplay,
    safePhone,
    safeWeb
} from "../lib/server-utils.js";

const MAX_DESGUACES = 5000;

function clean(value, max = 500) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max) : text;
}

function safeSlug(value) {
    const slug = String(value || "").trim().toLowerCase();
    return /^[a-z0-9-]+$/.test(slug) ? slug : "";
}

function provinceKey(value) {
    const normalized = String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (normalized.includes("alicante") || normalized.includes("alacant")) return "alicante";
    if (normalized.includes("castell")) return "castellon";
    if (normalized.includes("valencia")) return "valencia";
    return "";
}

async function fetchDesguaces() {
    const url = new URL(`${SUPABASE_URL}/rest/v1/desguaces`);
    url.searchParams.set(
        "select",
        "id,nombre,slug,direccion,codigo_postal,municipio,provincia,telefono,web,google_maps_url,servicios,descripcion"
    );
    url.searchParams.set("activo", "eq.true");
    url.searchParams.set("verificado", "eq.true");
    url.searchParams.set("order", "municipio.asc,nombre.asc");
    url.searchParams.set("limit", String(MAX_DESGUACES));

    const result = await fetch(url, {
        headers: { apikey: SUPABASE_KEY }
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const rows = await result.json();
    return Array.isArray(rows) ? rows : [];
}

function mapsURL(row, name, address) {
    const published = safeWeb(row?.google_maps_url);
    if (published) return published;

    const query = [name, address, row?.provincia, "España"]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(", ");

    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : "";
}

function renderCard(row) {
    const name = clean(row?.nombre || "Desguace", 120);
    const municipality = clean(row?.municipio, 80);
    const address = [row?.direccion, row?.codigo_postal, row?.municipio]
        .filter(Boolean)
        .map((value) => clean(value, 120))
        .join(", ");
    const description = clean(row?.descripcion, 320);
    const services = Array.isArray(row?.servicios)
        ? row.servicios.filter(Boolean).slice(0, 5).map((value) => clean(value, 80))
        : [];
    const slug = safeSlug(row?.slug);
    const fichaURL = slug ? `/desguace/${encodeURIComponent(slug)}` : "";
    const phone = safePhone(row?.telefono);
    const phoneDisplay = formatPhoneDisplay(row?.telefono);
    const web = safeWeb(row?.web);
    const maps = mapsURL(row, name, address);
    const accessURL = row?.id
        ? `/api/desguaces-solicitar-acceso?id=${encodeURIComponent(String(row.id))}`
        : "";

    const nameHTML = fichaURL
        ? `<a href="${escapeHTML(fichaURL)}" style="color:inherit;text-decoration:none">${escapeHTML(name)}</a>`
        : escapeHTML(name);

    const actions = [];
    if (fichaURL) actions.push(`<a href="${escapeHTML(fichaURL)}">Ver ficha</a>`);
    if (phone) actions.push(`<a href="tel:${escapeHTML(phone)}">Llamar · ${escapeHTML(phoneDisplay || "Llamar")}</a>`);
    if (maps) actions.push(`<a href="${escapeHTML(maps)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`);
    if (web) actions.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
    actions.push('<a href="/acceso-desguaces.html" rel="nofollow">Acceso profesional</a>');
    if (accessURL) actions.push(`<a href="${escapeHTML(accessURL)}" rel="nofollow">Solicitar acceso</a>`);

    return `<article class="desguace-card" data-desguace-slug="${escapeHTML(slug)}">
      <div class="desguace-card-cabecera">
        <div>
          <p class="desguace-localidad">${escapeHTML(municipality)}</p>
          <h3>${nameHTML}</h3>
        </div>
        <span class="desguace-verificado">Verificado</span>
      </div>
      ${address ? `<p class="desguace-direccion">${escapeHTML(address)}</p>` : ""}
      ${description ? `<p class="desguace-descripcion">${escapeHTML(description)}</p>` : ""}
      ${services.length ? `<div class="desguace-servicios">${services.map((service) => `<span>${escapeHTML(service)}</span>`).join("")}</div>` : ""}
      <div class="desguace-acciones">${actions.join("")}</div>
    </article>`;
}

function replaceElementInnerHTML(html, id, innerHTML) {
    const openPattern = new RegExp(`<([a-z0-9]+)\\b([^>]*\\bid=["']${id}["'][^>]*)>`, "i");
    const match = openPattern.exec(html);
    if (!match) throw new Error(`No se encontró #${id} en desguaces.html`);

    const tag = match[1].toLowerCase();
    const contentStart = match.index + match[0].length;
    const tokenPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    tokenPattern.lastIndex = contentStart;

    let depth = 1;
    let token;
    while ((token = tokenPattern.exec(html))) {
        depth += /^<\//.test(token[0]) ? -1 : 1;
        if (depth === 0) {
            return html.slice(0, contentStart) + innerHTML + html.slice(token.index);
        }
    }

    throw new Error(`No se pudo cerrar #${id} en desguaces.html`);
}

function stripClientDirectoryRuntime(html) {
    return html
        .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, "")
        .replace(/\s*<script src="js\/supabase\.js[^\"]*"><\/script>/i, "");
}

function injectPerformanceHints(html) {
    const style = `<style data-tm-desguaces-rendimiento="1">
.desguace-card{content-visibility:auto;contain-intrinsic-size:1px 340px}
#castellon,#valencia{content-visibility:auto;contain-intrinsic-size:1px 1200px}
</style>`;
    return html.includes('data-tm-desguaces-rendimiento="1"')
        ? html
        : html.replace("</head>", `${style}\n</head>`);
}

function noindexOnFailure(html) {
    return String(html || "").replace(
        /<meta name="robots" content="[^"]*">/i,
        '<meta name="robots" content="noindex,follow,max-image-preview:large">'
    );
}

function renderDirectory(template, rows) {
    const groups = { alicante: [], castellon: [], valencia: [] };

    for (const row of rows) {
        const key = provinceKey(row?.provincia);
        if (key && groups[key]) groups[key].push(row);
    }

    let html = template;
    for (const key of Object.keys(groups)) {
        const cards = groups[key].length
            ? groups[key].map(renderCard).join("")
            : '<p class="desguaces-estado">Todavía no hay desguaces verificados publicados en esta provincia.</p>';
        html = replaceElementInnerHTML(html, `lista-desguaces-${key}`, cards);
    }

    html = html.replace(
        /(<p id="contador-desguaces-publicados"[^>]*>)[\s\S]*?(<\/p>)/i,
        (_match, open, close) => `${open}${rows.length} ${rows.length === 1 ? "desguace publicado" : "desguaces publicados"}${close}`
    );

    return injectPerformanceHints(stripClientDirectoryRuntime(html));
}

export default async function handler(request, response) {
    const legacyProvince = provinceKey(request.query?.provincia);
    if (legacyProvince) {
        response.setHeader("Cache-Control", "no-store");
        response.redirect(301, `/desguaces.html#${legacyProvince}`);
        return;
    }

    let template;
    try {
        template = fs.readFileSync(path.join(process.cwd(), "desguaces.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer desguaces.html:", error);
        response.status(500).send("No se pudo cargar el directorio de desguaces.");
        return;
    }

    try {
        const rows = await fetchDesguaces();
        const validRows = rows.filter((row) => safeSlug(row?.slug) && provinceKey(row?.provincia));
        const html = renderDirectory(template, validRows);

        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Desguaces-SSR", "1");
        response.setHeader("X-TallerMap-Desguaces", String(validRows.length));
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo renderizar el directorio de desguaces:", error);
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Retry-After", "60");
        response.setHeader("X-Robots-Tag", "noindex, follow");
        response.status(503).send(noindexOnFailure(template));
    }
}
