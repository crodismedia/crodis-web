import tallerHandler from "./taller-html.js";

function limpiarRuntimeLegacy(html) {
    if (typeof html !== "string") return html;

    return html.replace(
        /\s*<script[^>]+src="[^"]*taller-legacy-redirect\.js[^"]*"[^>]*><\/script>/gi,
        ""
    );
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(limpiarRuntimeLegacy(body));

    return tallerHandler(request, response);
}
