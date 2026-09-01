(function () {
  "use strict";

  const SITE_URL = "https://www.tallermap.es";

  // ============ UTILIDADES ============
  function cargar(src, atributo) {
    if (document.querySelector(script[${atributo}])) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.async = false;
    script.setAttribute(atributo, "true");
    document.head.appendChild(script);
  }

  function cargarEstilo(href, atributo) {
    if (document.querySelector(link[${atributo}])) return;
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

  // ============ REPARAR MIGAS ESTRUCTURADAS ============
  function repararMigasEstructuradas() {
    try {
      const script = document.getElementById("datos-estructurados-migas");
      if (!script) return;

      // Verificar si ya tiene datos válidos
      try {
        const existente = JSON.parse(script.textContent);
        if (existente && existente['@type'] === 'BreadcrumbList' && 
            existente.itemListElement && existente.itemListElement.length >= 3) {
          return; // Ya existe breadcrumb completo
        }
      } catch (_) {
        // Si no es válido, continuar con la reparación
      }

      const parametros = new URLSearchParams(window.location.search);
      const slugRuta = window.location.pathname.startsWith("/talleres/")
        ? decodeURIComponent(window.location.pathname.slice("/talleres/".length).split("/")[0] || "")
        : "";
      const slug = slugSeguro(slugRuta || parametros.get("slug") || "");
      const nombre = String(
        parametros.get("nombre") || 
        document.getElementById("taller-nombre")?.textContent || 
        "Ficha de taller"
      ).trim();
      
      // CORREGIDO: No codificar el slug
      const canonical = slug ? ${SITE_URL}/talleres/${slug} : ${SITE_URL}${window.location.pathname};
      
      // CORREGIDO: Añadir nivel "Talleres"
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            item: ${SITE_URL}/
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Talleres",
            item: ${SITE_URL}/talleres/
          },
          {
            "@type": "ListItem",
            position: 3,
            name: nombre || "Ficha de taller",
            item: canonical
          }
        ]
      });
    } catch (error) {
      console.warn("Error reparando migas estructuradas:", error);
    }
  }

  // ============ REPARAR MENÚ DESGUACES MÓVIL ============
  function repararMenuDesguacesMovil() {
    try {
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
    } catch (error) {
      console.warn("Error reparando menú desguaces móvil:", error);
    }
  }

  // ============ DETECTAR PÁGINA DE TALLER ============
  function esPaginaTaller() {
    const path = window.location.pathname;
    return path === "/pages/taller.html" || 
           path.startsWith("/talleres/") ||
           document.querySelector(".taller-card, #taller-nombre") !== null;
  }

  // ============ INICIALIZACIÓN ============
  function inicializar() {
    repararMigasEstructuradas();
    repararMenuDesguacesMovil();

    // Cargar recursos base
    cargar("/js/imagenes-automaticas.js?v=20260810-2", "data-tallermap-imagenes-auto");
    cargar("/js/taller-urls-core.js?v=20260828-2", "data-tallermap-urls-core");

    // Cargar recursos específicos de taller
    if (esPaginaTaller()) {
      cargarEstilo("/css/valoraciones.css", "data-tallermap-valoraciones-css");
      cargar("/js/valoraciones.js", "data-tallermap-valoraciones");
      cargar("/js/reclamacion-link.js", "data-tallermap-reclamacion-link");
    }

    // Observer para cambios dinámicos
    const observer = new MutationObserver(() => {
      if (esPaginaTaller()) {
        cargarEstilo("/css/valoraciones.css", "data-tallermap-valoraciones-css");
        cargar("/js/valoraciones.js", "data-tallermap-valoraciones");
        cargar("/js/reclamacion-link.js", "data-tallermap-reclamacion-link");
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ============ EJECUCIÓN ============
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializar, { once: true });
  } else {
    inicializar();
  }
}());
