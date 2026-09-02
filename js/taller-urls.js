(function () {
  "use strict";

  const SITE_URL = "https://www.tallermap.es";

  function cargar(src, atributo) {
    if (document.querySelector(`script[${atributo}]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.async = false;
    script.setAttribute(atributo, "true");
    document.head.appendChild(script);
  }

  function cargarEstilo(href, atributo) {
    if (document.querySelector(`link[${atributo}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(atributo, "true");
    document.head.appendChild(link);
  }

  function slugSeguro(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function repararMigasEstructuradas() {
    const script = document.getElementById("datos-estructurados-migas");
    if (!script) return;

    const parametros = new URLSearchParams(window.location.search);
    const slugRuta = window.location.pathname.startsWith("/talleres/")
      ? decodeURIComponent(window.location.pathname.slice("/talleres/".length).split("/")[0] || "")
      : "";
    const slug = slugSeguro(slugRuta || parametros.get("slug") || "");
    const nombre = String(parametros.get("nombre") || document.getElementById("taller-nombre")?.textContent || "Ficha de taller").trim();
    const canonical = slug ? `${SITE_URL}/talleres/${encodeURIComponent(slug)}` : `${SITE_URL}${window.location.pathname}`;

    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Inicio",
          item: `${SITE_URL}/`
        },
        {
          "@type": "ListItem",
          position: 2,
          name: nombre || "Ficha de taller",
          item: canonical
        }
      ]
    });
  }

  function repararMenuDesguacesMovil() {
    if (!document.getElementById("tm-desguaces-movil-cerrado")) {
      const estilo = document.createElement("style");
      estilo.id = "tm-desguaces-movil-cerrado";
      estilo.textContent = `
        @media (max-width: 1050px) {
          .menu-movil-panel .tm-desguaces-submenu {
            display: none !important;
          }
          .menu-movil-panel .tm-desguaces-menu.abierto .tm-desguaces-submenu {
            display: grid !important;
          }
        }
      `;
      document.head.appendChild(estilo);
    }

    if (document.documentElement.dataset.tmDesguacesMovilClick) return;
    document.documentElement.dataset.tmDesguacesMovilClick = "1";

    document.addEventListener("click", event => {
      const enlace = event.target.closest(".menu-movil-panel .tm-desguaces-menu > a");
      if (!enlace || !window.matchMedia("(max-width: 1050px)").matches) return;

      event.preventDefault();
      event.stopPropagation();

      const menu = enlace.closest(".tm-desguaces-menu");
      if (!menu) return;

      const abrir = !menu.classList.contains("abierto");
      menu.classList.toggle("abierto", abrir);
      enlace.setAttribute("aria-expanded", abrir ? "true" : "false");
      enlace.setAttribute("aria-haspopup", "true");
    }, true);
  }

  repararMigasEstructuradas();
  repararMenuDesguacesMovil();

  cargar("/js/imagenes-automaticas.js?v=20260810-2", "data-tallermap-imagenes-auto");
  cargar("/js/taller-urls-core.js?v=20260902-4", "data-tallermap-urls-core");

  if (window.location.pathname === "/pages/taller.html" || window.location.pathname.startsWith("/talleres/")) {
    cargarEstilo("/css/valoraciones.css", "data-tallermap-valoraciones-css");
    cargar("/js/valoraciones.js", "data-tallermap-valoraciones");
    cargar("/js/reclamacion-link.js", "data-tallermap-reclamacion-link");
  }
}());
