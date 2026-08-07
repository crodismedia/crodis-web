(function () {
  "use strict";

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

  cargar("/js/imagenes-automaticas.js", "data-tallermap-imagenes-auto");
  cargar("/js/taller-urls-core.js", "data-tallermap-urls-core");

  if (window.location.pathname === "/pages/taller.html" || window.location.pathname.startsWith("/talleres/")) {
    cargarEstilo("/css/valoraciones.css", "data-tallermap-valoraciones-css");
    cargar("/js/valoraciones.js", "data-tallermap-valoraciones");
    cargar("/js/reclamar-link.js", "data-tallermap-reclamar-link");
  }
}());
