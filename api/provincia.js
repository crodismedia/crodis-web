import fs from "node:fs";
import path from "node:path";
import { escapeHTML, slugify, supabaseRpc } from "../lib/server-utils.js";

const PROVINCIAS = {
    alicante: "Alicante",
    castellon: "Castellón",
    valencia: "Valencia"
};

function renderMunicipios(rows) {
    const municipios = rows
        .filter((row) => Number(row.total_talleres) > 0 && row.municipio && row.codigo_municipal)
        .sort((a, b) => String(a.municipio).localeCompare(String(b.municipio), "es", { sensitivity: "base" }));

    if (!municipios.length) {
        return '<li class="mensaje-talleres">No hay municipios con talleres publicados.</li>';
    }

    return municipios.map((row) => {
        const total = Number(row.total_talleres) || 0;
        const archivo = `${slugify(row.municipio)}-${String(row.codigo_municipal).replace(/\D/g, "").slice(0, 5)}.html`;
        return `<li><a href="../municipios/${escapeHTML(archivo)}"><strong>${escapeHTML(row.municipio)}</strong><span>${total} ${total === 1 ? "taller" : "talleres"}</span></a></li>`;
    }).join("");
}

function replaceElementInnerHTML(html, id, innerHTML) {
    const openPattern = new RegExp(`<([a-z0-9]+)\\b([^>]*\\bid=["']${id}["'][^>]*)>`, "i");
    const match = openPattern.exec(html);
    if (!match) throw new Error(`No se encontró #${id} en la plantilla provincial`);

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

    throw new Error(`No se pudo cerrar #${id} en la plantilla provincial`);
}

function stripLegacyWorkshopSection(html) {
    return html
        .replace(/<section class="seccion seccion-gris">[\s\S]*?id="lista-talleres-provincia"[\s\S]*?<\/section>/i, "")
        .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"><\/script>/i, "")
        .replace(/\s*<script src="\.\.\/js\/provincia\.js"><\/script>/i, "");
}

function noindexOnFailure(html) {
    return html.replace(
        /<meta name="robots" content="[^"]*">/i,
        '<meta name="robots" content="noindex,follow,max-image-preview:large">'
    );
}

export default async function handler(request, response) {
    const slug = String(request.query?.provincia || "")
        .toLowerCase()
        .replace(/\.html$/, "")
        .trim();
    const provincia = PROVINCIAS[slug];

    if (!provincia) {
        response.status(404).send("Provincia no encontrada");
        return;
    }

    let html;
    try {
        const internalTemplate = path.join(process.cwd(), "templates", "provincias", `${slug}.html`);
        const publicTemplate = path.join(process.cwd(), "provincias", `${slug}.html`);
        html = fs.readFileSync(fs.existsSync(internalTemplate) ? internalTemplate : publicTemplate, "utf8");
    } catch (error) {
        console.error(error);
        response.status(500).send("No se pudo renderizar la provincia");
        return;
    }

    try {
        const municipios = await supabaseRpc("listar_municipios_publicos", { p_provincia: provincia });
        const municipiosHTML = renderMunicipios(municipios);
        const totalMunicipios = municipios.filter((row) => Number(row.total_talleres) > 0).length;
        const totalTalleres = municipios.reduce((sum, row) => sum + (Number(row.total_talleres) || 0), 0);

        html = replaceElementInnerHTML(html, "lista-municipios-provincia", municipiosHTML);
        html = stripLegacyWorkshopSection(html);
        html = html.replace(
            /(<div class="titulo-seccion">[\s\S]*?<h1>[^<]+<\/h1>)([\s\S]*?<p>)([\s\S]*?)(<\/p>)/i,
            (_match, head, pOpen, _oldText, pClose) => `${head}${pOpen}Consulta ${totalMunicipios} municipios con ${totalTalleres} talleres publicados en la provincia de ${escapeHTML(provincia)}. Selecciona un municipio para ver sus talleres.${pClose}`
        );

        response.setHeader("X-TallerMap-Province-SSR", "municipios-only-v1");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        response.status(200).send(html);
    } catch (error) {
        console.error("SSR provincia falló:", error);
        html = stripLegacyWorkshopSection(noindexOnFailure(html));
        response.setHeader("X-TallerMap-Province-SSR", "0");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Retry-After", "60");
        response.status(503).send(html);
    }
}
