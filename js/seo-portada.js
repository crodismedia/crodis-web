(function () {
    "use strict";

    function mejorarContenidoInicial() {
        document.querySelector(".franja-reloj")?.remove();

        const titulo = document.querySelector(".hero-texto h1");
        if (titulo) {
            titulo.innerHTML = "Encuentra talleres mecánicos <span>cerca de ti</span>";
        }

        const contador = document.getElementById("contador-altas-cabecera");
        if (contador && !contador.textContent.trim().match(/\d/)) contador.textContent = "Directorio";

        const estadisticaTalleres = document.getElementById("estadistica-talleres");
        const estadisticaProvincias = document.getElementById("estadistica-provincias");
        const estadisticaServicios = document.getElementById("estadistica-servicios");
        if (estadisticaTalleres && !estadisticaTalleres.textContent.trim().match(/\d/)) estadisticaTalleres.textContent = "Actualizado";
        if (estadisticaProvincias && !estadisticaProvincias.textContent.trim().match(/\d/)) estadisticaProvincias.textContent = "España";
        if (estadisticaServicios && !estadisticaServicios.textContent.trim().match(/\d/)) estadisticaServicios.textContent = "50+";

        const talleres = document.getElementById("lista-talleres");
        const mensaje = talleres?.querySelector(".mensaje-talleres");
        if (mensaje && /cargando/i.test(mensaje.textContent)) {
            mensaje.textContent = "Consulta talleres publicados por población, código postal o servicio. Los resultados se actualizan automáticamente.";
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mejorarContenidoInicial, { once: true });
    } else {
        mejorarContenidoInicial();
    }
}());
