#!/usr/bin/env node

const DEFAULT_URL = "https://www.tallermap.es";
const input = process.argv[2] || DEFAULT_URL;
const base = new URL(input);
base.pathname = "/";
base.search = "";
base.hash = "";

const MAX_POR_SITEMAP = 8;
const USER_AGENT = "TallerMap-Alt-Diagnostic/2.0";

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

// Un alt vacio es correcto cuando una imagen es decorativa y el control
// o el texto contiguo ya comunica su significado al lector de pantalla.
function esDecorativaConContexto(html, tag, pos) {
  if (/\baria-hidden\s*=\s*["']true["']/i.test(tag)) return true;

  // Logotipo junto al nombre visible de TallerMap dentro del mismo enlace.
  if (/\bclass=["'][^"']*\bmarca-icono-logo\b/i.test(tag)) {
    const inicio = html.lastIndexOf("<a", pos);
    const fin = html.indexOf("</a>", pos);
    if (inicio >= 0 && pos - inicio < 650 && fin > pos && fin - pos < 650) {
      const despues = html.slice(pos + tag.length, fin);
      if (/<strong\b[^>]*>\s*TallerMap\s*<\/strong>/i.test(despues)) return true;
    }
  }

  // Insignias de marcas con boton accesible y pie de figura visible.
  const inicio = html.lastIndexOf("<figure", pos);
  const fin = html.indexOf("</figure>", pos);
  if (inicio >= 0 && pos - inicio < 600 && fin > pos && fin - pos < 600) {
    const figura = html.slice(inicio, fin + 9);
    if (/\bclass=["'][^"']*\btm-marca-item\b/i.test(figura)
      && /<button\b[^>]*\baria-label=["'][^"']+["']/i.test(figura)
      && /<figcaption\b[^>]*>[^<]+<\/figcaption>/i.test(figura)) return true;
  }
  return false;
}

async function descargar(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "cache-control": "no-cache" },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return { url: response.url, text: await response.text() };
}

function urlsDeSitemap(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

function muestraRepartida(urls, max = MAX_POR_SITEMAP) {
  const lista = [...new Set(urls)];
  if (lista.length <= max) return lista;

  const elegidas = [];
  for (let i = 0; i < max; i += 1) {
    const indice = Math.round((i * (lista.length - 1)) / (max - 1));
    elegidas.push(lista[indice]);
  }
  return [...new Set(elegidas)];
}

async function recogerUrls() {
  if (process.argv.includes("--single")) return [base.href];
  const urls = new Set([
    new URL("/", base).href,
    new URL("/provincias/alicante.html", base).href,
    new URL("/provincias/castellon.html", base).href,
    new URL("/provincias/valencia.html", base).href,
    new URL("/servicios/", base).href,
    new URL("/desguaces.html", base).href
  ]);

  const sitemaps = [
    "/sitemap-talleres.xml",
    "/sitemap-municipios.xml",
    "/servicios/sitemap.xml",
    "/sitemap-desguaces.xml"
  ];

  for (const ruta of sitemaps) {
    try {
      const { text } = await descargar(new URL(ruta, base));
      muestraRepartida(urlsDeSitemap(text)).forEach((url) => urls.add(url));
    } catch (error) {
      console.warn(`AVISO: no se pudo leer ${ruta}: ${error.message}`);
    }
  }

  return [...urls];
}

async function analizar(url) {
  try {
    const { url: finalUrl, text: html } = await descargar(url);
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)]
      .map((m) => ({ tag: m[0], pos: m.index }));
    const sinAlt = imgs.filter(({ tag }) => !tieneAlt(tag)).map(({ tag }) => tag);
    const altVacios = imgs.filter(({ tag, pos }) =>
      tieneAlt(tag) && altVacio(tag) && !esDecorativaConContexto(html, tag, pos)
    ).map(({ tag }) => tag);

    return {
      ok: sinAlt.length === 0 && altVacios.length === 0,
      url: finalUrl,
      total: imgs.length,
      sinAlt,
      altVacios
    };
  } catch (error) {
    return { ok: false, url, error: error.message, total: 0, sinAlt: [], altVacios: [] };
  }
}

const urls = await recogerUrls();
console.log(`Diagnóstico ALT TallerMap`);
console.log(`Base: ${base.href}`);
console.log(`URLs a comprobar: ${urls.length}\n`);

let problemas = 0;
let errores = 0;
let imagenes = 0;

for (const url of urls) {
  const resultado = await analizar(url);
  imagenes += resultado.total || 0;

  if (resultado.error) {
    errores += 1;
    console.log(`ERROR ${resultado.url}: ${resultado.error}`);
    continue;
  }

  const totalProblemas = resultado.sinAlt.length + resultado.altVacios.length;
  if (totalProblemas) {
    problemas += totalProblemas;
    console.log(`\nPROBLEMA ${resultado.url}`);
    console.log(`  Imágenes: ${resultado.total}`);
    console.log(`  Sin alt: ${resultado.sinAlt.length}`);
    console.log(`  Alt vacío: ${resultado.altVacios.length}`);

    resultado.sinAlt.forEach((tag) => console.log(`  SIN ALT: ${tag}`));
    resultado.altVacios.forEach((tag) => console.log(`  ALT VACÍO: ${tag}`));
  } else {
    console.log(`OK ${resultado.url} (${resultado.total} imágenes)`);
  }
}

console.log("\n==========================================");
console.log(`URLs comprobadas: ${urls.length}`);
console.log(`Imágenes revisadas: ${imagenes}`);
console.log(`Problemas alt: ${problemas}`);
console.log(`Errores HTTP: ${errores}`);

if (problemas > 0 || errores > 0) {
  process.exitCode = 1;
} else {
  console.log("Resultado: diagnóstico superado");
}
