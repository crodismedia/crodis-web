(() => {
  "use strict";

  const STYLE_ID = "tm-fichas-publicas-alicante-style";

  function asegurarEstilo() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .taller-card.tm-ficha-alicante .taller-contactos .tm-como-llegar-alicante {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:46px;
        padding:12px 16px;
        border:1px solid #df7418;
        border-radius:12px;
        background:linear-gradient(135deg,#f5a23b,#ed7f1d);
        color:#fff!important;
        -webkit-text-fill-color:#fff!important;
        font-weight:900;
        text-decoration:none;
        box-shadow:0 9px 20px rgba(237,127,29,.25);
        transition:transform .16s ease,filter .16s ease,box-shadow .16s ease;
      }
      .taller-card.tm-ficha-alicante .taller-contactos .tm-como-llegar-alicante:hover {
        filter:brightness(.96);
        transform:translateY(-1px);
        box-shadow:0 12px 24px rgba(237,127,29,.31);
      }
      .taller-card.tm-ficha-alicante .taller-contactos .tm-como-llegar-alicante:focus-visible {
        outline:3px solid rgba(245,162,59,.34);
        outline-offset:2px;
      }
    `;
    document.head.appendChild(style);
  }

  function esAlicante(tarjeta) {
    const ubicacion = String(tarjeta.querySelector(".ubicacion")?.textContent || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return ubicacion.includes("alicante") || ubicacion.includes("alacant");
  }

  function nombreTaller(tarjeta) {
    return String(tarjeta.querySelector("h3")?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function ubicacionTaller(tarjeta) {
    return String(tarjeta.querySelector(".ubicacion")?.textContent || "")
      .replace(/^\s*[⌖✦◆•]+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function prepararTarjeta(tarjeta) {
    if (!(tarjeta instanceof HTMLElement) || !esAlicante(tarjeta)) return;
    tarjeta.classList.add("tm-ficha-alicante");

    const pie = tarjeta.querySelector(".taller-contactos");
    if (!pie) return;

    let enlace = pie.querySelector(".enlace-google-maps, .accion-mapa, a[href*='google.com/maps']");
    const nombre = nombreTaller(tarjeta);
    const ubicacion = ubicacionTaller(tarjeta);
    if (!ubicacion) return;

    const destino = [nombre, ubicacion, "España"].filter(Boolean).join(", ");
    const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;

    if (!enlace) {
      enlace = document.createElement("a");
      pie.appendChild(enlace);
    }

    enlace.href = href;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.classList.remove("enlace-google-maps");
    enlace.classList.add("tm-como-llegar-alicante");
    enlace.textContent = "Cómo llegar";
    enlace.setAttribute("aria-label", `Cómo llegar a ${nombre || "este taller"}`);
  }

  function prepararTodas() {
    document.querySelectorAll(".taller-card").forEach(prepararTarjeta);
  }

  function iniciar() {
    asegurarEstilo();
    prepararTodas();
    const lista = document.getElementById("lista-talleres") || document.body;
    const observer = new MutationObserver(() => prepararTodas());
    observer.observe(lista, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
