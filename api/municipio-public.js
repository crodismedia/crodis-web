import fs from "node:fs";
import path from "node:path";
import municipioHandler from "./municipio.js";

const RENDER_DIFERIDO = '<style id="tm-municipio-render">.taller-card{content-visibility:auto;contain-intrinsic-size:auto 520px}</style>';
const PAGINACION_DIRECTA_STYLE = '<style id="tm-municipio-paginacion-directa">.tm-paginacion-directa{display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px}.tm-paginacion-directa a,.tm-paginacion-directa strong{display:inline-flex;min-width:34px;min-height:34px;align-items:center;justify-content:center;padding:4px 8px;border-radius:8px;text-decoration:none}.tm-paginacion-directa strong{background:#17223b;color:#fff}@media(max-width:640px){.municipio-paginacion{flex-wrap:wrap}.tm-paginacion-directa{width:100%;order:3}}</style>';

function archivoMunicipioValido(fileName) {
    if (!/^[a-z0-9-]+\.html$/i.test(fileName)) return false;

    try {
        return fs.existsSync(path.join(process.cwd(), "municipios", fileName));
    } catch {
        return false;
    }
}

function paginaSolicitada(request) {
    const value = Array.isArray(request.query?.pagina)
        ? request.query.pagina[0]
        : request.query?.pagina;

    return value === undefined ? null : String(value).trim();
}

function optimizarRender(output) {
    if (typeof output !== "string") return output;

    let result = output;

    if (!result.includes('id="tm-municipio-render"')) {
        result = result.replace(/<\/head>/i, `${RENDER_DIFERIDO}\n</head>`);
    }

    if (result.includes('class="tm-paginacion-directa"') && !result.includes('id="tm-municipio-paginacion-directa"')) {
        result = result.replace(/<\/head>/i, `${PAGINACION_DIRECTA_STYLE}\n</head>`);
    }

    return result;
}

function limpiarContenidoPublico(output) {
    if (typeof output !== "string") return output;

    return output
        .replace(/(<p class="ubicacion">)\s*⌖\s*/gi, "$1")
        .replace(/(class="[^"]*tm-card-btn-profile[^"]*"[^>]*>)\s*▤\s*/gi, "$1")
        .replace(/(class="[^"]*tm-card-btn-map[^"]*"[^>]*>)\s*⌖\s*/gi, "$1")
        .replace(/\s*<p class="taller-descripcion">\s*Consulta la ficha del taller para conocer sus servicios y datos de contacto\.?\s*<\/p>/gi, "")
        .replace(/\s*<span[^>]*>\s*Última actualización:\s*[^<]*<\/span>/gi, "");
}

function mejorarPaginacionRastreo(output, fileName, service) {
    if (typeof output !== "string" || service || output.includes('class="tm-paginacion-directa"')) {
        return output;
    }

    const match = output.match(/<span>\s*Página\s+(\d+)\s+de\s+(\d+)\s*<\/span>/i);
    if (!match) return output;

    const currentPage = Number(match[1]);
    const totalPages = Number(match[2]);

    if (!Number.isInteger(currentPage) || !Number.isInteger(totalPages) || totalPages <= 1 || totalPages > 50) {
        return output;
    }

    const directLinks = Array.from({ length: totalPages }, (_unused, index) => index + 1)
        .map((page) => {
            if (page === currentPage) {
                return `<strong aria-current="page">${page}</strong>`;
            }

            const href = page === 1
                ? `/municipios/${fileName}`
                : `/municipios/${fileName}?pagina=${page}`;

            return `<a href="${href}" aria-label="Ir a la página ${page}">${page}</a>`;
        })
        .join("");

    return output.replace(
        match[0],
        `${match[0]}<span class="tm-paginacion-directa" aria-label="Páginas del municipio">${directLinks}</span>`
    );
}

export default async function handler(request, response) {
    const fileName = String(request.query?.archivo || "").trim().toLowerCase();

    if (!archivoMunicipalValido(fileName)) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Robots-Tag", "noindex, nofollow");
        response.status(404).send("Municipio no encontrado.");
        return;
    }

    const service = String(request.query?.servicio || "").trim();
    const rawPage = paginaSolicitada(request);

    if (rawPage !== null && !service) {
        const page = Number(rawPage);
        const base = `/municipios/${fileName}`;

        if (!Number.isInteger(page) || page <= 1) {
            response.setHeader("Cache-Control", "no-store");
            response.redirect(301, base);
            return;
        }

        if (rawPage !== String(page)) {
            response.setHeader("Cache-Control", "no-store");
            response.redirect(301, `${base}?pagina=${page}`);
            return;
        }
    }

    const originalSend = response.send.bind(response);

    response.send = (body) => {
        let output = limpiarContenidoPublico(body);

        if (
            typeof output === "string" &&
            output.includes('class="municipio-sin-talleres"')
        ) {
            output = output.replace(
                /<meta name="robots" content="[^"]*">/i,
                '<meta name="robots" content="noindex,follow,max-image-preview:large">'
            );

            response.setHeader("X-Robots-Tag", "noindex, follow");
            response.setHeader("X-TallerMap-Municipio-Vacio", "1");
        }

        const page = Number(request.query?.pagina || 1);

        if (
            typeof output === "string" &&
            response.statusCode === 200 &&
            Number.isInteger(page) &&
            page > 1 &&
            !service
        ) {
            const baseCanonical = `https://www.tallermap.es/municipios/${fileName}`;
            const path = `/municipios/${fileName}?pagina=${page}`;
            const canonical = `https://www.tallermap.es${path}`;

            output = output
                .replace(
                    /<meta name="description" content="([^"]*)">/i,
                    `<meta name="description" content="Página ${page}. $1">`
                )
                .replace(
                    /<link rel="canonical" href="[^"]+">/i,
                    `<link rel="canonical" href="${canonical}">`
                )
                .replace(
                    /("@type":"CollectionPage","name":")([^"]+)(")/i,
                    `$1Página ${page} · $2$3`
                )
                .replaceAll(
                    `"url":"${baseCanonical}"`,
                    `"url":"${canonical}"`
                )
                .replaceAll(
                    `"item":"${baseCanonical}"`,
                    `"item":"${canonical}"`
                );

            const links = [
                `<link rel="prev" href="https://www.tallermap.es/municipios/${fileName}${page > 2 ? `?pagina=${page - 1}` : ""}">`
            ];

            if (output.includes(`?pagina=${page + 1}`)) {
                links.push(
                    `<link rel="next" href="https://www.tallermap.es/municipios/${fileName}?pagina=${page + 1}">`
                );
            }

            output = output.replace("</head>", `${links.join("\n")}\n</head>`);
            response.setHeader("X-TallerMap-Canonical-Page", String(page));
        }

        if (response.statusCode === 200 && typeof output === "string") {
            output = mejorarPaginacionRastreo(output, fileName, service);
            output = optimizarRender(output);
            response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
            response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
            response.setHeader("X-TallerMap-Municipio-Render", "1");
        }

        return originalSend(output);
    };

    return municipioHandler(request, response);
}
