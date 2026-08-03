import fs from "node:fs";

const adminHtml = fs.readFileSync(new URL("../pages/admin.html", import.meta.url), "utf8");
const fixer = fs.readFileSync(new URL("../js/corregir-codificacion.js", import.meta.url), "utf8");

const errors = [];

if (!adminHtml.includes("../js/corregir-codificacion.js")) {
    errors.push("El panel no carga corregir-codificacion.js");
}

for (const required of ["MutationObserver", "corregirNodo", "DOMContentLoaded"]) {
    if (!fixer.includes(required)) errors.push(`Falta ${required} en el corrector`);
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Corrección de codificación conectada correctamente.");
