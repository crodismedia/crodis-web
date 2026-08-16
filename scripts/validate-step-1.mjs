import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const errors = [];

function requireMatch(source, pattern, message) {
    if (!pattern.test(source)) errors.push(message);
}

const search = read("js/supabase.js");
requireMatch(
    search,
    /await\s+cargarTalleres\([\s\S]*?await\s+mostrarResultadosCuandoListos\(/,
    "La búsqueda debe esperar a los resultados antes de desplazarse."
);
requireMatch(
    search,
    /requestAnimationFrame\([\s\S]*?requestAnimationFrame\([\s\S]*?scrollIntoView/,
    "El desplazamiento debe esperar a que el navegador termine el nuevo layout."
);

const cookies = read("js/cookie-consent.js");
requireMatch(
    cookies,
    /window\.__tallerMapCookieConsentLoaded/,
    "Falta la protección contra la inicialización duplicada de cookies."
);
requireMatch(
    cookies,
    /return\s+['"]\/pages\/cookies\.html['"]/,
    "La política de cookies debe usar una ruta absoluta válida."
);

const services = read("js/servicios.js");
requireMatch(
    services,
    /DOMContentLoaded[\s\S]*?asegurarConsentimiento/,
    "El cargador auxiliar de cookies debe esperar al HTML completo."
);

const home = read("api/home.js");
requireMatch(
    home,
    /replace\(\/\-\[0-9a-f\]\{8\}\$\/i,\s*['"]['"]\)/,
    "Los nombres reconstruidos desde el slug deben retirar el hash técnico final."
);

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Validación del paso 1 correcta.");
