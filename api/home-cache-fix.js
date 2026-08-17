import fs from "node:fs";
import path from "node:path";
import homeHandler from "./home.js";

const BUSQUEDA_VERSION = "20260817-4";
const AUTOCOMPLETE_VERSION = "20260817-4";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buscarArchivoMunicipio(valor, codigoMunicipal = "") {
  let archivos = [];
  try {
    archivos = fs.readdirSync(path.join(process.cwd(), "municipios"));
  } catch {
    return "";
  }

  const paginas = archivos.filter(nombre =>
    nombre.endsWith(".html") && nombre !== "index.html"
  );

  const codigo = String(codigoMunicipal || "").trim();
  if (/^\d{5}$/.test(codigo)) {
    const porCodigo = paginas.filter(nombre =>
      nombre.toLowerCase().endsWith(`-${codigo}.html`)
    );
    if (porCodigo.length === 1) return porCodigo[0];
  }

  const termino = slugify(valor);
  if (!termino || termino.length < 3 || /^\d{5}$/.test(termino)) return "";

  const candidatos = paginas.filter(nombre => {
    const base = nombre.replace(/\.html$/i, "");
    return (
      base.startsWith(`${termino}-`) ||
      base.includes(`-${termino}-`) ||
      base === termino
    );
  });

  if (candidatos.length === 1) return candidatos[0];

  const exactos = candidatos.filter(nombre => {
    const sinCodigo = nombre.replace(/-\d{5}\.html$/i, "");
    return sinCodigo === termino || sinCodigo.endsWith(`-${termino}`);
  });

  return exactos.length === 1 ? exactos[0] : "";
}

function actualizarVersiones(html) {
  if (typeof html !== "string") return html;

  return html
    .replace(
      /js\/busqueda-url\.js(?:\?[^\"']*)?/g,
      `js/busqueda-url.js?v=${BUSQUEDA_VERSION}`
    )
    .replace(
      /js\/autocomplete-municipios\.js(?:\?[^\"']*)?/g,
      `js/autocomplete-municipios.js?v=${AUTOCOMPLETE_VERSION}`
    );
}

export default async function handler(request, response) {
  const poblacion = String(request.query?.poblacion || "").trim();
  const codigoMunicipal = String(request.query?.codigo_municipal || "").trim();
  const servicio = String(request.query?.servicio || "").trim();
  const archivoMunicipio = buscarArchivoMunicipio(poblacion, codigoMunicipal);

  if (archivoMunicipio) {
    const params = new URLSearchParams();
    if (servicio) params.set("servicio", servicio);
    const query = params.toString();
    const destino = `/municipios/${archivoMunicipio}${query ? `?${query}` : ""}#talleres`;
    response.setHeader("Cache-Control", "no-store");
    response.redirect(302, destino);
    return;
  }

  const sendOriginal = response.send.bind(response);
  response.send = (body) => sendOriginal(actualizarVersiones(body));

  return homeHandler(request, response);
}
