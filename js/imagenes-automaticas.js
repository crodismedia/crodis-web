(function () {
  "use strict";

  if (window.__TALLERMAP_IMAGENES_AUTOMATICAS__) return;
  window.__TALLERMAP_IMAGENES_AUTOMATICAS__ = true;

  function texto(valor) {
    return String(valor || "").replace(/\s+/g, " ").trim();
  }

  function ubicacionCorta(valor) {
    const limpia = texto(valor).replace(/^⌖\s*/, "");
    if (!limpia) return "Ubicación no indicada";
    const partes = limpia.split(",").map((p) => p.trim()).filter(Boolean);
    return partes.length > 2 ? partes.slice(-2).join(" · ") : partes.join(" · ");
  }

  function iniciales(nombre) {
    const palabras = texto(nombre).split(" ").filter(Boolean);
    if (!palabras.length) return "TM";
    return palabras.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  function hayImagenReal(contenedor) {
    return [...contenedor.querySelectorAll("img")].some((img) => texto(img.getAttribute("src")));
  }

  function crearPortada(nombre, ubicacion, grande) {
    const portada = document.createElement("div");
    portada.className = `tm-auto-portada${grande ? " tm-auto-portada-grande" : ""}`;
    portada.setAttribute("role", "img");
    portada.setAttribute("aria-label", `Portada automática de ${nombre}`);

    const marca = document.createElement("div");
    marca.className = "tm-auto-marca";
    const sello = document.createElement("span");
    sello.className = "tm-auto-sello";
    sello.textContent = iniciales(nombre);
    const brand = document.createElement("span");
    brand.textContent = "TallerMap";
    marca.append(sello, brand);

    const contenido = document.createElement("div");
    contenido.className = "tm-auto-contenido";
    const tipo = document.createElement("span");
    tipo.className = "tm-auto-tipo";
    tipo.textContent = "Taller mecánico";
    const titulo = document.createElement("strong");
    titulo.textContent = nombre;
    const lugar = document.createElement("span");
    lugar.className = "tm-auto-lugar";
    lugar.textContent = ubicacion;
    contenido.append(tipo, titulo, lugar);

    const pie = document.createElement("small");
    pie.textContent = "Directorio profesional de talleres";
    portada.append(marca, contenido, pie);
    return portada;
  }

  function asegurarTarjeta(tarjeta) {
    const contenedor = tarjeta.querySelector(".taller-imagen");
    if (!contenedor) return;
    const existente = contenedor.querySelector(":scope > .tm-auto-portada");
    if (hayImagenReal(contenedor)) {
      existente?.remove();
      return;
    }

    const nombre = texto(tarjeta.querySelector("h3")?.textContent) || "Taller sin nombre";
    const ubicacion = ubicacionCorta(tarjeta.querySelector(".ubicacion")?.textContent);
    if (!existente) contenedor.prepend(crearPortada(nombre, ubicacion, false));
  }

  function asegurarFicha() {
    const contenedor = document.getElementById("taller-foto");
    const nombre = texto(document.getElementById("taller-nombre")?.textContent);
    if (!contenedor || !nombre || nombre === "Ficha de taller") return;

    const existente = contenedor.querySelector(":scope > .tm-auto-portada");
    if (hayImagenReal(contenedor)) {
      existente?.remove();
      return;
    }

    const ubicacion = ubicacionCorta(document.getElementById("taller-direccion")?.textContent);
    if (!existente) contenedor.prepend(crearPortada(nombre, ubicacion, true));
    contenedor.hidden = false;
  }

  function revisar() {
    document.querySelectorAll(".taller-card").forEach(asegurarTarjeta);
    asegurarFicha();
  }

  function instalarEstilos() {
    if (document.getElementById("tm-auto-portadas-estilos")) return;
    const style = document.createElement("style");
    style.id = "tm-auto-portadas-estilos";
    style.textContent = `
      .taller-imagen,.ficha-publica-foto{position:relative;overflow:hidden}
      .tm-auto-portada{position:absolute;inset:0;z-index:0;display:flex;flex-direction:column;justify-content:space-between;gap:12px;padding:18px;background:linear-gradient(135deg,#101c15 0%,#173a25 58%,#138a43 100%);color:#fff;text-align:left}
      .tm-auto-portada::after{content:"";position:absolute;right:-42px;top:-52px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}
      .tm-auto-marca,.tm-auto-contenido,.tm-auto-portada small{position:relative;z-index:1}
      .tm-auto-marca{display:flex;align-items:center;gap:9px;font-weight:850;font-size:.88rem;letter-spacing:.01em}
      .tm-auto-sello{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:#fff;color:#116b35;font-size:.78rem;font-weight:950;box-shadow:0 5px 15px rgba(0,0,0,.14)}
      .tm-auto-contenido{display:grid;gap:4px;align-content:center}
      .tm-auto-tipo{font-size:.72rem;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#baf1cb}
      .tm-auto-contenido strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:1.22rem;line-height:1.08;letter-spacing:-.02em}
      .tm-auto-lugar{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;color:#e2efe6}
      .tm-auto-portada small{font-size:.68rem;color:#c7dccd}
      .taller-imagen>img{position:relative;z-index:1}
      .taller-imagen>.verificado{position:relative;z-index:3}
      .ficha-publica-foto:has(.tm-auto-portada-grande){min-height:330px}
      .tm-auto-portada-grande{padding:30px}
      .tm-auto-portada-grande .tm-auto-sello{width:48px;height:48px;font-size:1rem;border-radius:13px}
      .tm-auto-portada-grande .tm-auto-marca{font-size:1rem}
      .tm-auto-portada-grande .tm-auto-contenido strong{font-size:clamp(1.8rem,4vw,3.1rem);max-width:780px}
      .tm-auto-portada-grande .tm-auto-tipo{font-size:.86rem}
      .tm-auto-portada-grande .tm-auto-lugar{font-size:1rem}
      .ficha-publica-foto>img[src]:not([src=""]){position:relative;z-index:2}
      @media(max-width:600px){.ficha-publica-foto:has(.tm-auto-portada-grande){min-height:260px}.tm-auto-portada-grande{padding:22px}.tm-auto-portada{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function iniciar() {
    instalarEstilos();
    revisar();
    let temporizador = 0;
    new MutationObserver(() => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(revisar, 40);
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["src", "hidden"]
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}());
