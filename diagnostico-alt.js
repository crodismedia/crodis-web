#!/usr/bin/env node

const DEFAULT_URL = "https://www.tallermap.es";
const target = process.argv[2] || DEFAULT_URL;

function obtenerImgs(html) {
  return String(html || "").match(/<img\b[^>]*>/gi) || [];
}

function tieneAlt(tag) {
  return /\balt\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i.test(tag);
}

function altVacio(tag) {
  const match = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return false;
  const value = match[1] ?? match[2] ?? match[3] ?? "";
  return value.trim() === "";
}

try {
  const response = await fetch(target, {
    headers: { "user-agent": "TallerMap-Alt-Diagnostic/1.0" },
    redirect: "follow"
  });

  if (!response.ok) {
    console.error(`ERROR ${response.status}: ${target}`);
    process.exit(2);
  }

  const html = await response.text();
  const imgs = obtenerImgs(html);
  const sinAlt = imgs.filter((tag) => !tieneAlt(tag));
  const altVacios = imgs.filter((tag) => tieneAlt(tag) && altVacio(tag));
  const problematicas = [...sinAlt, ...altVacios];

  console.log(`URL: ${response.url}`);
  console.log(`Imágenes totales: ${imgs.length}`);
  console.log(`Sin atributo alt: ${sinAlt.length}`);
  console.log(`Con alt vacío: ${altVacios.length}`);
  console.log(`Problemas alt: ${problematicas.length}`);

  if (problematicas.length) {
    console.log("\nImágenes problemáticas:");
    problematicas.forEach((tag, index) => console.log(`${index + 1}. ${tag}`));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`ERROR al analizar ${target}:`, error?.message || error);
  process.exit(2);
}
