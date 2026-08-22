import provinciaHandler from "./provincia.js";

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paginaSolicitada(request) {
    const value = Array.isArray(request.query?.pagina)
        ? request.query.pagina[0]
        : request.query?.pagina;

    return value === undefined ? null : String(value).trim();
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
        let output = body;
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

        return originalSend(output);
    };

    return provinciaHandler(request, response);
}
