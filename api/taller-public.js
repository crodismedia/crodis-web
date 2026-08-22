import tallerHandler from "./taller-html.js";

function diferirCSSSecundario(html) {
    return html
        .replace(
            /<link rel="stylesheet" href="(\/css\/valoraciones\.css(?:\?[^\"]*)?)">/i,
            '<link rel="stylesheet" href="$1" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="$1"></noscript>'
        )
        .replace(
            /<link rel="stylesheet" href="(\/css\/taller-botones-contexto\.css(?:\?[^\"]*)?)">/i,
            '<link rel="stylesheet" href="$1" media="print" onload="this.media=\'all\'"><noscript><link rel="stylesheet" href="$1"></noscript>'
        );
}

function prepararFichaCanonica(html) {
    if (typeof html !== "string") return html;

    const output = html
        .replace(
            /\s*<script[^>]+src="[^"]*taller-legacy-redirect\.js[^"]*"[^>]*><\/script>/gi,
            ""
        )
        .replace(
            /\s*<script[^>]+src="https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/[^"]*supabase[^"]*"[^>]*><\/script>/gi,
            ""
        );

    return diferirCSSSecundario(output);
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(prepararFichaCanonica(body));

    return tallerHandler(request, response);
}
