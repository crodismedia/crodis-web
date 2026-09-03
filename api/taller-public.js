import tallerHandler from "./taller-html.js";

const TALLER_SHELL_VERSION = "20260903-1";
const VALORACIONES_VERSION = "20260823-2";
const RECLAMACION_VERSION = "20260823-2";
const VALORACIONES_CSS_VERSION = "20260823-1";
const RENDER_DIFERIDO = '<style id="tm-render-diferido">.ficha-contexto,.ficha-relacionados,.valoraciones-seccion{content-visibility:auto;contain-intrinsic-size:auto 500px}</style>';
const FOOTER_COMPACTO = '<style id="tm-footer-compacto">.pie{min-height:0!important;padding:22px 0 18px!important}.pie .copyright{margin-top:0!important;padding-top:0!important;border-top:0!important}</style>';

function usarCSSLigero(html) {
    return html.replace(
        /href="\/css\/estilo\.css(?:\?[^\"]*)?"/i,
        `href="/css/taller-shell.css?v=${TALLER_SHELL_VERSION}"`
    );
}

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

function optimizarRenderDiferido(html) {
    if (html.includes('id="tm-render-diferido"')) return html;
    return html.replace(/<\/head>/i, `${RENDER_DIFERIDO}\n${FOOTER_COMPACTO}\n</head>`);
}

function limpiarContenidoPublico(html) {
    if (typeof html !== "string") return html;

    return html
        .replace(/\s*<span id="taller-actualizacion" class="ficha-fecha">[\s\S]*?<\/span>/gi, "")
        .replace(/\s*<p class="taller-descripcion">\s*Consulta la ficha del taller para conocer sus servicios y datos de contacto\.?\s*<\/p>/gi, "")
        .replace(/(<p class="ubicacion">)\s*⌖\s*/gi, "$1")
        .replace(/(class="[^"]*(?:accion-mapa|tm-card-btn-map)[^"]*"[^>]*>)\s*⌖\s*/gi, "$1");
}

function prepararFichaCanonica(html) {
    if (typeof html !== "string") return html;

    const output = limpiarContenidoPublico(html)
        .replace(
            /\s*<script[^>]+src="[^"]*taller-legacy-redirect\.js[^"]*"[^>]*><\/script>/gi,
            ""
        )
        .replace(
            /\s*<script[^>]+src="https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/[^"]*supabase[^"]*"[^>]*><\/script>/gi,
            ""
        );

    return optimizarRenderDiferido(
        versionarScripts(
            diferirCSSSecundario(
                versionarCSS(
                    usarCSSLigero(output)
                )
            )
        )
    );
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => {
        if (response.statusCode === 200 && typeof body === "string") {
            response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
            response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
        }

        return originalSend(prepararFichaCanonica(body));
    };

    return tallerHandler(request, response);
}
