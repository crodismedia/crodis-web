import tallerHandler from "./taller-html.js";

const VALORACIONES_VERSION = "20260823-2";
const RECLAMACION_VERSION = "20260823-2";
const VALORACIONES_CSS_VERSION = "20260823-1";

function versionarCSS(html) {
    return html.replace(
        /href="\/css\/valoraciones\.css(?:\?[^\"]*)?"/i,
        `href="/css/valoraciones.css?v=${VALORACIONES_CSS_VERSION}"`
    );
}

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

function versionarScripts(html) {
    return html
        .replace(
            /src="\/js\/valoraciones\.js(?:\?[^\"]*)?"/i,
            `src="/js/valoraciones.js?v=${VALORACIONES_VERSION}"`
        )
        .replace(
            /src="\/js\/reclamacion-link\.js(?:\?[^\"]*)?"/i,
            `src="/js/reclamacion-link.js?v=${RECLAMACION_VERSION}"`
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

    return versionarScripts(diferirCSSSecundario(versionarCSS(output)));
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(prepararFichaCanonica(body));

    return tallerHandler(request, response);
}
