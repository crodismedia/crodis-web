import municipioHandler from "./municipio.js";

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => {
        let output = body;

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
        const service = String(request.query?.servicio || "").trim();
        const fileName = String(request.query?.archivo || "").trim().toLowerCase();

        if (
            typeof output === "string" &&
            response.statusCode === 200 &&
            Number.isInteger(page) &&
            page > 1 &&
            !service &&
            /^[a-z0-9-]+-\d{5}\.html$/.test(fileName)
        ) {
            const path = `/municipios/${fileName}?pagina=${page}`;
            const canonical = `https://www.tallermap.es${path}`;

            output = output.replace(
                /<link rel="canonical" href="[^"]+">/i,
                `<link rel="canonical" href="${canonical}">`
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

        return originalSend(output);
    };

    return municipioHandler(request, response);
}
