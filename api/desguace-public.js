import desguaceHandler from "./desguace-html.js";

function limpiarEnlacesTecnicos(html) {
    if (typeof html !== "string") return html;

    return html.replace(
        /<a class="btn" href="(\/solicitar-pieza\.html\?desguace=[^"]+)">Solicitar pieza<\/a>/gi,
        '<a class="btn" href="$1" rel="nofollow">Solicitar pieza</a>'
    );
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(limpiarEnlacesTecnicos(body));

    return desguaceHandler(request, response);
}
