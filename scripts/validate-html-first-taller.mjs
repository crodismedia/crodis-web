import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const routeConfig = read("vercel.json");
const renderer = read("api/taller-html.js");
const template = read("pages/taller.html");

requireCondition(routeConfig.includes('"/talleres/:slug", "destination": "/api/taller-html?slug=:slug"'), "La ruta pública de talleres debe usar el render HTML-first.");
requireCondition(renderer.includes('content="index,follow,max-image-preview:large"'), "La ficha pública real debe salir indexable desde servidor.");
requireCondition(!renderer.includes('"noindex,follow"'), "El render HTML-first no debe introducir noindex en fichas reales.");
requireCondition(renderer.includes('Cómo llegar'), "Cómo llegar debe generarse en servidor.");
requireCondition(renderer.includes('buscar_talleres_relacionados'), "Los talleres relacionados deben resolverse en servidor.");
requireCondition(renderer.includes('datos-estructurados-taller'), "Los datos estructurados deben resolverse en servidor.");
requireCondition(renderer.includes('stripContentRuntime'), "El render debe retirar el runtime que reconstruía el contenido en cliente.");
requireCondition(template.includes('id="robots-taller"'), "La plantilla debe mantener un marcador robots reemplazable por SSR.");

console.log("OK: arquitectura HTML-first de fichas validada estáticamente.");
