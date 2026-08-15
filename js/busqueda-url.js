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
        script.src = "/js/mapa-talleres.js?v=20260815-2";
        script.defer = true;
        script.dataset.tallermapMapa = "1";
        document.head.appendChild(script);
    }

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const buscar = document.getElementById("boton-buscar");
        if (!formulario || !poblacion || !servicio || !buscar) return;

        formulario.querySelectorAll(".campo-icono").forEach(el => el.remove());

        const bloquePoblacion = poblacion.closest(".campo-busqueda");
        const bloqueServicio = servicio.closest(".campo-busqueda");
        const contenidoPoblacion = bloquePoblacion?.querySelector(":scope > div");
        const contenidoServicio = bloqueServicio?.querySelector(":scope > div");

        bloquePoblacion?.querySelectorAll("small").forEach(el => el.remove());

        let radio = document.getElementById("radio-busqueda");
        if (!radio) {
            radio = document.createElement("select");
            radio.id = "radio-busqueda";
            radio.name = "radio";
            radio.setAttribute("aria-label", "Radio de búsqueda");
            radio.innerHTML = [
                '<option value="" selected>Distancia</option>',
                '<option value="1">1 km</option>',
                '<option value="2">2 km</option>',
                '<option value="3">3 km</option>',
                '<option value="4">4 km</option>',
                '<option value="5">5 km</option>',
                '<option value="6">6 km</option>',
                '<option value="7">7 km</option>',
                '<option value="8">8 km</option>',
                '<option value="9">9 km</option>',
                '<option value="10">10 km</option>'
            ].join("");
        } else if (![...radio.options].some(o => o.value === "")) {
            radio.insertAdjacentHTML("afterbegin", '<option value="">Distancia</option>');
        }

        const radioUrl = new URLSearchParams(location.search).get("radio");
        if (["1","2","3","4","5","6","7","8","9","10"].includes(radioUrl)) {
            radio.value = radioUrl;
        } else {
            radio.value = "";
        }

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
        }

        let estadoUbicacion = document.getElementById("estado-ubicacion");
        if (!estadoUbicacion) {
            estadoUbicacion = document.createElement("small");
            estadoUbicacion.id = "estado-ubicacion";
            estadoUbicacion.setAttribute("aria-live", "polite");
        }

        /* Escritorio: población + ubicación + buscar; servicio + radio. */
        contenidoPoblacion?.appendChild(ubicacion);
        contenidoPoblacion?.appendChild(estadoUbicacion);
        contenidoPoblacion?.appendChild(buscar);
        contenidoServicio?.appendChild(radio);

        const restaurarBotonUbicacion = () => {
            ubicacion.disabled = false;
            ubicacion.textContent = "Usar mi ubicación";
        };

        ubicacion.onclick = () => {
            if (!navigator.geolocation) {
                estadoUbicacion.textContent = "Este navegador no permite obtener la ubicación.";
                return;
            }

            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";
            estadoUbicacion.textContent = "Buscando una ubicación precisa…";

            navigator.geolocation.getCurrentPosition(async posicion => {
                try {
                    const precision = Number(posicion.coords.accuracy);
                    if (Number.isFinite(precision) && precision > 3000) {
                        estadoUbicacion.textContent = `La ubicación del dispositivo es demasiado imprecisa (±${Math.round(precision / 1000)} km). Escribe tu población para evitar resultados incorrectos.`;
                        return;
                    }

                    const parametros = new URLSearchParams({
                        format: "jsonv2",
                        lat: String(posicion.coords.latitude),
                        lon: String(posicion.coords.longitude),
                        zoom: "18",
                        addressdetails: "1",
                        "accept-language": "es"
                    });

                    const respuesta = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?${parametros}`,
                        { headers: { Accept: "application/json" } }
                    );
                    if (!respuesta.ok) throw new Error("No se pudo resolver la ubicación");

                    const datos = await respuesta.json();
                    const direccion = datos.address || {};
                    const localidad = direccion.town || direccion.village || direccion.city
                        || direccion.municipality || direccion.city_district || "";
                    const codigoPostal = String(direccion.postcode || "").match(/^\d{5}$/)?.[0] || "";
                    const terminoBusqueda = localidad || codigoPostal;

                    if (terminoBusqueda) {
                        poblacion.value = terminoBusqueda;
                        estadoUbicacion.textContent = localidad
                            ? `Ubicación detectada: ${localidad}${codigoPostal ? ` (${codigoPostal})` : ""}.`
                            : `Ubicación detectada: ${codigoPostal}.`;
                    } else {
                        estadoUbicacion.textContent = "No se pudo identificar la población con suficiente precisión. Escríbela manualmente.";
                    }
                } catch (_) {
                    estadoUbicacion.textContent = "No se pudo identificar tu ubicación. Puedes escribir la población manualmente.";
                } finally {
                    restaurarBotonUbicacion();
                }
            }, () => {
                estadoUbicacion.textContent = "No se pudo obtener una ubicación precisa. Revisa el permiso de ubicación o escribe la población.";
                restaurarBotonUbicacion();
            }, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            });
        };

        const params = new URLSearchParams(location.search);
        const poblacionUrl = params.get("poblacion");
        if (poblacionUrl && !poblacion.value) poblacion.value = poblacionUrl.slice(0, 80);

        const servicioUrl = normalizarTexto(params.get("servicio"));
        if (servicioUrl) {
            const opcion = [...servicio.options].find(o =>
                normalizarTexto(o.value) === servicioUrl
                || normalizarTexto(o.textContent) === servicioUrl
            );
            if (opcion) servicio.value = opcion.value;
        }

        let estilos = document.getElementById("layout-buscador-final");
        if (!estilos) {
            estilos = document.createElement("style");
            estilos.id = "layout-buscador-final";
            estilos.textContent = `
                #formulario-buscador-publico{
                    display:grid!important;
                    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
                    gap:0!important;
                    align-items:stretch!important;
                    padding:22px!important;
                }
                #formulario-buscador-publico>.campo-busqueda{display:block!important;min-width:0!important;position:relative!important;inset:auto!important;transform:none!important;margin:0!important;box-sizing:border-box!important}
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(1){grid-column:1!important;grid-row:1!important;border-right:1px solid #dfe6ef!important;padding:8px 28px 8px 8px!important}
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:2!important;grid-row:1!important;padding:8px 8px 8px 28px!important}
                #formulario-buscador-publico>.campo-busqueda>div{display:flex!important;flex-direction:column!important;width:100%!important;min-width:0!important;position:static!important;transform:none!important}
                #formulario-buscador-publico label{display:block!important;margin:0 0 8px!important;line-height:1.25!important}
                #formulario-buscador-publico .poblacion-controles{display:block!important;width:100%!important;position:static!important}
                #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{display:block!important;width:100%!important;min-width:0!important;min-height:48px!important;box-sizing:border-box!important;border:1px solid #cfd8e3!important;border-radius:9px!important;background:#fff!important;color:#162033!important;padding:10px 12px!important;font:inherit!important;position:static!important;transform:none!important}
                #formulario-buscador-publico #radio-busqueda{margin:12px 0 0!important}
                #formulario-buscador-publico #usar-mi-ubicacion,#formulario-buscador-publico #boton-buscar{display:flex!important;position:static!important;inset:auto!important;transform:none!important;width:100%!important;max-width:none!important;min-height:48px!important;box-sizing:border-box!important;margin:12px 0 0!important;align-items:center!important;justify-content:center!important;padding:10px 16px!important;border-radius:10px!important;font-weight:800!important;white-space:normal!important;text-align:center!important}
                #formulario-buscador-publico #estado-ubicacion{display:block!important;min-height:0!important;margin:7px 0 0!important;color:#64748b!important;font-size:.74rem!important;line-height:1.35!important}
                #formulario-buscador-publico #estado-ubicacion:empty{display:none!important}
                #formulario-buscador-publico #usar-mi-ubicacion{background:#F59E0B!important;border:1px solid #F59E0B!important;color:#fff!important;box-shadow:none!important}
                #formulario-buscador-publico #boton-buscar{background:#07883F!important;border:1px solid #07883F!important;color:#fff!important;box-shadow:none!important}
                @media(max-width:1050px){
                    #formulario-buscador-publico{grid-template-columns:1fr!important;gap:10px!important;padding:12px!important}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1),#formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:1!important;grid-row:auto!important;border-right:0!important;border-bottom:0!important;padding:6px!important}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div{display:flex!important}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div>label{order:1}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div>.poblacion-controles{order:2}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div>#boton-buscar{order:3}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div>#usar-mi-ubicacion{order:4}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1)>div>#estado-ubicacion{order:5}
                    #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{font-size:16px!important}
                }
            `;
            document.head.appendChild(estilos);
        }
    }

    function iniciarBuscadorYMapa() {
        prepararBuscador();
        cargarMapaReal();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarBuscadorYMapa, { once: true });
    } else {
        iniciarBuscadorYMapa();
    }
}());
