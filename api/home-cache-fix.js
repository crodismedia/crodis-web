import fs from "node:fs";
import path from "node:path";
import homeHandler from "./home.js";

const BUSQUEDA_VERSION = "20260817-6";
const AUTOCOMPLETE_VERSION = "20260817-6";
const FICHAS_ALICANTE_VERSION = "20260818-1";
const SERVICIOS_SEO = new Set([
  "mecanica-general","frenos","embrague","cambio-aceite-filtros","correa-distribucion","cadena-distribucion","pre-itv","reparacion-motor","caja-cambios","sistema-refrigeracion","escape-catalizador","baterias","electricidad-automovil","alternador-motor-arranque","centralitas-electronica","suspension-amortiguadores","alineacion-direccion","equilibrado-ruedas","neumaticos","lunas-cristales","carroceria","chapa-pintura","diagnosis-electronica","aire-acondicionado","calefaccion-climatizacion","hibridos-electricos"
]);

const ROUTER_GLOBAL = `
<script>
(function(){
  document.addEventListener('submit', function(event){
    var form = event.target;
    if (!form || form.id !== 'formulario-buscador-publico') return;

    var poblacion = document.getElementById('poblacion');
    var servicio = document.getElementById('servicio');
    var nombre = String(poblacion && poblacion.value || '').trim();
    if (!nombre) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    var params = new URLSearchParams();
    params.set('poblacion', nombre);

    var codigo = String(poblacion && poblacion.dataset.codigoMunicipal || '').trim();
    if (/^\d{5}$/.test(codigo)) params.set('codigo_municipal', codigo);

    var servicioSeleccionado = String(servicio && servicio.value || '').trim();
    if (servicioSeleccionado) params.set('servicio', servicioSeleccionado);

    window.location.assign('/?' + params.toString() + '#talleres');
  }, true);
}());
</script>
`;

const ENLACES_SERVICIO_LIMPIOS = `
<script data-tm-enlaces-servicio="1">
(function(){
  var permitidos = new Set([
    'mecanica-general','frenos','embrague','cambio-aceite-filtros','correa-distribucion','cadena-distribucion','pre-itv','reparacion-motor','caja-cambios','sistema-refrigeracion','escape-catalizador','baterias','electricidad-automovil','alternador-motor-arranque','centralitas-electronica','suspension-amortiguadores','alineacion-direccion','equilibrado-ruedas','neumaticos','lunas-cristales','carroceria','chapa-pintura','diagnosis-electronica','aire-acondicionado','calefaccion-climatizacion','hibridos-electricos'
  ]);
  function limpiar(){
    document.querySelectorAll('[data-servicio]').forEach(function(enlace){
      var slug = String(enlace.getAttribute('data-servicio') || '').trim().toLowerCase();
      if (permitidos.has(slug)) enlace.setAttribute('href', '/servicios/' + slug + '.html');
    });
    document.querySelectorAll('a[href^="/desguaces.html?provincia="]').forEach(function(enlace){
      try {
        var url = new URL(enlace.getAttribute('href'), window.location.origin);
        var provincia = String(url.searchParams.get('provincia') || '').toLowerCase();
        if (['alicante','castellon','valencia'].includes(provincia)) {
          enlace.setAttribute('href', '/desguaces.html#' + provincia);
        }
      } catch (_error) {}
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(limpiar, 0); }, { once: true });
  } else {
    setTimeout(limpiar, 0);
  }
}());
</script>
`;

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

function limpiarEnlacesServicioHTML(html) {
  return String(html || "")
    .replace(/href="\/?\?servicio=([a-z0-9-]+)#talleres"/gi, (match, slug) => (
      SERVICIOS_SEO.has(String(slug).toLowerCase())
        ? `href="/servicios/${String(slug).toLowerCase()}.html"`
        : match
    ))
    .replace(/href="\.\.\/\?servicio=([a-z0-9-]+)#talleres"/gi, (match, slug) => (
      SERVICIOS_SEO.has(String(slug).toLowerCase())
        ? `href="/servicios/${String(slug).toLowerCase()}.html"`
        : match
    ));
}

function actualizarVersiones(html) {
  if (typeof html !== "string") return html;

  let output = limpiarEnlacesServicioHTML(html)
    .replace(/<a href="\/coches\.html">Coches<\/a>/gi, "")
    .replace(
      /js\/busqueda-url\.js(?:\?[^\"']*)?/g,
      `js/busqueda-url.js?v=${BUSQUEDA_VERSION}`
    )
    .replace(
      /js\/autocomplete-municipios\.js(?:\?[^\"']*)?/g,
      `js/autocomplete-municipios.js?v=${AUTOCOMPLETE_VERSION}`
    );

  if (!output.includes("params.set('codigo_municipal'")) {
    output = output.replace(/<\/body>/i, `${ROUTER_GLOBAL}</body>`);
  }

  if (!output.includes('data-tm-enlaces-servicio="1"')) {
    output = output.replace(/<\/body>/i, `${ENLACES_SERVICIO_LIMPIOS}</body>`);
  }

  if (!output.includes("fichas-publicas-alicante.js")) {
    output = output.replace(
      /<\/body>/i,
      `<script defer src="/js/fichas-publicas-alicante.js?v=${FICHAS_ALICANTE_VERSION}"></script></body>`
    );
  }

  return output;
}

function forzarNoindexBusqueda(html) {
  if (typeof html !== "string") return html;
  return html.replace(
    /<meta name="robots" content="[^"]*">/i,
    '<meta name="robots" content="noindex,follow,max-image-preview:large">'
  );
}

export default async function handler(request, response) {
  const poblacion = String(request.query?.poblacion || "").trim();
  const codigoMunicipal = String(request.query?.codigo_municipal || "").trim();
  const servicio = String(request.query?.servicio || "").trim();
  const pagina = String(request.query?.pagina || "").trim();
  const servicioSlug = slugify(servicio);

  if (!poblacion && !codigoMunicipal && SERVICIOS_SEO.has(servicioSlug)) {
    response.setHeader("Cache-Control", "no-store");
    response.redirect(301, `/servicios/${servicioSlug}.html`);
    return;
  }

  const archivoMunicipio = buscarArchivoMunicipio(poblacion, codigoMunicipal);

  if (archivoMunicipio) {
    const params = new URLSearchParams();
    if (servicio) params.set("servicio", servicio);
    const query = params.toString();
    const destino = `/municipios/${archivoMunicipio}${query ? `?${query}` : ""}#talleres`;
    response.setHeader("Cache-Control", "no-store");
    response.redirect(servicio ? 302 : 301, destino);
    return;
  }

  const esBusqueda = Boolean(poblacion || codigoMunicipal || servicio || pagina);
  const sendOriginal = response.send.bind(response);
  response.send = (body) => {
    let output = actualizarVersiones(body);
    if (esBusqueda) {
      output = forzarNoindexBusqueda(output);
      response.setHeader("X-Robots-Tag", "noindex, follow");
    }
    return sendOriginal(output);
  };

  return homeHandler(request, response);
}
