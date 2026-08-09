import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const SITE_URL = "https://www.tallermap.es";
const DEFAULT_IMAGE = `${SITE_URL}/images/cartel-tallermap.png`;

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

function cleanText(value, maxLength = 160) {
    const text = String(value || "")
        .replace(/\s+/g, " ")
        .trim();
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

async function fetchWorkshop(slug) {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/obtener_taller_publico`;
    const result = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_id: null, p_slug: slug })
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const rows = await result.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function injectSEO(html, workshop, slug) {
    const canonical = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
    const title = titleFor(workshop);
    const description = descriptionFor(workshop);
    const name = cleanText(workshop?.nombre || "Ficha de taller", 100);
    const address = [workshop?.direccion, workshop?.codigo_postal, workshop?.ciudad, workshop?.provincia]
        .filter(Boolean)
        .map((value) => cleanText(value, 80))
        .join(", ");

    html = html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHTML(description)}">`)
        .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" id="canonical-taller" href="${escapeHTML(canonical)}">`)
        .replace(/<h1\s+id="taller-nombre">[\s\S]*?<\/h1>/i, `<h1 id="taller-nombre">${escapeHTML(name)}</h1>`)
        .replace(/<p\s+id="taller-direccion"\s+class="ficha-publica-direccion">[\s\S]*?<\/p>/i, `<p id="taller-direccion" class="ficha-publica-direccion">${escapeHTML(address)}</p>`)
        .replace(/\.\.\/index\.html#talleres/g, "/#talleres")
        .replace(/\.\.\/index\.html/g, "/");

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
        telephone: workshop?.telefono || undefined
    };
    Object.keys(structuredData).forEach((key) => structuredData[key] === undefined && delete structuredData[key]);

    html = html.replace(
        /<script\s+type="application\/ld\+json"\s+id="datos-estructurados-taller">[\s\S]*?<\/script>/i,
        `<script type="application/ld+json" id="datos-estructurados-taller">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`
    );

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
    const slug = safeSlug(rawSlug);
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
        html = injectSEO(html, workshop, slug);
        response.setHeader("X-TallerMap-SEO-SSR", "1");
    } catch (error) {
        console.error("No se pudo preparar SEO SSR de la ficha:", error);
        response.setHeader("X-TallerMap-SEO-SSR", "0");
    }

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    response.status(200).send(html);
}
