(function () {
    "use strict";

    function iniciarBusquedaDesdeUrl() {
        const parametros = new URLSearchParams(window.location.search);
        const poblacion = (parametros.get("poblacion") || "").trim().slice(0, 80);
        const servicio = (parametros.get("servicio") || "").trim().slice(0, 80);
        if (!poblacion && !servicio) return;

        const formulario = document.getElementById("formulario-buscador-publico");
        const campoPoblacion = document.getElementById("poblacion");
        const campoServicio = document.getElementById("servicio");
        const listaTalleres = document.getElementById("lista-talleres");
        if (!formulario || !campoPoblacion || !campoServicio || !listaTalleres) return;

        if (poblacion) campoPoblacion.value = poblacion;
        if (servicio && [...campoServicio.options].some((opcion) => opcion.value === servicio)) {
            campoServicio.value = servicio;
        }

        let intentos = 0;
        const maximoIntentos = 80;
        const intervalo = window.setInterval(() => {
            intentos += 1;
            const texto = listaTalleres.textContent || "";
            const cargaInicialTerminada = !texto.includes("Cargando talleres");

            if (cargaInicialTerminada || intentos >= maximoIntentos) {
                window.clearInterval(intervalo);
                formulario.requestSubmit();
            }
        }, 100);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarBusquedaDesdeUrl, { once: true });
    } else {
        iniciarBusquedaDesdeUrl();
    }
}());
