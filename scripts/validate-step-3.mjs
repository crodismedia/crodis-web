import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import handler from "../api/home.js";

const root = resolve(import.meta.dirname, "..");
const home = readFileSync(resolve(root, "index.html"), "utf8");
const errors = [];

function requireCondition(condition, message) {
    if (!condition) errors.push(message);
}

const heroDescription = home.match(/<p class="hero-descripcion">([\s\S]*?)<\/p>/i)?.[1] || "";
const twitterDescription = home.match(/<meta name="twitter:description" content="([^"]*)">/i)?.[1] || "";

requireCondition(
    /Comunidad Valenciana/i.test(heroDescription) && /ampliando/i.test(heroDescription),
    "El mensaje principal debe indicar la cobertura valenciana y su ampliación."
);
requireCondition(
    /Comunidad Valenciana/i.test(twitterDescription) && /ampl[ií]a/i.test(twitterDescription),
    "La descripción de Twitter debe reflejar la cobertura territorial."
);

globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const isInitial = request.p_ubicacion === "" && request.p_servicio === "";
    return {
        ok: true,
        async json() {
            return isInitial
                ? [{
                    slug: "taller-aguila-silla-ab12cd34",
                    nombre: "Taller Águila",
                    ciudad: "Silla",
                    provincia: "Valencia"
                }]
                : [{
                    slug: "taller-prueba-silla-ab12cd34",
                    nombre: "Taller Prueba",
                    ciudad: "Silla",
                    provincia: "Valencia",
                    total_resultados: 41
                }];
        }
    };
};

function createResponse() {
    const response = { headers: {}, statusCode: 0, body: "" };
    response.setHeader = (name, value) => { response.headers[name] = value; };
    response.status = (statusCode) => {
        response.statusCode = statusCode;
        return response;
    };
    response.send = (body) => { response.body = body; };
    return response;
}

const initialResponse = createResponse();
await handler({ query: {} }, initialResponse);
requireCondition(
    initialResponse.statusCode === 200 && initialResponse.body.includes("Taller Águila"),
    "El SSR inicial debe renderizar el nombre completo devuelto por Supabase."
);
requireCondition(
    initialResponse.body.includes("js/taller-ui.js?v="),
    "La portada SSR debe cargar el runtime de interfaz."
);

const searchResponse = createResponse();
await handler({
    query: { poblacion: "Silla", servicio: "neumaticos", pagina: "2" }
}, searchResponse);
requireCondition(
    searchResponse.statusCode === 200
        && searchResponse.body.includes("41 talleres encontrados")
        && searchResponse.body.includes('value="Silla"')
        && searchResponse.body.includes('value="neumaticos" selected'),
    "El SSR de búsqueda debe conservar filtros y mostrar el total."
);
requireCondition(
    searchResponse.headers["X-TallerMap-Search-SSR"] === "1",
    "El SSR de búsqueda debe incluir su cabecera de diagnóstico."
);

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Validación del paso 3 correcta: cobertura y SSR.");
