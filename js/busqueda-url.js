(function () {
    "use strict";

    const PROVINCIAS_POR_PREFIJO = {
        "03": "Alicante",
        "12": "Castellón",
        "46": "Valencia"
    };

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function provinciaMunicipio(codigoMunicipal) {
        const codigo = String(codigoMunicipal || "")
            .padStart(5, "0");

        return PROVINCIAS_POR_PREFIJO[codigo.slice(0, 2)]
            || "Provincia no indicada";
    }

    function prioridadCoincidencia(municipio, termino) {
        const nombre = normalizarTexto(municipio.nombre);
        const codigo = String(
            municipio.codigo_municipal || ""
        );

        if (nombre === termino || codigo === termino) {
            return 0;
        }

        if (
            nombre.startsWith(termino)
            || codigo.startsWith(termino)
        ) {
            return 1;
        }

        return 2;
    }

    async function iniciarAutocompletado() {
        const campoPoblacion = document.getElementById(
            "poblacion"
        );

        if (
            !campoPoblacion
            || !window.supabaseClient?.from
        ) {
            return;
        }

        let lista = document.getElementById(
            "sugerencias-poblaciones"
        );

        if (!lista) {
            lista = document.createElement("datalist");
            lista.id = "sugerencias-poblaciones";
            document.body.appendChild(lista);
        }

        campoPoblacion.setAttribute("list", lista.id);
        campoPoblacion.setAttribute(
            "autocomplete",
            "off"
        );

        const { data, error } = await window.supabaseClient
            .from("municipios")
            .select("nombre,codigo_municipal")
            .eq("activo", true)
            .order("nombre", { ascending: true });

        if (error) {
            console.error(
                "No se pudieron cargar las sugerencias de población:",
                error
            );

            return;
        }

        const municipios = Array.isArray(data)
            ? data
            : [];

        let temporizador = null;

        function rellenarSugerencias() {
            const termino = normalizarTexto(
                campoPoblacion.value
            );

            lista.replaceChildren();

            if (termino.length < 2) {
                return;
            }

            municipios
                .filter(municipio => {
                    const nombre = normalizarTexto(
                        municipio.nombre
                    );

                    const codigo = String(
                        municipio.codigo_municipal || ""
                    );

                    return (
                        nombre.includes(termino)
                        || codigo.includes(termino)
                    );
                })
                .sort((a, b) => {
                    const diferencia =
                        prioridadCoincidencia(a, termino)
                        - prioridadCoincidencia(b, termino);

                    if (diferencia) {
                        return diferencia;
                    }

                    return String(a.nombre || "")
                        .localeCompare(
                            String(b.nombre || ""),
                            "es",
                            { sensitivity: "base" }
                        );
                })
                .slice(0, 12)
                .forEach(municipio => {
                    const opcion =
                        document.createElement("option");

                    const codigo = String(
                        municipio.codigo_municipal || ""
                    );

                    const provincia =
                        provinciaMunicipio(codigo);

                    opcion.value = municipio.nombre || "";

                    opcion.label = codigo
                        ? `${provincia} · código municipal ${codigo}`
                        : provincia;

                    lista.appendChild(opcion);
                });
        }

        campoPoblacion.addEventListener(
            "input",
            () => {
                window.clearTimeout(temporizador);

                temporizador = window.setTimeout(
                    rellenarSugerencias,
                    120
                );
            }
        );

        campoPoblacion.addEventListener(
            "focus",
            rellenarSugerencias
        );
    }

    function obtenerPosicionActual() {
        return new Promise((resolve, reject) => {
            if (!window.isSecureContext) {
                reject(
                    new Error("contexto-no-seguro")
                );

                return;
            }

            if (!navigator.geolocation) {
                reject(
                    new Error(
                        "geolocation-no-disponible"
                    )
                );

                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 300000
                }
            );
        });
    }

    async function obtenerPoblacionDesdeCoordenadas(
        latitud,
        longitud
    ) {
        const parametros = new URLSearchParams({
            format: "jsonv2",
            lat: String(latitud),
            lon: String(longitud),
            zoom: "10",
            addressdetails: "1",
            "accept-language": "es"
        });

        const respuesta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${parametros.toString()}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                referrerPolicy:
                    "strict-origin-when-cross-origin"
            }
        );

        if (!respuesta.ok) {
            throw new Error(
                "geocodificacion-no-disponible"
            );
        }

        const datos = await respuesta.json();
        const direccion = datos?.address || {};

        return String(
            direccion.city
            || direccion.town
            || direccion.village
            || direccion.municipality
            || direccion.county
            || ""
        ).trim();
    }

    function mensajeErrorUbicacion(error) {
        if (error?.code === 1) {
            return (
                "El permiso de ubicación está bloqueado. " +
                "Actívalo en el navegador y vuelve a intentarlo."
            );
        }

        if (error?.code === 2) {
            return (
                "El dispositivo no ha podido determinar tu ubicación. " +
                "Comprueba que la ubicación esté activada."
            );
        }

        if (error?.code === 3) {
            return (
                "La ubicación ha tardado demasiado. " +
                "Vuelve a intentarlo."
            );
        }

        if (
            error?.message ===
            "contexto-no-seguro"
        ) {
            return (
                "La ubicación solo funciona desde " +
                "la versión HTTPS de TallerMap."
            );
        }

        if (
            error?.message ===
            "geocodificacion-no-disponible"
        ) {
            return (
                "Se obtuvo tu posición, pero no se pudo " +
                "identificar la población. Escríbela manualmente."
            );
        }

        return (
            "No se pudo detectar tu ubicación. " +
            "Puedes escribir la población manualmente."
        );
    }

    function iniciarBusquedaPorUbicacion() {
        const controles = document.querySelector(
            ".poblacion-controles"
        );

        const campoPoblacion = document.getElementById(
            "poblacion"
        );

        const formulario = document.getElementById(
            "formulario-buscador-publico"
        );

        if (
            !controles
            || !campoPoblacion
            || !formulario
        ) {
            return;
        }

        let boton = document.getElementById(
            "usar-mi-ubicacion"
        );

        if (!boton) {
            boton = document.createElement("button");
            boton.id = "usar-mi-ubicacion";
            boton.type = "button";

            boton.className =
                "boton boton-claro boton-pequeno";

            boton.innerHTML =
                '<span aria-hidden="true">⌖</span> ' +
                "Usar mi ubicación";

            boton.style.marginTop = "8px";

            controles.insertAdjacentElement(
                "afterend",
                boton
            );
        }

        let estado = document.getElementById(
            "estado-ubicacion"
        );

        if (!estado) {
            estado = document.createElement("small");
            estado.id = "estado-ubicacion";
            estado.setAttribute(
                "aria-live",
                "polite"
            );

            boton.insertAdjacentElement(
                "afterend",
                estado
            );
        }

        boton.addEventListener(
            "click",
            async () => {
                boton.disabled = true;
                boton.textContent = "Localizando…";

                estado.textContent =
                    "Solicitando permiso de ubicación…";

                estado.classList.remove(
                    "estado-ubicacion-error"
                );

                try {
                    const posicion =
                        await obtenerPosicionActual();

                    const latitud = Number(
                        posicion.coords.latitude
                    );

                    const longitud = Number(
                        posicion.coords.longitude
                    );

                    if (
                        !Number.isFinite(latitud)
                        || !Number.isFinite(longitud)
                    ) {
                        throw new Error(
                            "coordenadas-no-validas"
                        );
                    }

                    estado.textContent =
                        "Identificando tu población…";

                    const poblacion =
                        await obtenerPoblacionDesdeCoordenadas(
                            latitud,
                            longitud
                        );

                    if (!poblacion) {
                        throw new Error(
                            "geocodificacion-no-disponible"
                        );
                    }

                    campoPoblacion.value = poblacion;

                    campoPoblacion.dispatchEvent(
                        new Event(
                            "input",
                            { bubbles: true }
                        )
                    );

                    estado.textContent =
                        `Ubicación detectada: ${poblacion}. ` +
                        "Buscando talleres…";

                    formulario.requestSubmit();
                } catch (error) {
                    console.error(
                        "No se pudo usar la ubicación:",
                        error
                    );

                    estado.textContent =
                        mensajeErrorUbicacion(error);

                    estado.classList.add(
                        "estado-ubicacion-error"
                    );
                } finally {
                    boton.disabled = false;

                    boton.innerHTML =
                        '<span aria-hidden="true">⌖</span> ' +
                        "Usar mi ubicación";
                }
            }
        );
    }

    function restaurarCamposDesdeUrl() {
        const parametros = new URLSearchParams(
            window.location.search
        );

        const poblacion = String(
            parametros.get("poblacion") || ""
        )
            .trim()
            .slice(0, 80);

        const servicio = String(
            parametros.get("servicio") || ""
        )
            .trim()
            .slice(0, 80);

        const campoPoblacion =
            document.getElementById("poblacion");

        const campoServicio =
            document.getElementById("servicio");

        if (
            campoPoblacion
            && poblacion
            && !campoPoblacion.value
        ) {
            campoPoblacion.value = poblacion;
        }

        /*
         * Solo restauramos visualmente el selector.
         * No enviamos el formulario aquí.
         * js/supabase.js realiza la búsqueda inicial.
         */
        if (campoServicio && servicio) {
            const aplicarServicio = () => {
                const existe =
                    [...campoServicio.options].some(
                        opcion =>
                            opcion.value === servicio
                    );

                if (existe) {
                    campoServicio.value = servicio;
                    return true;
                }

                return false;
            };

            if (!aplicarServicio()) {
                let intentos = 0;

                const intervalo =
                    window.setInterval(() => {
                        intentos += 1;

                        if (
                            aplicarServicio()
                            || intentos >= 30
                        ) {
                            window.clearInterval(
                                intervalo
                            );
                        }
                    }, 100);
            }
        }
    }

    function iniciar() {
        restaurarCamposDesdeUrl();
        iniciarAutocompletado();
        iniciarBusquedaPorUbicacion();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            { once: true }
        );
    } else {
        iniciar();
    }
}());
