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
        iniciarBusquedaDesdeUrl();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
