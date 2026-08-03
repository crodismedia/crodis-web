(function () {
    "use strict";

    const PROVINCIAS_POR_PREFIJO = {
        "03": "Alicante",
        "12": "Castellón",
        "46": "Valencia"
    };
    const LIMITE_CERCANOS = 8;
    const RADIOS_CERCANOS_KM = [1, 3, 5];

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escaparHTML(valor) {
        if (window.escaparHTML) return window.escaparHTML(valor);
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function provinciaMunicipio(codigoMunicipal) {
        const codigo = String(codigoMunicipal || "").padStart(5, "0");
        return PROVINCIAS_POR_PREFIJO[codigo.slice(0, 2)] || "Provincia no indicada";
    }

    function prioridadCoincidencia(municipio, termino) {
        const nombre = normalizarTexto(municipio.nombre);
        const codigo = String(municipio.codigo_municipal || "");
        if (nombre === termino || codigo === termino) return 0;
        if (nombre.startsWith(termino) || codigo.startsWith(termino)) return 1;
        return 2;
    }

    async function iniciarAutocompletado() {
        const campoPoblacion = document.getElementById("poblacion");
        if (!campoPoblacion || !window.supabaseClient?.from) return;

        const lista = document.createElement("datalist");
        lista.id = "sugerencias-poblaciones";
        document.body.appendChild(lista);
        campoPoblacion.setAttribute("list", lista.id);
        campoPoblacion.setAttribute("autocomplete", "off");

        const { data, error } = await window.supabaseClient
            .from("municipios")
            .select("nombre,codigo_municipal")
            .eq("activo", true)
            .order("nombre", { ascending: true });

        if (error) {
            console.error("No se pudieron cargar las sugerencias de población:", error);
            return;
        }

        const municipios = Array.isArray(data) ? data : [];
        let temporizador = null;

        function rellenarSugerencias() {
            const termino = normalizarTexto(campoPoblacion.value);
            lista.replaceChildren();
            if (termino.length < 2) return;

            municipios
                .filter((municipio) => {
                    const nombre = normalizarTexto(municipio.nombre);
                    const codigo = String(municipio.codigo_municipal || "");
                    return nombre.includes(termino) || codigo.includes(termino);
                })
                .sort((a, b) => {
                    const diferencia = prioridadCoincidencia(a, termino) - prioridadCoincidencia(b, termino);
                    if (diferencia) return diferencia;
                    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
                })
                .slice(0, 12)
                .forEach((municipio) => {
                    const opcion = document.createElement("option");
                    const codigo = String(municipio.codigo_municipal || "");
                    const provincia = provinciaMunicipio(codigo);
                    opcion.value = municipio.nombre;
                    opcion.label = codigo
                        ? `${provincia} · código municipal ${codigo}`
                        : provincia;
                    lista.appendChild(opcion);
                });
        }

        campoPoblacion.addEventListener("input", () => {
            window.clearTimeout(temporizador);
            temporizador = window.setTimeout(rellenarSugerencias, 120);
        });
        campoPoblacion.addEventListener("focus", rellenarSugerencias);
    }

    function obtenerPosicionActual() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("geolocation-no-disponible"));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 30000
            });
        });
    }

    function webSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(String(valor));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function tarjetaCercana(taller) {
        const nombre = escaparHTML(taller.nombre || taller.nombre_taller || "Taller sin nombre");
        const ubicacion = [taller.direccion, taller.ciudad, taller.provincia]
            .filter(Boolean).map(escaparHTML).join(", ");
        const distancia = Number(taller.distancia_km);
        const distanciaTexto = Number.isFinite(distancia)
            ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: distancia < 10 ? 1 : 0 }).format(distancia)
            : "";
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = webSegura(taller.web);
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.slice(0, 4) : [];

        return `<article class="taller-card">
            <div class="taller-informacion">
                <div class="valoracion">⌖ Cercano <span>${distanciaTexto ? `${distanciaTexto} km` : "Distancia calculada"}</span></div>
                <h3>${nombre}</h3>
                <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                ${distanciaTexto ? `<p class="ubicacion"><strong>A ${distanciaTexto} km de tu ubicación</strong></p>` : ""}
                <div class="especialidades">${servicios.map((servicio) => `<span>${escaparHTML(servicio)}</span>`).join("")}</div>
                <div class="taller-pie">
                    <span class="abierto">● Disponible</span>
                    <span class="taller-contactos">
                        ${telefono ? `<a href="tel:${escaparHTML(telefono)}">Llamar</a>` : ""}
                        ${web ? `<a href="${escaparHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : ""}
                    </span>
                </div>
            </div>
        </article>`;
    }

    async function buscarOchoMasCercanos(latitud, longitud, servicio) {
        let talleres = [];
        let radioUtilizado = RADIOS_CERCANOS_KM.at(-1);

        for (const radio of RADIOS_CERCANOS_KM) {
            const { data, error } = await window.supabaseClient.rpc("buscar_talleres_cercanos", {
                p_latitud: latitud,
                p_longitud: longitud,
                p_radio_km: radio,
                p_servicio: servicio || null,
                p_limite: LIMITE_CERCANOS
            });
            if (error) throw error;
            talleres = Array.isArray(data) ? data : [];
            radioUtilizado = radio;
            if (talleres.length >= LIMITE_CERCANOS) break;
        }

        return {
            talleres: talleres
                .sort((a, b) => Number(a.distancia_km || Infinity) - Number(b.distancia_km || Infinity))
                .slice(0, LIMITE_CERCANOS),
            radio: radioUtilizado
        };
    }

    function iniciarBusquedaPorUbicacion() {
        const controles = document.querySelector(".poblacion-controles");
        const listaTalleres = document.getElementById("lista-talleres");
        const campoPoblacion = document.getElementById("poblacion");
        const campoServicio = document.getElementById("servicio");
        if (!controles || !listaTalleres || !window.supabaseClient?.rpc) return;

        let boton = document.getElementById("usar-mi-ubicacion");
        if (!boton) {
            boton = document.createElement("button");
            boton.id = "usar-mi-ubicacion";
            boton.type = "button";
            boton.className = "boton boton-claro boton-pequeno";
            boton.innerHTML = '<span aria-hidden="true">⌖</span> Usar mi ubicación';
            boton.style.marginTop = "8px";
            controles.insertAdjacentElement("afterend", boton);
        }

        let estado = document.getElementById("estado-ubicacion");
        if (!estado) {
            estado = document.createElement("small");
            estado.id = "estado-ubicacion";
            estado.setAttribute("aria-live", "polite");
            boton.insertAdjacentElement("afterend", estado);
        }

        boton.addEventListener("click", async () => {
            boton.disabled = true;
            boton.textContent = "Localizando…";
            estado.textContent = "Solicitando permiso para obtener tu ubicación precisa…";
            listaTalleres.innerHTML = '<p class="mensaje-talleres">Buscando hasta 8 talleres en radios de 1, 3 y 5 km…</p>';

            try {
                const posicion = await obtenerPosicionActual();
                const latitud = Number(posicion.coords.latitude);
                const longitud = Number(posicion.coords.longitude);
                if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
                    throw new Error("coordenadas-no-validas");
                }

                if (campoPoblacion) campoPoblacion.value = "";
                const resultado = await buscarOchoMasCercanos(
                    latitud,
                    longitud,
                    campoServicio?.value || ""
                );

                if (!resultado.talleres.length) {
                    listaTalleres.innerHTML = '<p class="mensaje-talleres">No hay talleres con ubicación registrada a menos de 5 km.</p>';
                    estado.textContent = "No se encontraron talleres cercanos dentro del límite de 5 km.";
                } else {
                    listaTalleres.innerHTML = resultado.talleres.map(tarjetaCercana).join("");
                    estado.textContent = `${resultado.talleres.length} talleres encontrados dentro de ${resultado.radio} km, ordenados por distancia real.`;
                    const indicador = document.querySelector(".mapa-estado");
                    if (indicador) indicador.textContent = `${resultado.talleres.length} más cercanos`;
                }
                document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
            } catch (error) {
                console.error("No se pudo usar la ubicación:", error);
                const denegado = error?.code === 1;
                listaTalleres.innerHTML = '<p class="mensaje-talleres">No se pudo obtener tu ubicación. Puedes buscar por población.</p>';
                estado.textContent = denegado
                    ? "Has bloqueado el permiso de ubicación en el navegador."
                    : "No se pudo detectar la ubicación precisa.";
            } finally {
                boton.disabled = false;
                boton.innerHTML = '<span aria-hidden="true">⌖</span> Usar mi ubicación';
            }
        });
    }

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

    function iniciar() {
        iniciarAutocompletado();
        iniciarBusquedaPorUbicacion();
        iniciarBusquedaDesdeUrl();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
