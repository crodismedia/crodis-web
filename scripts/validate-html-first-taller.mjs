import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
const routeConfig = read("vercel.json");
const renderer = read("api/taller-html.js");
const template = read("pages/taller.html");
const automaticImages = read("js/imagenes-automaticas.js");

requireCondition(routeConfig.includes('"/talleres/:slug", "destination": "/api/taller-html?slug=:slug"'), "La ruta pública de talleres debe usar el render HTML-first.");
requireCondition(renderer.includes('content="index,follow,max-image-preview:large"'), "La ficha pública real debe salir indexable desde servidor.");
requireCondition(!renderer.includes('"noindex,follow"'), "El render HTML-first no debe introducir noindex en fichas reales.");
requireCondition(template.includes('content="noindex,follow"'), "La plantilla legacy /pages/taller.html debe quedar noindex por defecto.");
requireCondition(renderer.includes('Cómo llegar'), "Cómo llegar debe generarse en servidor.");
requireCondition(renderer.includes('buscar_talleres_relacionados'), "Los talleres relacionados deben resolverse en servidor.");
requireCondition(renderer.includes('datos-estructurados-taller'), "Los datos estructurados deben resolverse en servidor.");
requireCondition(renderer.includes('stripContentRuntime'), "El render debe retirar el runtime que reconstruía el contenido en cliente.");
requireCondition(renderer.includes('canonicalSlug !== requestedSlug'), "Los alias deben redirigir al slug canónico.");
requireCondition(renderer.includes('response.status(308)'), "La normalización del slug debe usar redirección permanente 308.");
requireCondition(renderer.includes('data-foto-ruta='), "Las fotos privadas deben conservarar su ruta para firma auxiliar.");
requireCondition(automaticImages.includes('.ficha-publica-foto[data-foto-ruta]'), "El cargador de imágenes debe firmar también fotos privadas de la ficha pública.");
requireCondition(template.includes('id="robots-taller"'), "La plantilla debe mantener un marcador robots reemplazable por SSR.");
requireCondition(template.includes('data-tallermap-valoraciones="true"'), "Las valoraciones deben conservarse como función cliente no SEO.");
requireCondition(template.includes('data-tallermap-reclamacion-link="true"'), "La reclamación de ficha debe conservarse.");
requireCondition(template.includes('data-tallermap-imagenes-auto="true"'), "La experiencia de imágenes automáticas debe conservarse.");
requireCondition(template.includes('data-tallermap-supabase-aux="true"'), "Las funciones auxiliares que consultan Supabase deben conservarar su SDK cliente.");
requireCondition(!renderer.includes('taller-urls-core.js'), "El runtime SEO antiguo no debe cargarse desde el render HTML-first.");
requireCondition(!existsSync(new URL('../api/taller.js', import.meta.url)), "No debe coexistir un segundo motor SSR api/taller.js.");
console.log("OK: HTML-first validado; fichas reales indexables y plantilla legacy noindex.");
