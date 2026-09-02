(() => {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 20;
    const LIMITE_TERMINO = 80;
    const SERVICIOS_SEO = new Set([
        "mecanica-general","frenos","embrague","cambio-aceite-filtros","correa-distribucion","cadena-distribucion","pre-itv","reparacion-motor","caja-cambios","sistema-refrigeracion","escape-catalizador","baterias","electricidad-automovil","alternador-motor-arranque","centralitas-electronica","suspension-amortiguadores","alineacion-direccion","equilibrado-ruedas","neumaticos","lunas-cristales","carroceria","chapa-pintura","diagnosis-electronica","aire-acondicionado","calefaccion-climatizacion","hibridos-electricos"
    ]);
    const CODIGOS_CAPITALES = new Map([
        ["alicante", "03014"], ["alacant", "03014"], ["alacant alicante", "03014"],
        ["castellon", "12040"], ["castello", "12040"], ["castellon de la plana", "12040"],
        ["castello de la plana", "12040"], ["castello de la plana castellon de la plana", "12040"],
        ["valencia", "46250"]
    ]);

    const ui = window.TallerMapTallerUI;
    if (!ui) return;

    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let totalResultadosActual = 0;
    let cargando = false;
    let codigoMunicipioActual = "";

    function terminoSeguro(valor) {
        return String(valor || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, LIMITE_TERMINO);
    }

    function ubicacionSegura(valor) {
        const termino = terminoSeguro(valor);
        if (!termino || /^\d{5}$/.test(termino)) return termino;
        const partes = termino.split("/").map(parte => parte.trim()).filter(Boolean);
        return partes.length > 1 ? partes[partes.length - 1].slice(0, LIMITE_TERMINO) : termino;
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function resolverServicio(selector, valor) {
        const solicitado = terminoSeguro(valor);
        if (!solicitado) return "";
        const normalizado = normalizarTexto(solicitado);
        const opcion = [...(selector?.options || [])].find(elemento =>
            normalizarTexto(elemento.value) === normalizado || normalizarTexto(elemento.textContent) === normalizado
        );
        return opcion?.value || solicitado;
    }

    function codigoMunicipioPreferente(ubicacion) {
        return CODIGOS_CAPITALES.get(normalizarTexto(ubicacion)) || "";
    }

    async function peticion(url, opciones = {}) {
        const headers = {
            apikey: SUPABASE_KEY,
            Accept: "application/json",
            ...(opciones.body ? { "Content-Type": "application/json" } : {}),
            ...(opciones.headers || {})
        };
        try {
            const respuesta = await fetch(url, { ...opciones, headers });
            const texto = respuesta.status === 204 ? "" : await respuesta.text();
            let data = null;
            if (texto) {
                try { data = JSON.parse(texto); } catch (_error) { data = texto; }
            }
            if (!respuesta.ok) {
                const message = typeof data === "object" && data ? String(data.message || data.error || respuesta.status) : String(data || respuesta.status);
                return { data: null, error: { status: respuesta.status, message } };
            }
            return { data, error: null };
        } catch (error) {
            return { data: null, error: { status: 0, message: String(error?.message || error || "Error de red") } };
        }
    }

    function rpc(nombre, parametros) {
        return peticion(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(nombre)}`, {
            method: "POST",
            body: JSON.stringify(parametros || {})
        });
    }

    async function enriquecerServicios(talleres) {
        const filas = Array.isArray(talleres) ? talleres : [];
        const ids = [...new Set(filas.map(taller => String(taller?.id || "").trim()).filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
        if (!ids.length) return filas;

        const query = new URLSearchParams({
            select: "id,servicios",
            id: `in.(${ids.join(",")})`,
            limit: String(ids.length)
        });
        const { data, error } = await peticion(`${SUPABASE_URL}/rest/v1/talleres?${query.toString()}`);
        if (error || !Array.isArray(data)) return filas;

        const porId = new Map(data.map(taller => [String(taller.id), Array.isArray(taller.servicios) ? taller.servicios : []]));
        return filas.map(taller => ({ ...taller, servicios: porId.get(String(taller.id)) || [] }));
    }

    function mostrarEstado(mensaje) {
        const contenedor = document.getElementById("lista-talleres");
        if (contenedor) contenedor.innerHTML = `<p class="mensaje-talleres">${ui.escaparHTML(mensaje)}</p>`;
    }

    function actualizarNumeroResultados(total) {
        const cantidad = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) indicador.textContent = `${cantidad} ${cantidad === 1 ? "disponible" : "disponibles"}`;
        const titulo = document.querySelector("#talleres .titulo-seccion h2");
        if (titulo) titulo.textContent = cantidad ? `${cantidad.toLocaleString("es-ES")} talleres encontrados` : "Talleres publicados";
    }

    function actualizarBoton(hayMas, estaCargando = false) {
        const contenedor = document.getElementById("contenedor-cargar-mas");
        const boton = document.getElementById("boton-cargar-mas");
        if (!contenedor || !boton) return;
        contenedor.hidden = !hayMas;
        boton.disabled = estaCargando;
        boton.textContent = estaCargando ? "Cargando talleres..." : "Cargar más talleres";
    }

    function actualizarBotonBuscar(estaCargando) {
        const boton = document.getElementById("boton-buscar");
        if (!boton) return;
        boton.disabled = estaCargando;
        boton.setAttribute("aria-busy", estaCargando ? "true" : "false");
        boton.textContent = estaCargando ? "Buscando..." : "Buscar talleres";
    }

    function actualizarUrlBusqueda(poblacion, servicio) {
        const url = new URL(window.location.href);
        if (poblacion) url.searchParams.set("poblacion", poblacion); else url.searchParams.delete("poblacion");
        if (servicio) url.searchParams.set("servicio", servicio); else url.searchParams.delete("servicio");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function mostrarResultadosCuandoListos(comportamiento = "smooth") {
        return new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                document.getElementById("talleres")?.scrollIntoView({ behavior: comportamiento, block: "start" });
                resolve();
            }));
        });
    }

    async function cargarServicios() {
        const selector = document.getElementById("servicio");
        if (!selector) return;
        const seleccionado = selector.value;
        const query = new URLSearchParams({ select: "slug,nombre", activo: "eq.true", order: "nombre.asc" });
        const { data, error } = await peticion(`${SUPABASE_URL}/rest/v1/servicios?${query.toString()}`);
        if (error) return console.error("No se pudo cargar el catálogo de servicios:", error);
        selector.replaceChildren(new Option("Todos los servicios", ""));
        (Array.isArray(data) ? data : []).forEach(servicio => selector.appendChild(new Option(servicio.nombre || servicio.slug, servicio.slug || "")));
        if ([...selector.options].some(opcion => opcion.value === seleccionado)) selector.value = seleccionado;
        const servicioUrl = new URLSearchParams(location.search).get("servicio") || "";
        const resuelto = resolverServicio(selector, servicioUrl);
        if ([...selector.options].some(opcion => opcion.value === resuelto)) selector.value = resuelto;
    }

    async function cargarEstadisticas() {
        const { data, error } = await rpc("estadisticas_publicas", {});
        if (error) return;
        const escribir = (id, valor) => {
            const elemento = document.getElementById(id);
            const numero = Number(valor);
            if (elemento && Number.isFinite(numero)) elemento.textContent = new Intl.NumberFormat("es-ES").format(numero);
        };
        escribir("contador-altas-cabecera", data?.talleres_activos);
        escribir("estadistica-talleres", data?.talleres_activos);
        escribir("estadistica-servicios", data?.servicios_disponibles);
    }

    async function ejecutarBusquedaActual({ ubicacion, servicio, desde, limite }) {
        if (codigoMunicipioActual) {
            const resultado = await rpc("buscar_talleres_municipio", {
                p_codigo_municipal: codigoMunicipioActual,
                p_servicio: servicio,
                p_desde: desde,
                p_limite: limite
            });
            if (!resultado.error) return resultado;
        }
        return rpc("buscar_talleres_profesional_v2", {
            p_ubicacion: ubicacion,
            p_servicio: servicio,
            p_desde: desde,
            p_limite: limite
        });
    }

    async function cargarTalleres(poblacion = "", servicio = "", reiniciar = true) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || cargando) return;
        if (reiniciar) {
            siguienteIndice = 0;
            totalResultadosActual = 0;
            poblacionActual = ubicacionSegura(poblacion);
            servicioActual = terminoSeguro(servicio);
            codigoMunicipioActual = codigoMunicipioPreferente(poblacionActual);
            const campo = document.getElementById("poblacion");
            if (campo && poblacionActual) campo.value = poblacionActual;
            mostrarEstado("Buscando talleres...");
            actualizarNumeroResultados(0);
            actualizarBoton(false);
            actualizarUrlBusqueda(poblacionActual, servicioActual);
        }
        cargando = true;
        actualizarBotonBuscar(true);
        if (!reiniciar) actualizarBoton(true, true);
        try {
            const { data, error } = await ejecutarBusquedaActual({
                ubicacion: poblacionActual,
                servicio: servicioActual,
                desde: siguienteIndice,
                limite: TAMANO_PAGINA
            });
            if (error) {
                console.error("No se pudieron cargar los talleres:", error);
                if (reiniciar) mostrarEstado("No se pudieron cargar los talleres. Vuelve a intentarlo.");
                actualizarBoton(false);
                return;
            }
            const talleres = await enriquecerServicios(Array.isArray(data) ? data : []);
            if (!talleres.length) {
                if (reiniciar) {
                    mostrarEstado("No hemos encontrado talleres con esos criterios. Prueba otra población, código postal o servicio.");
                    actualizarNumeroResultados(0);
                }
                actualizarBoton(false);
                return;
            }
            const html = talleres.map(ui.crearTarjeta).join("");
            if (reiniciar) contenedor.innerHTML = html; else contenedor.insertAdjacentHTML("beforeend", html);
            siguienteIndice += talleres.length;
            const total = Number(talleres[0]?.total_resultados);
            totalResultadosActual = Number.isFinite(total) ? total : siguienteIndice;
            actualizarNumeroResultados(totalResultadosActual);
            actualizarBoton(siguienteIndice < totalResultadosActual);
        } catch (error) {
            console.error("Error inesperado durante la búsqueda:", error);
            if (reiniciar) mostrarEstado("Ha ocurrido un problema al buscar talleres. Vuelve a intentarlo.");
            actualizarBoton(false);
        } finally {
            cargando = false;
            actualizarBotonBuscar(false);
        }
    }

    function restaurarBusquedaSSR() {
        if (document.body?.dataset?.tmSearchSsr !== "1") return false;
        const params = new URLSearchParams(location.search);
        poblacionActual = ubicacionSegura(params.get("poblacion") || "");
        servicioActual = terminoSeguro(params.get("servicio") || "");
        codigoMunicipioActual = codigoMunicipioPreferente(poblacionActual);
        const pagina = Math.max(1, Number(params.get("pagina")) || 1);
        const tarjetas = document.querySelectorAll("#lista-talleres .taller-card[data-taller-slug]");
        siguienteIndice = (pagina - 1) * TAMANO_PAGINA + tarjetas.length;
        const texto = document.querySelector(".mapa-estado")?.textContent || "";
        const total = Number((texto.match(/[\d.]+/) || [""])[0].replace(/\./g, ""));
        totalResultadosActual = Number.isFinite(total) ? total : siguienteIndice;
        actualizarBoton(siguienteIndice < totalResultadosActual);
        return true;
    }

    function iniciarFormulario() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        document.getElementById("boton-cargar-mas")?.addEventListener("click", () => cargarTalleres(poblacionActual, servicioActual, false));
        formulario?.addEventListener("submit", async evento => {
            const ubicacion = String(poblacion?.value || "").trim();
            const especialidad = String(servicio?.value || "").trim();
            if (!ubicacion && SERVICIOS_SEO.has(especialidad)) {
                evento.preventDefault();
                location.assign(`/servicios/${especialidad}.html`);
                return;
            }
            evento.preventDefault();
            await cargarTalleres(ubicacion, especialidad, true);
            await mostrarResultadosCuandoListos("smooth");
        });
        document.querySelectorAll("[data-servicio]").forEach(enlace => enlace.addEventListener("click", evento => {
            const href = String(enlace.getAttribute("href") || "");
            if (href.startsWith("/servicios/")) return;
            evento.preventDefault();
            const valor = enlace.dataset.servicio || "";
            if (servicio && [...servicio.options].some(opcion => opcion.value === valor)) servicio.value = valor;
            formulario?.requestSubmit();
        }));
    }

    function iniciar() {
        iniciarFormulario();
        void cargarServicios();
        void cargarEstadisticas();
        restaurarBusquedaSSR();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
})();
