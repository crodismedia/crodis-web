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

  cargar("/js/imagenes-automaticas.js", "data-tallermap-imagenes-auto");
  cargar("/js/taller-urls-core.js", "data-tallermap-urls-core");
}());
