import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(file, before, after) {
    const source = readFileSync(file, "utf8");
    if (!source.includes(before)) {
        throw new Error(`No se encontró el bloque esperado en ${file}. No se modificó ese archivo.`);
    }
    writeFileSync(file, source.replace(before, after), "utf8");
}

replaceOnce(
    "lib/server-utils.js",
    `export function safePhone(value) {
    return String(value || "").replace(/[^\\d+]/g, "").slice(0, 20);
}`,
    `export function safePhone(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\\D/g, "");

    if (/^0034\\d{9}$/.test(digits)) return \`+\${digits.slice(2)}\`;
    if (/^34\\d{9}$/.test(digits)) return \`+\${digits}\`;
    if (raw.startsWith("+") && digits) return \`+\${digits}\`.slice(0, 20);
    return digits.slice(0, 20);
}`
);

replaceOnce(
    "js/taller.js",
    `    function telefonoLegible(valor) {
        const limpio = String(valor || "").replace(/[^\\d+]/g, "");`,
    `    function telefonoSeguro(valor) {
        const raw = String(valor || "").trim();
        const digitos = raw.replace(/\\D/g, "");
        if (/^0034\\d{9}$/.test(digitos)) return \`+\${digitos.slice(2)}\`;
        if (/^34\\d{9}$/.test(digitos)) return \`+\${digitos}\`;
        if (raw.startsWith("+") && digitos) return \`+\${digitos}\`.slice(0, 20);
        return digitos.slice(0, 20);
    }

    function telefonoLegible(valor) {
        const limpio = telefonoSeguro(valor);`
);

replaceOnce(
    "js/taller.js",
    `            telefono: leer("telefono").replace(/[^\\d+]/g, ""),`,
    `            telefono: telefonoSeguro(leer("telefono")),`
);

replaceOnce(
    "js/taller.js",
    `        const telefono = String(taller.telefono || "").replace(/[^\\d+]/g, "");`,
    `        const telefono = telefonoSeguro(taller.telefono);`
);

replaceOnce(
    "pages/taller.html",
    `taller.js?v=20260810-3`,
    `taller.js?v=20260810-4`
);

replaceOnce(
    "scripts/validate-step-4.mjs",
    `requireCondition(formatPhoneDisplay("+34963782395") === "+34 963 782 395", "Los teléfonos con prefijo deben conservar el prefijo y ser legibles.");`,
    `requireCondition(formatPhoneDisplay("+34963782395") === "+34 963 782 395", "Los teléfonos con prefijo deben conservar el prefijo y ser legibles.");
requireCondition(formatPhoneDisplay("0034963782395") === "+34 963 782 395", "El prefijo 0034 debe normalizarse como +34.");
requireCondition(formatPhoneDisplay("34963782395") === "+34 963 782 395", "El prefijo 34 sin signo debe normalizarse como +34.");`
);

replaceOnce(
    "scripts/validate-step-4.mjs",
    `taller.js?v=20260810-3`,
    `taller.js?v=20260810-4`
);

console.log("Corrección aplicada: teléfonos nacionales y +34 agrupados correctamente.");
