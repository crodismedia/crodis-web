import desguacesHandler from "./desguaces-public.js";

function limpiarEnlacesTecnicos(html) {
    if (typeof html !== "string") return html;

    return html
        .replace(
            /<a href="\/acceso-desguaces\.html">Acceso profesional<\/a>/gi,
            '<a href="/acceso-desguaces.html" rel="nofollow">Acceso profesional</a>'
        )
        .replace(
            /<a href="(\/api\/desguaces-solicitar-acceso\?id=[^"]+)">Solicitar acceso<\/a>/gi,
            '<a href="$1" rel="nofollow">Solicitar acceso</a>'
        );
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(limpiarEnlacesTecnicos(body));

    return desguacesHandler(request, response);
}
