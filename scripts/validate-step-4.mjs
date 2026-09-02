import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPhoneDisplay, serviceLabel, workshopPhotoSource } from "../lib/server-utils.js";
import homeHandler from "../api/home.js";
import municipalityHandler from "../api/municipio.js";
import provinceHandler from "../api/provincia.js";
import serviceHandler from "../api/servicio.js";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const errors = [];
const requireCondition = (condition, message) => { if (!condition) errors.push(message); };

const publicFiles = [
    "api/municipio.js",
    "api/servicio.js",
    "api/taller-html.js",
    "js/taller-ui.js",
    "js/provincia.js",
    "js/taller.js"
];

requireCondition(serviceLabel("mecanica-general") === "Mecánica general", "Debe traducir los identificadores de servicio.");
requireCondition(serviceLabel("suspension-amortiguadores") === "Suspensión y amortiguadores", "Debe conservar acentos en los servicios.");
requireCondition(formatPhoneDisplay("963782395") === "963 782 395", "Los teléfonos españoles deben mostrarse en grupos legibles.");
requireCondition(formatPhoneDisplay("+34963782395") === "963 782 395", "Los teléfonos deben mostrarse sin el prefijo +34.");
requireCondition(formatPhoneDisplay("0034963782395") === "963 782 395", "Los teléfonos deben mostrarse sin el prefijo 0034.");
requireCondition(formatPhoneDisplay("34963782395") === "963 782 395", "Los teléfonos deben mostrarse sin el prefijo 34.");
requireCondition(workshopPhotoSource({ fotos: ["solicitudes/demo/fachada.webp"] }).path === "solicitudes/demo/fachada.webp", "Debe aceptar rutas de fotografías subidas.");
requireCondition(workshopPhotoSource({ fotos: ["https://cdn.example.com/fachada.webp"] }).url === "https://cdn.example.com/fachada.webp", "Debe aceptar fotografías autorizadas con URL segura.");
requireCondition(!workshopPhotoSource({ imagen_url: "https://example.com/foto.jpg" }).url, "No debe usar imágenes externas sin autorización registrada.");

for (const file of publicFiles) {
    const source = read(file);
    requireCondition(!/✓ (?:Taller )?verificado/i.test(source), `${file} conserva una etiqueta pública ambigua.`);
}

const homeApi = read("api/home.js");
requireCondition(/buscar_talleres_profesional/.test(homeApi) && /p_ubicacion:\s*""/.test(homeApi), "La portada debe solicitar registros completos.");
requireCondition(
    /const FRONTEND_VERSION = "\d{8}-\d+";/.test(homeApi) &&
    homeApi.includes('taller-ui.js?v=${FRONTEND_VERSION}') &&
    homeApi.includes('supabase.js?v=${FRONTEND_VERSION}'),
    "La portada debe versionar conjuntamente sus runtimes públicos."
);

const cardRuntime = read("js/taller-ui.js");
requireCondition(!/verificado-en-contenido/.test(cardRuntime), "Las tarjetas dinámicas no deben mostrar una insignia genérica de verificación.");
requireCondition(cardRuntime.includes('toLocaleLowerCase("es")'), "Las tarjetas dinámicas deben normalizar correctamente las mayúsculas acentuadas.");

const workshopTemplate = read("pages/taller.html");
requireCondition(!/<img[^>]+id="taller-foto-imagen"[^>]+src=""/i.test(workshopTemplate), "La ficha no debe solicitar una imagen con URL vacía.");
requireCondition(
    !/<script[^>]+src="[^"]*taller\.js[^"]*"/i.test(workshopTemplate) &&
    /<script[^>]+src="[^"]*imagenes-automaticas\.js\?v=\d{8}-\d+"[^>]*>/is.test(workshopTemplate),
    "La ficha HTML-first debe excluir el runtime heredado y versionar su gestor de imágenes."
);

for (const file of ["api/municipio.js", "api/servicio.js", "api/provincia.js"]) {
    const source = read(file);
    requireCondition(/<span[^>]+aria-disabled="true"/.test(source), `${file} debe renderizar los controles deshabilitados como texto.`);
}

const provinceApi = read("api/provincia.js");
requireCondition(
    /setHeader\(\s*"Cache-Control"\s*,\s*"no-store"\s*\)/s.test(provinceApi),
    "Un fallo provincial transitorio no debe almacenarse en caché."
);

for (const file of ["sitemap.xml", "sitemap-index.xml", "sitemap-provincias.xml", "servicios/sitemap.xml"]) {
    requireCondition(read(file).includes("2026-08-10"), `${file} debe reflejar la actualización actual.`);
}

