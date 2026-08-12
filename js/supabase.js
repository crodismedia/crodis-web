(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 20;
    const LIMITE_TERMINO = 80;
    const CODIGOS_CAPITALES = new Map([
        ["alicante", "03014"], ["alacant", "03014"], ["alacant alicante", "03014"],
        ["castellon", "12040"], ["castello", "12040"], ["castellon de la plana", "12040"],
        ["castello de la plana", "12040"], ["castello de la plana castellon de la plana", "12040"],
        ["valencia", "46250"]
    ]);

    if (!window.supabase?.createClient) {
        console.error("No se ha cargado la biblioteca de Supabase.");
        return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;

    if (!window.TallerMapTallerUI) {
        // El área administrativa solo necesita el cliente de Supabase.
        return;
    }

    const ui = window.TallerMapTallerUI;

    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let totalResultadosActual = 0;
    let cargando = false;
    let versionBusqueda = 0;
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

        const partes = termino
            .split("/")
            .map(parte => parte.trim())
            .filter(Boolean);

        return partes.length > 1
            ? partes[partes.length - 1].slice(0, LIMITE_TERMINO)
            : termino;
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
            normalizarTexto(elemento.value) === normalizado
            || normalizarTexto(elemento.textContent) === normalizado
        );
        return opcion?.value || solicitado;
    }

    function codigoMunicipioPreferente(ubicacion) {
        return CODIGOS_CAPITALES.get(normalizarTexto(ubicacion)) || "";
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
        if (titulo) titulo.textContent = cantidad
            ? `${cantidad.toLocaleString("es-ES")} talleres encontrados`
            : "Talleres publicados";
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
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    document.getElementById("talleres")?.scrollIntoView({
                        behavior: comportamiento,
                        block: "start"
                    });
                    resolve();
                });
            });
        });
    }

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(
            talleres.map(taller => Array.isArray(taller.fotos) ? (taller.fotos[0] || "") : "").filter(Boolean)
        )];
        if (!rutas.length) return talleres;
        const { data, error } = await supabaseClient.storage.from("fotos-talleres").createSignedUrls(rutas, 3600);
        if (error) return talleres;
        const porRuta = new Map((data || []).map(item => [item.path, item.signedUrl || item.signedURL || ""]));
        return talleres.map(taller => ({
            ...taller,
            fotoFirmada: porRuta.get(Array.isArray(taller.fotos) ? taller.fotos[0] : "") || ""
        }));
    }

    function incorporarFotosEnSegundoPlano(talleres, version) {
        void adjuntarFotosFirmadas(talleres).then(talleresConFotos => {
            if (version !== versionBusqueda) return;
            const tarjetas = [...document.querySelectorAll("#lista-talleres .taller-card[data-taller-slug]")];
            talleresConFotos.forEach(taller => {
                const foto = ui.webSegura(taller.fotoFirmada);
                if (!foto) return;
                const slug = ui.slugTaller(taller);
                const tarjeta = tarjetas.find(elemento => elemento.dataset.tallerSlug === slug);
                const caja = tarjeta?.querySelector(".taller-imagen");
                if (!caja || caja.querySelector("img")) return;
                const imagen = document.createElement("img");
                imagen.src = foto;
                imagen.alt = `Fotografía de ${taller.nombre || "taller"}`;
                imagen.loading = "lazy";
                imagen.decoding = "async";
                caja.prepend(imagen);
            });
        }).catch(error => console.error("No se pudieron incorporar las fotografías:", error));
    }

    async function cargarServicios() {
        const selector = document.getElementById("servicio");
        if (!selector) return;
        const seleccionado = selector.value;
        const { data, error } = await supabaseClient
            .from("servicios").select("slug,nombre").eq("activo", true).order("nombre", { ascending: true });
        if (error) {
            console.error("No se pudo cargar el catálogo de servicios:", error);
            return;
        }
        selector.replaceChildren(new Option("Todos los servicios", ""));
        (data || []).forEach(servicio => selector.appendChild(new Option(servicio.nombre || servicio.slug, servicio.slug || "")));
        if ([...selector.options].some(opcion => opcion.value === seleccionado)) selector.value = seleccionado;
        const servicioUrl = new URLSearchParams(window.location.search).get("servicio") || "";
        const servicioResuelto = resolverServicio(selector, servicioUrl);
        if ([...selector.options].some(opcion => opcion.value === servicioResuelto)) selector.value = servicioResuelto;
    }

    async function cargarEstadisticas() {
        const { data, error } = await supabaseClient.rpc("estadisticas_publicas");
        if (error) return console.error("No se pudieron cargar las estadísticas:", error);
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
            const resultadoMunicipio = await supabaseClient.rpc("buscar_talleres_municipio", {
                p_codigo_municipal: codigoMunicipioActual,
                p_servicio: servicio,
                p_desde: desde,
                p_limite: limite
            });
            if (!resultadoMunicipio.error) return resultadoMunicipio;
            console.warn("La búsqueda optimizada por municipio falló; se usa la búsqueda general:", resultadoMunicipio.error);
        }
        return supabaseClient.rpc("buscar_talleres_profesional", {
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
            versionBusqueda += 1;
            siguienteIndice = 0;
            totalResultadosActual = 0;
            poblacionActual = ubicacionSegura(poblacion);
            servicioActual = terminoSeguro(servicio);
            codigoMunicipioActual = codigoMunicipioPreferente(poblacionActual);
            const campoPoblacion = document.getElementById("poblacion");
            if (campoPoblacion && poblacionActual) campoPoblacion.value = poblacionActual;
            mostrarEstado("Buscando talleres...");
            actualizarNumeroResultados(0);
            actualizarBoton(false);
            actualizarUrlBusqueda(poblacionActual, servicioActual);
        }

        const versionActual = versionBusqueda;
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
                actualizarNumeroResultados(0);
                actualizarBoton(false);
                return;
            }

            const talleres = Array.isArray(data) ? data : [];
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
            incorporarFotosEnSegundoPlano(talleres, versionActual);
        } catch (error) {
            console.error("Error inesperado durante la búsqueda:", error);
            if (reiniciar) mostrarEstado("Ha ocurrido un problema al buscar talleres. Vuelve a intentarlo.");
            actualizarBoton(false);
        } finally {
            cargando = false;
            actualizarBotonBuscar(false);
        }
    }

    function iniciarFormulario() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        document.getElementById("boton-cargar-mas")?.addEventListener("click", () => cargarTalleres(poblacionActual, servicioActual, false));
        formulario?.addEventListener("submit", async evento => {
            evento.preventDefault();
            await cargarTalleres(poblacion?.value || "", servicio?.value || "", true);
            await mostrarResultadosCuandoListos("smooth");
        });
        document.querySelectorAll("[data-servicio]").forEach(enlace => enlace.addEventListener("click", evento => {
            evento.preventDefault();
            const valor = enlace.dataset.servicio || "";
            if (servicio && [...servicio.options].some(opcion => opcion.value === valor)) servicio.value = valor;
            formulario?.requestSubmit();
        }));
    }

    async function cargarBusquedaInicialDesdeUrl(promesaServicios) {
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const parametros = new URLSearchParams(window.location.search);
        const poblacionUrl = ubicacionSegura(parametros.get("poblacion") || "");
        const servicioUrl = terminoSeguro(parametros.get("servicio") || "");
        if (!poblacionUrl && !servicioUrl) return;
        if (poblacion && poblacionUrl) poblacion.value = poblacionUrl;
        if (servicioUrl && promesaServicios) await promesaServicios.catch(() => undefined);
        const servicioResuelto = resolverServicio(servicio, servicioUrl);
        if (servicio && servicioResuelto && [...servicio.options].some(opcion => opcion.value === servicioResuelto)) servicio.value = servicioResuelto;
        await cargarTalleres(
            poblacion?.value || poblacionUrl,
            servicio?.value || servicioResuelto,
            true
        );
        await mostrarResultadosCuandoListos("auto");
    }

    function iniciar() {
        iniciarFormulario();
        const promesaServicios = cargarServicios();
        void cargarEstadisticas();
        void cargarBusquedaInicialDesdeUrl(promesaServicios);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());
