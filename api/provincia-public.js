import provinciaHandler from "./provincia.js";

const RENDER_DIFERIDO = '<style id="tm-provincia-render">.taller-card{content-visibility:auto;contain-intrinsic-size:auto 520px}#lista-municipios-provincia li{content-visibility:auto;contain-intrinsic-size:auto 64px}</style>';

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paginaSolicitada(request) {
    const value = Array.isArray(request.query?.pagina)
        ? request.query.pagina[0]
        : request.query?.pagina;

    return value === undefined ? null : String(value).trim();
}

function optimizarRender(output) {
    if (typeof output !== "string" || output.includes('id="tm-provincia-render"')) return output;
    return output.replace(/<\/head>/i, `${RENDER_DIFERIDO}\n</head>`);
}

function limpiarContenidoPublico(output) {
    if (typeof output !== "string") return output;

    return output
        .replace(/(<p class="ubicacion">)\s*⌖\s*/gi, "$1")
        .replace(/(class="[^"]*accion-mapa[^"]*"[^>]*>)\s*⌖\s*/gi, "$1")
        .replace(/\s*<p class="taller-descripcion">\s*Consulta la ficha del taller para conocer sus servicios y datos de contacto\.?\s*<\/p>/gi, "")
        .replace(/\s*<span[^>]*>\s*Última actualización:\s*[^<]*<\/span>/gi, "");
}

export default async function handler(request, response) {
    const province = String(request.query?.provincia || "").trim().toLowerCase().replace(/\.html$/, "");
    const rawPage = paginaSolicitada(request);

    if (rawPage !== null && /^(alicante|castellon|valencia)$/.test(province)) {
        const page = Number.parseInt(rawPage, 10);
        const base = `/provincias/${province}.html`;

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
        const page = Number(request.query?.pagina || 1);

        if (
            typeof output === "string" &&
            response.statusCode === 200 &&
            Number.isInteger(page) &&
            page > 1 &&
            /^(alicante|castellon|valencia)$/.test(province)
        ) {
            const base = `https://www.tallermap.es/provincias/${province}.html`;
            const canonical = `${base}?pagina=${page}`;
            const basePattern = escapeRegExp(base);

            output = output
                .replace(
                    /<meta property="og:url" content="[^"]+">/i,
                    `<meta property="og:url" content="${canonical}">`
                )
                .replace(
                    new RegExp(`("url"\\s*:\\s*")${basePattern}(")`, "g"),
                    `$1${canonical}$2`
                )
                .replace(
                    new RegExp(`("item"\\s*:\\s*")${basePattern}(")`, "g"),
                    `$1${canonical}$2`
                );

            response.setHeader("X-TallerMap-Structured-Page", String(page));
        }

        if (response.statusCode === 200 && typeof output === "string") {
            output = optimizarRender(output);
            response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
            response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
            response.setHeader("X-TallerMap-Province-Render", "1");
        }

        return originalSend(output);
    };

    return provinciaHandler(request, response);
}