function createResponse() {
    const response = { headers: {}, statusCode: 0, body: "" };
    response.setHeader = (name, value) => { response.headers[name] = value; };
    response.status = (statusCode) => { response.statusCode = statusCode; return response; };
    response.send = (body) => { response.body = body; };
    return response;
}

const workshop = {
    id: "110775e8-0000-4000-8000-000000000000",
    slug: "taller-aguila-teulada-110775e8",
    nombre: "Taller Águila",
    ciudad: "Teulada",
    provincia: "Alicante",
    codigo_postal: "03725",
    servicios: ["mecanica-general", "suspension-amortiguadores"],
    fotos: ["solicitudes/demo/fachada.webp"],
    verificado: true,
    total_resultados: 60
};

globalThis.fetch = async (url) => ({
    ok: true,
    async json() {
        if (String(url).includes("listar_municipios_publicos")) {
            return [{ municipio: "Teulada", codigo_municipal: "03128", total_talleres: 60 }];
        }
        return [workshop];
    }
});

const homeResponse = createResponse();
await homeHandler({ query: {} }, homeResponse);
requireCondition(
    homeResponse.headers["Cache-Control"] === "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    "La portada pública debe almacenarse temporalmente en la caché de Vercel."
);

const searchHomeResponse = createResponse();
await homeHandler({ query: { poblacion: "Teulada" } }, searchHomeResponse);
requireCondition(
    searchHomeResponse.headers["Cache-Control"] === "no-store, max-age=0",
    "Las búsquedas de la portada no deben compartirse en caché."
);

const serviceResponse = createResponse();
await serviceHandler({ query: { servicio: "mecanica-general", pagina: "1" } }, serviceResponse);
requireCondition(serviceResponse.statusCode === 200, "La página de servicio debe renderizar correctamente.");
requireCondition(serviceResponse.body.includes("Suspensión y amortiguadores") && !serviceResponse.body.includes("verificado-en-contenido"), "La página de servicio debe mostrar servicios sin insignias genéricas.");
requireCondition(serviceResponse.body.includes('class="taller-imagen taller-imagen-1"') && serviceResponse.body.includes('data-foto-ruta="solicitudes/demo/fachada.webp"'), "La página de servicio debe preparar la foto autorizada o su placeholder.");
requireCondition(!/<a[^>]+aria-disabled="true"/i.test(serviceResponse.body), "La paginación de servicio no debe crear enlaces deshabilitados.");

const imageRuntime = read("js/imagenes-automaticas.js");
requireCondition(
    imageRuntime.includes("Imagen no disponible") &&
    /\.from\(\s*"fotos-talleres"\s*\)\s*\.createSignedUrls\(/s.test(imageRuntime),
    "El runtime debe diferenciar placeholders y fotografías autorizadas."
);

const supabaseRuntime = read("js/supabase.js");
requireCondition(
    supabaseRuntime.indexOf("window.supabaseClient = supabaseClient;") < supabaseRuntime.indexOf("if (!window.TallerMapTallerUI)"),
    "El Centro de control debe inicializar Supabase sin depender de la interfaz pública."
);

const municipalityResponse = createResponse();
await municipalityHandler({ query: { archivo: "teulada-03128.html", pagina: "1" } }, municipalityResponse);
requireCondition(municipalityResponse.statusCode === 200 && municipalityResponse.body.includes("Mecánica general") && municipalityResponse.body.includes('data-foto-ruta="solicitudes/demo/fachada.webp"'), "La página municipal debe traducir servicios y preparar fotos autorizadas.");
requireCondition(!municipalityResponse.body.includes("verificado-en-contenido"), "La página municipal no debe mostrar insignias genéricas.");
requireCondition(!/<a[^>]+aria-disabled="true"/i.test(municipalityResponse.body), "La paginación municipal no debe crear enlaces deshabilitados.");

const provinceResponse = createResponse();
await provinceHandler({ query: { provincia: "alicante", pagina: "1" } }, provinceResponse);
requireCondition(provinceResponse.headers["X-TallerMap-Province-SSR"] === "1", "La página provincial debe completar el SSR.");
requireCondition(provinceResponse.body.includes("Teulada") && provinceResponse.body.includes('data-foto-ruta="solicitudes/demo/fachada.webp"') && !/<a[^>]+aria-disabled="true"/i.test(provinceResponse.body), "La página provincial debe incluir municipios, fotos autorizadas y paginación accesible.");

globalThis.fetch = async () => { throw new Error("fallo simulado"); };
const failedProvinceResponse = createResponse();
await provinceHandler({ query: { provincia: "alicante" } }, failedProvinceResponse);
requireCondition(failedProvinceResponse.headers["Cache-Control"] === "no-store", "El fallback provincial no debe quedar almacenado en caché.");

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Validación del paso 4 correcta: confianza, presentación y SEO.");
