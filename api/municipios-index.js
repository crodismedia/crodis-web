import fs from "node:fs";
import path from "node:path";

import { escapeHTML, slugify, supabaseRpc } from "../lib/server-utils.js";

const DIRECTORY_STRUCTURED_DATA = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Talleres mecánicos por municipio",
    url: "https://www.tallermap.es/municipios/",
    isPartOf: {
        "@type": "WebSite",
        name: "TallerMap",
        url: "https://www.tallermap.es/"
    },
    breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Inicio",
                item: "https://www.tallermap.es/"
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Municipios",
                item: "https://www.tallermap.es/municipios/"
            }
        ]
    }
}).replace(/</g, "\\u003c");

function renderMunicipalityList(items) {
    const unique = Array.from(
        new Map(
            items
                .filter((item) => /^\d{5}$/.test(String(item?.codigo_municipal || "")))
                .filter((item) => String(item?.municipio || "").trim())
                .map((item) => [String(item.codigo_municipal), item])
        ).values()
    );

    const rows = unique.map((item) => {
        const code = String(item.codigo_municipal);
        const name = String(item.municipio).trim();
        const fileName = `${slugify(name)}-${code}.html`;

        return `                    <li data-nombre="${escapeHTML(name.toLocaleLowerCase("es"))}"><a href="${escapeHTML(fileName)}"><strong>${escapeHTML(name)}</strong><span>${code}</span></a></li>`;
    }).join("\n");

    return { rows, total: unique.length };
}

function injectList(template, rows) {
    const list = /<ul class="lista-municipios" id="lista-municipios">[\s\S]*?<\/ul>/i;

    if (!list.test(template)) {
        throw new Error("No se encontró la lista municipal en la plantilla.");
    }

    return template
        .replace(
            list,
            `<ul class="lista-municipios" id="lista-municipios">\n${rows}\n                </ul>`
        )
        .replace(
            /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
            `<script type="application/ld+json">${DIRECTORY_STRUCTURED_DATA}</script>`
        )
        .replace('href="../index.html"', 'href="/"')
        .replace('href="../pages/registro.html"', 'href="/pages/registro.html"');
}

export default async function handler(_request, response) {
    let template;

    try {
        template = fs.readFileSync(
            path.join(process.cwd(), "municipios", "index.html"),
            "utf8"
        );
    } catch (error) {
        console.error("No se pudo leer el directorio municipal:", error);
        response.status(500).send("No se pudo cargar el directorio municipal.");
        return;
    }

    try {
        const municipalities = await supabaseRpc("listar_municipios_sitemap", {});
        const { rows, total } = renderMunicipalityList(municipalities);

        if (!total) {
            throw new Error("Supabase no devolvió municipios con talleres.");
        }

        const html = injectList(template, rows);

        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
        response.setHeader("X-TallerMap-Municipios", String(total));
        response.status(200).send(html);
    } catch (error) {
        console.error("No se pudo construir el directorio municipal:", error);
        response.setHeader("Retry-After", "60");
        response.status(503).send("No se pudo cargar el directorio municipal en este momento.");
    }
}
