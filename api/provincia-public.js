import provinciaHandler from "./provincia.js";

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => {
        let output = body;
        const page = Number(request.query?.pagina || 1);
        const province = String(request.query?.provincia || "").trim().toLowerCase().replace(/\.html$/, "");

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
