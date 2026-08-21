import municipioHandler from "./municipio.js";

export default async function handler(request, response) {
    const page = Math.max(1, Number.parseInt(String(request.query?.pagina || "1"), 10) || 1);

    if (page <= 1) {
        return municipioHandler(request, response);
    }

    const originalSend = response.send.bind(response);

    response.send = (body) => {
        if (
            response.statusCode === 200 &&
            typeof body === "string" &&
            /\b0 talleres publicados\b/i.test(body)
        ) {
            response.statusCode = 404;
        }

        return originalSend(body);
    };

    return municipioHandler(request, response);
}
