import servicioHandler from "./servicio.js";

const SERVICIOS_SEO = new Set([
    "mecanica-general","frenos","embrague","cambio-aceite-filtros","correa-distribucion","cadena-distribucion","pre-itv","reparacion-motor","caja-cambios","sistema-refrigeracion","escape-catalizador","baterias","electricidad-automovil","alternador-motor-arranque","centralitas-electronica","suspension-amortiguadores","alineacion-direccion","equilibrado-ruedas","neumaticos","lunas-cristales","carroceria","chapa-pintura","diagnosis-electronica","aire-acondicionado","calefaccion-climatizacion","hibridos-electricos"
]);
const RENDER_DIFERIDO = '<style id="tm-servicio-render">#talleres-servicio .taller-card{content-visibility:auto;contain-intrinsic-size:auto 520px}</style>';

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paginaSolicitada(request) {
    const value = Array.isArray(request.query?.pagina)
        ? request.query.pagina[0]
        : request.query?.pagina;

    return value === undefined ? null : String(value).trim();
}

function optimizarRender(output) {
    if (typeof output !== "string" || output.includes('id="tm-servicio-render"')) return output;
    return output.replace(/<\/head>/i, `${RENDER_DIFERIDO}\n</head>`);
}

export default async function handler(request, response) {
    const service = String(request.query?.servicio || "").trim().toLowerCase();
    const rawPage = paginaSolicitada(request);

    if (rawPage !== null && SERVICIOS_SEO.has(service)) {
        const page = Number(rawPage);
        const base = `/servicios/${service}.html`;

        if (!Number.isInteger(page) || page <= 1) {
            response.setHeader("Cache-Control", "no-store");
            response.redirect(301, base);
            return;
        }

        if (rawPage !== String(page)) {
            response.setHeader("Cache-Control", "no-store");
            response.redirect(301, `${base}?pagina=${page}`);
            return;
        }
    }

    const originalSend = response.send.bind(response);

    response.send = (body) => {
        let output = body;
        const page = Number(request.query?.pagina || 1);

        if (
            typeof output === "string" &&
            response.statusCode === 200 &&
            Number.isInteger(page) &&
            page > 1 &&
            SERVICIOS_SEO.has(service)
        ) {
            const base = `https://www.tallermap.es/servicios/${service}.html`;
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

        if (response.statusCode === 200 && typeof output === "string") {
            output = optimizarRender(output);
            response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
            response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
            response.setHeader("X-TallerMap-Service-Render", "1");
        }

        return originalSend(output);
    };

    return servicioHandler(request, response);
}
