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

        return originalSend(output);
    };

    return municipioHandler(request, response);
}
