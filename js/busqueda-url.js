(function () {
    "use strict";

    const normalizarTexto = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    function cargarMapaReal() {
        if (document.querySelector('script[data-tallermap-mapa="1"]')) return;
        const script = document.createElement("script");
        script.src = "/js/mapa-talleres.js?v=20260817-1";
        script.defer = true;
        script.dataset.tallermapMapa = "1";
        document.head.appendChild(script);
    }

    function obtenerPosicionActual() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 15000
            });
        });
    }

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const buscar = document.getElementById("boton-buscar");
        if (!formulario || !poblacion || !servicio || !buscar) return;

        formulario.querySelectorAll(".campo-icono").forEach(el => el.remove());
        const bloquePoblacion = poblacion.closest(".campo-busqueda");
        const contenidoPoblacion = bloquePoblacion?.querySelector(":scope > div");
        bloquePoblacion?.querySelectorAll("small").forEach(el => el.remove());

        const radioExistente = document.getElementById("radio-busqueda");
        radioExistente?.remove();
        const url = new URL(location.href);
        if (url.searchParams.has("radio")) {
            url.searchParams.delete("radio");
            history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
        }

        let estado = document.getElementById("estado-ubicacion");
        if (!estado) {
            estado = document.createElement("small");
            estado.id = "estado-ubicacion";
            estado.setAttribute("aria-live", "polite");
        }

        contenidoPoblacion?.appendChild(ubicacion);
        contenidoPoblacion?.appendChild(estado);
        contenidoPoblacion?.appendChild(buscar);

        ubicacion.onclick = async () => {
            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";
            estado.textContent = "Buscando tu ubicación…";
            try {
                const posicion = await obtenerPosicionActual();
                const parametros = new URLSearchParams({
                    format: "jsonv2",
                    lat: String(posicion.coords.latitude),
                    lon: String(posicion.coords.longitude),
                    zoom: "18",
                    addressdetails: "1",
                    "accept-language": "es"
                });
                const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?${parametros}`, {
                    headers: { Accept: "application/json" }
                });
                if (!respuesta.ok) throw new Error("No se pudo resolver la ubicación");

                const datos = await respuesta.json();
                const d = datos.address || {};
                const localidad = d.city || d.town || d.village || d.municipality || d.city_district || "";
                const cp = String(d.postcode || "").match(/^\d{5}$/)?.[0] || "";
                if (!localidad && !cp) throw new Error("No se pudo identificar la población");

                poblacion.value = localidad || cp;
                estado.textContent = localidad
                    ? `Ubicación detectada: ${localidad}${cp ? ` (${cp})` : ""}. Buscando talleres de esta población…`
                    : `Código postal detectado: ${cp}. Buscando talleres…`;

                formulario.requestSubmit();
            } catch (error) {
                console.error("Ubicación por población:", error);
                estado.textContent = "No se pudo obtener tu población. Revisa el permiso de ubicación.";
            } finally {
                ubicacion.disabled = false;
                ubicacion.textContent = "Usar mi ubicación";
            }
        };

        const params = new URLSearchParams(location.search);
        const poblacionUrl = params.get("poblacion");
        if (poblacionUrl && !poblacion.value) poblacion.value = poblacionUrl.slice(0, 80);
        const servicioUrl = normalizarTexto(params.get("servicio"));
        if (servicioUrl) {
            const opcion = [...servicio.options].find(o =>
                normalizarTexto(o.value) === servicioUrl || normalizarTexto(o.textContent) === servicioUrl
            );
            if (opcion) servicio.value = opcion.value;
        }
    }

    function iniciar() {
        prepararBuscador();
        cargarMapaReal();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());
