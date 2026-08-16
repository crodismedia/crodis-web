import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const errors = [];
const registration = read("pages/registro.html");
const registrationRuntime = read("js/registro.js");
const home = read("index.html");

function requireCondition(condition, message) {
    if (!condition) errors.push(message);
}

for (const step of [1, 2, 3]) {
    const matches = registration.match(new RegExp(`data-paso=["']${step}["']`, "g")) || [];
    requireCondition(matches.length === 1, `El formulario debe contener exactamente un paso ${step}.`);
}

requireCondition(
    (registration.match(/data-indicador-paso=/g) || []).length === 3,
    "El indicador debe mostrar los tres pasos."
);
requireCondition(
    registration.includes('id="resumen-alta"'),
    "Falta el resumen previo al envío."
);
requireCondition(
    /async function validarPaso/.test(registrationRuntime)
        && /function mostrarPaso/.test(registrationRuntime)
        && /function actualizarResumen/.test(registrationRuntime),
    "Falta la navegación o validación del formulario por pasos."
);
requireCondition(
    /Comunidad Valenciana/i.test(home)
        && /ampl[ií]a|ampliando/i.test(home)
        && /Comunidad Valenciana/i.test(registration),
    "La portada y el alta deben comunicar la cobertura actual y su ampliación."
);
requireCondition(
    !/toda España/i.test(home + registration),
    "La comunicación pública todavía promete cobertura completa en toda España."
);

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log("Validación del paso 2 correcta.");
