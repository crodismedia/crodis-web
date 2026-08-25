import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const SITE_URL = "https://www.tallermap.es";
const DESTINO = path.join(process.cwd(), "talleres");
const RESUMEN_CSV = path.join(process.cwd(), "tallermap_talleres_estaticos_resultado.csv");
const CONCURRENCIA = 6;
const REINTENTOS = 3;

function dormir(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function csv(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function extraerCanonical(html) {
  const m = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return m ? m[1] : "";
}

function extraerRobots(html) {
  const m = html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']robots["']/i);
  return m ? m[1] : "";
}

function slugDesdeUrl(url) {
  try {
    const u = new URL(url);
    const partes = u.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("talleres");
    return i >= 0 && partes[i + 1] ? decodeURIComponent(partes[i + 1]) : "";
  } catch {
    return "";
  }
}

async function listarSlugsSupabase() {
  const slugs = [];
  let desde = 0;
  let total = null;

  while (true) {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_limite: 1000, p_desde: desde })
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Supabase respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }

    const filas = await respuesta.json();
    if (!Array.isArray(filas)) throw new Error("Supabase no devolvió una lista.");

    if (filas.length && total === null) {
      total = Number(filas[0]?.total_resultados ?? 0) || null;
    }

    for (const fila of filas) {
      const slug = String(fila?.slug || "").trim();
      if (slug) slugs.push(slug);
    }

    console.log(`Supabase: ${slugs.length}${total ? ` / ${total}` : ""} slugs recuperados`);

    if (filas.length < 1000) break;
    desde += 1000;
  }

  return [...new Set(slugs)];
}

async function descargarFicha(slugOriginal) {
  let ultimoError = "";

  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      const url = `${SITE_URL}/api/taller-public?slug=${encodeURIComponent(slugOriginal)}`;
      const respuesta = await fetch(url, {
        redirect: "follow",
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "TallerMap-USB-Static-Sync/1.0"
        }
      });

      const html = await respuesta.text();

      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }

      if (!/<html\b/i.test(html)) {
        throw new Error("La respuesta no parece HTML.");
      }

      const canonical = extraerCanonical(html);
      const robots = extraerRobots(html);
      const slugFinal = slugDesdeUrl(canonical) || slugDesdeUrl(respuesta.url) || slugOriginal;

      if (/\bnoindex\b/i.test(robots)) {
        throw new Error(`La ficha devuelve robots="${robots}"`);
      }

      if (!/\bindex\b/i.test(robots)) {
        throw new Error(`No se detectó robots index en la ficha: "${robots}"`);
      }

      const carpeta = path.join(DESTINO, slugFinal);
      await fs.mkdir(carpeta, { recursive: true });
      const archivo = path.join(carpeta, "index.html");
      await fs.writeFile(archivo, html, "utf8");

      return {
        slugOriginal,
        slugFinal,
        estado: "OK",
        http: respuesta.status,
        canonical,
        robots,
        archivo,
        error: ""
      };
    } catch (error) {
      ultimoError = error?.message || String(error);
      if (intento < REINTENTOS) {
        await dormir(750 * intento);
      }
    }
  }

  return {
    slugOriginal,
    slugFinal: "",
    estado: "ERROR",
    http: "",
    canonical: "",
    robots: "",
    archivo: "",
    error: ultimoError
  };
}

async function ejecutarEnLotes(items, worker, concurrencia) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  let terminados = 0;

  async function hilo() {
    while (true) {
      const i = siguiente++;
      if (i >= items.length) return;

      resultados[i] = await worker(items[i]);
      terminados++;

      if (terminados % 25 === 0 || terminados === items.length) {
        const errores = resultados.filter(r => r?.estado === "ERROR").length;
        console.log(`Generadas: ${terminados}/${items.length} | errores: ${errores}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrencia }, () => hilo()));
  return resultados;
}

async function guardarResumen(resultados) {
  const cabecera = [
    "slug_supabase",
    "slug_final",
    "estado",
    "http",
    "canonical",
    "robots",
    "archivo_local",
    "error"
  ];

  const lineas = [cabecera.map(csv).join(",")];

  for (const r of resultados) {
    lineas.push([
      r.slugOriginal,
      r.slugFinal,
      r.estado,
      r.http,
      r.canonical,
      r.robots,
      r.archivo,
      r.error
    ].map(csv).join(","));
  }

  await fs.writeFile(RESUMEN_CSV, "\ufeff" + lineas.join("\r\n"), "utf8");
}

async function main() {
  console.log("TallerMap - sincronización estática de talleres");
  console.log(`Destino: ${DESTINO}`);
  console.log("No se borrarán otros archivos del proyecto.\n");

  await fs.mkdir(DESTINO, { recursive: true });

  const slugs = await listarSlugsSupabase();
  if (!slugs.length) throw new Error("No se obtuvo ningún taller publicable desde Supabase.");

  console.log(`\nTotal a generar: ${slugs.length}`);
  console.log("Descargando las fichas públicas actuales...\n");

  const resultados = await ejecutarEnLotes(slugs, descargarFicha, CONCURRENCIA);
  await guardarResumen(resultados);

  const ok = resultados.filter(r => r.estado === "OK").length;
  const errores = resultados.length - ok;

  console.log("\n==============================");
  console.log(`TOTAL SUPABASE: ${slugs.length}`);
  console.log(`HTML GENERADOS: ${ok}`);
  console.log(`ERRORES: ${errores}`);
  console.log(`CARPETA: ${DESTINO}`);
  console.log(`RESUMEN: ${RESUMEN_CSV}`);
  console.log("==============================\n");

  if (errores) {
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error("\nERROR GENERAL:", error);
  process.exitCode = 1;
});
