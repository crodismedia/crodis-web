(function () {
    "use strict";

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        SUPABASE_URL: "https://cnyptelvbsndpkzbrete.supabase.co",
        SUPABASE_KEY: "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh",
        TAMANO_PAGINA: 20,
        LIMITE_TERMINO: 80,
        CACHE_DURATION: 3600000, // 1 hora
    };

    // ========== CONSTANTES ==========
    const CODIGOS_CAPITALES = new Map([
        ["alicante", "03014"],
        ["alacant", "03014"],
        ["alacant alicante", "03014"],
        ["castellon", "12040"],
        ["castello", "12040"],
        ["castellon de la plana", "12040"],
        ["castello de la plana", "12040"],
        ["castello de la plana castellon de la plana", "12040"],
        ["valencia", "46250"]
    ]);

    // ========== VALIDACIÓN DE DEPENDENCIAS ==========
    if (!window.supabase?.createClient) {
        console.error("[TallerMap] No se ha cargado la biblioteca de Supabase.");
        return;
    }

    // ========== INICIALIZACIÓN ==========
    const supabaseClient = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_KEY
    );
    window.supabaseClient = supabaseClient;

    // Verificar si la UI está disponible
    if (!window.TallerMapTallerUI) {
        console.warn("[TallerMap] UI no disponible. Solo se inicializa cliente Supabase.");
        return;
    }

    const ui = window.TallerMapTallerUI;

    // ========== ESTADO ==========
    const state = {
        siguienteIndice: 0,
        poblacionActual: "",
        servicioActual: "",
        totalResultadosActual: 0,
        cargando: false,
        versionBusqueda: 0,
        codigoMunicipioActual: "",
    };

    // ========== FUNCIONES DE UTILIDAD ==========
    function terminoSeguro(valor) {
        return String(valor || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, CONFIG.LIMITE_TERMINO);
    }

    function ubicacionSegura(valor) {
        const termino = terminoSeguro(valor);
        if (!termino || /^\d{5}$/.test(termino)) return termino;

        const partes = termino
            .split("/")
            .map(parte => parte.trim())
            .filter(Boolean);

        return partes.length > 1
            ? partes[partes.length - 1].slice(0, CONFIG.LIMITE_TERMINO)
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
        if (!selector || !valor) return "";
        
        const solicitado = terminoSeguro(valor);
        if (!solicitado) return "";
        
        const normalizado = normalizarTexto(solicitado);
        const opcion = [...(selector?.options || [])].find(elemento =>
            normalizarTexto(elemento.value) === normalizado ||
            normalizarTexto(elemento.textContent) === normalizado
        );
        
        return opcion?.value || solicitado;
    }

    function codigoMunicipioPreferente(ubicacion) {
        if (!ubicacion) return "";
        return CODIGOS_CAPITALES.get(normalizarTexto(ubicacion)) || "";
    }

    // ========== FUNCIONES DE UI ==========
    function mostrarEstado(mensaje) {
        const contenedor = document.getElementById("lista-talleres");
        if (contenedor) {
            const mensajeSeguro = ui.escaparHTML ? ui.escaparHTML(mensaje) : mensaje;
            contenedor.innerHTML = `<p class="mensaje-talleres">${mensajeSeguro}</p>`;
        }
    }

    function actualizarNumeroResultados(total) {
        const cantidad = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
        
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) {
            indicador.textContent = `${cantidad} ${cantidad === 1 ? "disponible" : "disponibles"}`;
        }
        
        const titulo = document.querySelector("#talleres .titulo-seccion h2");
        if (titulo) {
            titulo.textContent = cantidad
                ? `${cantidad.toLocaleString("es-ES")} talleres encontrados`
                : "Talleres publicados";
        }
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
        try {
            const url = new URL(window.location.href);
            
            if (poblacion) {
                url.searchParams.set("poblacion", poblacion);
            } else {
                url.searchParams.delete("poblacion");
            }
            
            if (servicio) {
                url.searchParams.set("servicio", servicio);
            } else {
                url.searchParams.delete("servicio");
            }
            
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        } catch (error) {
            console.warn("[TallerMap] Error al actualizar URL:", error);
        }
    }

    function mostrarResultadosCuandoListos(comportamiento = "smooth") {
        return new Promise(resolve => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    const talleresSection = document.getElementById("talleres");
                    if (talleresSection) {
                        talleresSection.scrollIntoView({
                            behavior: comportamiento,
                            block: "start"
                        });
                    }
                    resolve();
                });
            });
        });
    }

    // ========== FUNCIONES DE DATOS ==========
    async function adjuntarFotosFirmadas(talleres) {
        if (!talleres || !talleres.length) return talleres;

        const rutas = [...new Set(
            talleres
                .map(taller => taller.fotos?.[0] || "")
                .filter(Boolean)
        )];

        if (!rutas.length) return talleres;

        try {
            const { data, error } = await supabaseClient.storage
                .from("fotos-talleres")
                .createSignedUrls(rutas, 3600);

            if (error || !data) {
                console.warn("[TallerMap] Error al generar URLs firmadas:", error);
                return talleres;
            }

            const porRuta = new Map(
                data.map(item => [item.path, item.signedUrl || item.signedURL || ""])
            );

            return talleres.map(taller => ({
                ...taller,
                fotoFirmada: porRuta.get(taller.fotos?.[0]) || ""
            }));
        } catch (error) {
            console.error("[TallerMap] Error al adjuntar fotos:", error);
            return talleres;
        }
    }

    function incorporarFotosEnSegundoPlano(talleres, version) {
        if (!talleres || !talleres.length) return;

        void adjuntarFotosFirmadas(talleres).then(talleresConFotos => {
            if (version !== state.versionBusqueda) return;

            const tarjetas = [...document.querySelectorAll("#lista-talleres .taller-card[data-taller-slug]")];
            
            talleresConFotos.forEach(taller => {
                const foto = ui.webSegura ? ui.webSegura(taller.fotoFirmada) : taller.fotoFirmada;
                if (!foto) return;

                const slug = ui.slugTaller ? ui.slugTaller(taller) : taller.slug;
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
        }).catch(error => {
            console.error("[TallerMap] No se pudieron incorporar las fotografías:", error);
        });
    }

    // ========== FUNCIONES PRINCIPALES ==========
    async function cargarServicios() {
        const selector = document.getElementById("servicio");
        if (!selector) return;

        const seleccionado = selector.value;

        try {
            const { data, error } = await supabaseClient
                .from("servicios")
                .select("slug,nombre")
                .eq("activo", true)
                .order("nombre", { ascending: true });

            if (error) {
                console.error("[TallerMap] No se pudo cargar el catálogo de servicios:", error);
                return;
            }

            // Limpiar y reconstruir opciones
            selector.innerHTML = '<option value="">Todos los servicios</option>';
            
            (data || []).forEach(servicio => {
                const option = document.createElement("option");
                option.value = servicio.slug || "";
                option.textContent = servicio.nombre || servicio.slug || "";
                selector.appendChild(option);
            });

            // Restaurar selección si existe
            if (seleccionado && [...selector.options].some(opcion => opcion.value === seleccionado)) {
                selector.value = seleccionado;
            }

            // Verificar parámetro URL
            const servicioUrl = new URLSearchParams(window.location.search).get("servicio") || "";
            const servicioResuelto = resolverServicio(selector, servicioUrl);
            if (servicioResuelto && [...selector.options].some(opcion => opcion.value === servicioResuelto)) {
                selector.value = servicioResuelto;
            }
        } catch (error) {
            console.error("[TallerMap] Error en cargarServicios:", error);
        }
    }

    async function cargarEstadisticas() {
        try {
            const { data, error } = await supabaseClient.rpc("estadisticas_publicas");
            
            if (error) {
                console.error("[TallerMap] No se pudieron cargar las estadísticas:", error);
                return;
            }

            const escribir = (id, valor) => {
                const elemento = document.getElementById(id);
                const numero = Number(valor);
                if (elemento && Number.isFinite(numero)) {
                    elemento.textContent = new Intl.NumberFormat("es-ES").format(numero);
                }
            };

            escribir("contador-altas-cabecera", data?.talleres_activos);
            escribir("estadistica-talleres", data?.talleres_activos);
            escribir("estadistica-servicios", data?.servicios_disponibles);
        } catch (error) {
            console.error("[TallerMap] Error en cargarEstadisticas:", error);
        }
    }

    async function ejecutarBusquedaActual({ ubicacion, servicio, desde, limite }) {
        try {
            if (state.codigoMunicipioActual) {
                const resultadoMunicipio = await supabaseClient.rpc("buscar_talleres_municipio", {
                    p_codigo_municipal: state.codigoMunicipioActual,
                    p_servicio: servicio,
                    p_desde: desde,
                    p_limite: limite
                });

                if (!resultadoMunicipio.error && resultadoMunicipio.data) {
                    return resultadoMunicipio;
                }
                
                console.warn("[TallerMap] Búsqueda optimizada por municipio falló; usando búsqueda general:", 
                    resultadoMunicipio.error);
            }

            return await supabaseClient.rpc("buscar_talleres_profesional", {
                p_ubicacion: ubicacion,
                p_servicio: servicio,
                p_desde: desde,
                p_limite: limite
            });
        } catch (error) {
            console.error("[TallerMap] Error en ejecutarBusquedaActual:", error);
            throw error;
        }
    }

    async function cargarTalleres(poblacion = "", servicio = "", reiniciar = true) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || state.cargando) return;

        // Preparar búsqueda
        if (reiniciar) {
            state.versionBusqueda += 1;
            state.siguienteIndice = 0;
            state.totalResultadosActual = 0;
            state.poblacionActual = ubicacionSegura(poblacion);
            state.servicioActual = terminoSeguro(servicio);
            state.codigoMunicipioActual = codigoMunicipioPreferente(state.poblacionActual);

            const campoPoblacion = document.getElementById("poblacion");
            if (campoPoblacion && state.poblacionActual) {
                campoPoblacion.value = state.poblacionActual;
            }

            mostrarEstado("Buscando talleres...");
            actualizarNumeroResultados(0);
            actualizarBoton(false);
            actualizarUrlBusqueda(state.poblacionActual, state.servicioActual);
        }

        const versionActual = state.versionBusqueda;
        state.cargando = true;
        actualizarBotonBuscar(true);
        if (!reiniciar) actualizarBoton(true, true);

        try {
            const { data, error } = await ejecutarBusquedaActual({
                ubicacion: state.poblacionActual,
                servicio: state.servicioActual,
                desde: state.siguienteIndice,
                limite: CONFIG.TAMANO_PAGINA
            });

            if (error) {
                console.error("[TallerMap] No se pudieron cargar los talleres:", error);
                if (reiniciar) {
                    mostrarEstado("No se pudieron cargar los talleres. Vuelve a intentarlo.");
                }
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

            // Renderizar talleres
            const html = talleres.map(taller => {
                if (ui.crearTarjeta) {
                    return ui.crearTarjeta(taller);
                }
                // Fallback simple si no existe crearTarjeta
                return `<div class="taller-card" data-taller-slug="${taller.slug || ''}">
                    <h3>${taller.nombre || 'Taller sin nombre'}</h3>
                    <p>${taller.direccion || ''}</p>
                </div>`;
            }).join("");

            if (reiniciar) {
                contenedor.innerHTML = html;
            } else {
                contenedor.insertAdjacentHTML("beforeend", html);
            }

            state.siguienteIndice += talleres.length;
            const total = Number(talleres[0]?.total_resultados);
            state.totalResultadosActual = Number.isFinite(total) ? total : state.siguienteIndice;
            
            actualizarNumeroResultados(state.totalResultadosActual);
            actualizarBoton(state.siguienteIndice < state.totalResultadosActual);
            incorporarFotosEnSegundoPlano(talleres, versionActual);

        } catch (error) {
            console.error("[TallerMap] Error inesperado durante la búsqueda:", error);
            if (reiniciar) {
                mostrarEstado("Ha ocurrido un problema al buscar talleres. Vuelve a intentarlo.");
            }
            actualizarBoton(false);
        } finally {
            state.cargando = false;
            actualizarBotonBuscar(false);
        }
    }

    // ========== INICIALIZACIÓN DE FORMULARIO ==========
    function iniciarFormulario() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");

        // Botón cargar más
        document.getElementById("boton-cargar-mas")?.addEventListener("click", () => {
            cargarTalleres(state.poblacionActual, state.servicioActual, false);
        });

        // Formulario submit
        formulario?.addEventListener("submit", async evento => {
            evento.preventDefault();
            await cargarTalleres(
                poblacion?.value || "",
                servicio?.value || "",
                true
            );
            await mostrarResultadosCuandoListos("smooth");
        });

        // Enlaces de servicio rápido
        document.querySelectorAll("[data-servicio]").forEach(enlace => {
            enlace.addEventListener("click", evento => {
                evento.preventDefault();
                const valor = enlace.dataset.servicio || "";
                if (servicio && [...servicio.options].some(opcion => opcion.value === valor)) {
                    servicio.value = valor;
                }
                formulario?.requestSubmit();
            });
        });
    }

    async function cargarBusquedaInicialDesdeUrl(promesaServicios) {
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const parametros = new URLSearchParams(window.location.search);
        
        const poblacionUrl = ubicacionSegura(parametros.get("poblacion") || "");
        const servicioUrl = terminoSeguro(parametros.get("servicio") || "");

        if (!poblacionUrl && !servicioUrl) return;

        if (poblacion && poblacionUrl) {
            poblacion.value = poblacionUrl;
        }

        if (servicioUrl && promesaServicios) {
            await promesaServicios.catch(() => undefined);
        }

        const servicioResuelto = resolverServicio(servicio, servicioUrl);
        if (servicio && servicioResuelto && [...servicio.options].some(opcion => opcion.value === servicioResuelto)) {
            servicio.value = servicioResuelto;
        }

        await cargarTalleres(
            poblacion?.value || poblacionUrl,
            servicio?.value || servicioResuelto,
            true
        );

        await mostrarResultadosCuandoListos("auto");
    }

    // ========== INICIO ==========
    function iniciar() {
        iniciarFormulario();
        const promesaServicios = cargarServicios();
        void cargarEstadisticas();
        void cargarBusquedaInicialDesdeUrl(promesaServicios);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
