(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

    const TAMANO_PAGINA = 20;
    const LIMITE_TERMINO = 80;
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

    if (!window.supabase?.createClient) {
        console.error("No se ha cargado la biblioteca de Supabase.");
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    window.supabaseClient = supabaseClient;

    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let totalResultadosActual = 0;
    let cargando = false;
    let versionBusqueda = 0;
    let codigoMunicipioActual = "";

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function terminoSeguro(valor) {
        return String(valor || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, LIMITE_TERMINO);
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

    function codigoMunicipioPreferente(ubicacion) {
        return CODIGOS_CAPITALES.get(normalizarTexto(ubicacion)) || "";
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

    function telefonoSeguro(valor) {
        return String(valor || "")
            .replace(/[^\d+]/g, "")
            .slice(0, 20);
    }

    function etiquetaDesdeSlug(slug) {
        return String(slug || "")
            .replace(/-/g, " ")
            .replace(/\b\p{L}/gu, letra => letra.toUpperCase());
    }

    function slugTaller(taller) {
        if (taller.slug) return String(taller.slug);

        const base = `${taller.nombre || "taller"}-${taller.ciudad || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        return taller.id ? `${base}-${String(taller.id).slice(0, 8)}` : base;
    }

    function normalizarServicios(valor) {
        if (Array.isArray(valor)) {
            return valor.map(servicio => {
                if (typeof servicio === "string") return servicio;
                if (servicio && typeof servicio === "object") {
                    return servicio.slug || servicio.nombre || servicio.servicio || "";
                }
                return "";
            }).filter(Boolean);
        }

        if (typeof valor === "string") {
            return valor.split(",").map(servicio => servicio.trim()).filter(Boolean);
        }

        return [];
    }

    function construirUbicacion(taller) {
        return [
            taller.direccion,
            taller.codigo_postal,
            taller.ciudad,
            taller.provincia
        ]
            .filter(Boolean)
            .map(valor => String(valor).trim())
            .filter(Boolean)
            .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
            .map(escaparHTML)
            .join(", ");
    }

    function crearTarjeta(taller) {
        const nombreOriginal = taller.nombre || "Taller sin nombre";
        const nombre = escaparHTML(nombreOriginal);
        const ubicacion = construirUbicacion(taller);
        const slug = slugTaller(taller);
        const descripcion = escaparHTML(
            taller.descripcion || "Consulta la ficha del taller para conocer sus servicios y datos de contacto."
        );
        const telefono = telefonoSeguro(taller.telefono);
        const web = webSegura(taller.web);
        const servicios = normalizarServicios(taller.servicios).slice(0, 4);
        const foto = webSegura(taller.fotoFirmada);
        const enlaces = [];

        if (telefono) enlaces.push(`<a href="tel:${escaparHTML(telefono)}">Llamar</a>`);
        if (web) {
            enlaces.push(`<a href="${escaparHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
        }
        enlaces.push(
            `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a>`
        );

        const etiquetasServicios = (servicios.length ? servicios : ["taller-mecanico"])
            .map(servicio => `<span>${escaparHTML(etiquetaDesdeSlug(servicio))}</span>`)
            .join("");

        return `
            <article class="taller-card" data-taller-slug="${escaparHTML(slug)}">
                <div class="taller-imagen taller-imagen-1">
                    ${foto ? `<img src="${escaparHTML(foto)}" alt="Fotografía de ${nombre}" loading="lazy" decoding="async">` : ""}
                    <span class="verificado">${taller.verificado ? "✓ Verificado" : "Publicado"}</span>
                </div>
                <div class="taller-informacion">
                    <div class="valoracion">★ Nuevo <span>Ficha publicada</span></div>
                    <h3>${nombre}</h3>
                    <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                    <p class="taller-descripcion">${descripcion}</p>
                    <div class="especialidades">${etiquetasServicios}</div>
                    <div class="taller-pie">
                        <span class="abierto">● Disponible</span>
                        <span class="taller-contactos">${enlaces.join("")}</span>
                    </div>
                </div>
            </article>
        `;
    }

    function mostrarEstado(mensaje) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor) return;
        contenedor.innerHTML = `<p class="mensaje-talleres">${escaparHTML(mensaje)}</p>`;
    }

    function actualizarNumeroResultados(total) {
        const cantidad = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) {
            indicador.textContent = `${cantidad} ${cantidad === 1 ? "disponible" : "disponibles"}`;
        }

        const tituloSeccion = document.querySelector("#talleres .titulo-seccion h2");
        if (tituloSeccion) {
            tituloSeccion.textContent = cantidad
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
        const url = new URL(window.location.href);
        if (poblacion) url.searchParams.set("poblacion", poblacion);
        else url.searchParams.delete("poblacion");

        if (servicio) url.searchParams.set("servicio", servicio);
        else url.searchParams.delete("servicio");

        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(
            talleres.map(taller => Array.isArray(taller.fotos) ? (taller.fotos[0] || "") : "").filter(Boolean)
        )];

        if (!rutas.length) return talleres;

        const { data, error } = await supabaseClient.storage
            .from("fotos-talleres")
            .createSignedUrls(rutas, 3600);

        if (error) {
            console.error("No se pudieron preparar las fotografías:", error);
            return talleres;
        }

        const porRuta = new Map(
            (data || []).map(item => [item.path, item.signedUrl || item.signedURL || ""])
        );

        return talleres.map(taller => {
            const ruta = Array.isArray(taller.fotos) ? taller.fotos[0] : "";
            return { ...taller, fotoFirmada: porRuta.get(ruta) || "" };
        });
    }

    function incorporarFotosEnSegundoPlano(talleres, version) {
        void adjuntarFotosFirmadas(talleres)
            .then(talleresConFotos => {
                if (version !== versionBusqueda) return;

                const tarjetas = [...document.querySelectorAll(
                    "#lista-talleres .taller-card[data-taller-slug]"
                )];

                talleresConFotos.forEach(taller => {
                    const foto = webSegura(taller.fotoFirmada);
                    if (!foto) return;

                    const slug = slugTaller(taller);
                    const tarjeta = tarjetas.find(elemento => elemento.dataset.tallerSlug === slug);
                    const contenedorImagen = tarjeta?.querySelector(".taller-imagen");
                    if (!contenedorImagen || contenedorImagen.querySelector("img")) return;

                    const imagen = document.createElement("img");
                    imagen.src = foto;
                    imagen.alt = `Fotografía de ${taller.nombre || "taller"}`;
                    imagen.loading = "lazy";
                    imagen.decoding = "async";
                    contenedorImagen.prepend(imagen);
                });
            })
            .catch(error => console.error("No se pudieron incorporar las fotografías:", error));
    }

    async function cargarServicios() {
        const selector = document.getElementById("servicio");
        if (!selector) return;

        const seleccionado = selector.value;
        const { data, error } = await supabaseClient
            .from("servicios")
            .select("slug,nombre")
            .eq("activo", true)
            .order("nombre", { ascending: true });

        if (error) {
            console.error("No se pudo cargar el catálogo de servicios:", error);
            return;
        }

        selector.replaceChildren();
        const todos = document.createElement("option");
        todos.value = "";
        todos.textContent = "Todos los servicios";
        selector.appendChild(todos);

        (data || []).forEach(servicio => {
            const opcion = document.createElement("option");
            opcion.value = servicio.slug || "";
            opcion.textContent = servicio.nombre || etiquetaDesdeSlug(servicio.slug);
            selector.appendChild(opcion);
        });

        if ([...selector.options].some(opcion => opcion.value === seleccionado)) {
            selector.value = seleccionado;
        }

        const servicioUrl = new URLSearchParams(window.location.search).get("servicio") || "";
        if ([...selector.options].some(opcion => opcion.value === servicioUrl)) {
            selector.value = servicioUrl;
        }
    }

    async function cargarEstadisticas() {
        const { data, error } = await supabaseClient.rpc("estadisticas_publicas");
        if (error) {
            console.error("No se pudieron cargar las estadísticas:", error);
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
    }

    async function ejecutarBusquedaProfesional({ ubicacion, servicio, desde, limite }) {
        return supabaseClient.rpc("buscar_talleres_profesional", {
            p_ubicacion: ubicacion,
            p_servicio: servicio,
            p_desde: desde,
            p_limite: limite
        });
    }

    async function ejecutarBusquedaMunicipio({ codigoMunicipal, servicio, desde, limite }) {
        return supabaseClient.rpc("buscar_talleres_municipio", {
            p_codigo_municipal: codigoMunicipal,
            p_servicio: servicio,
            p_desde: desde,
            p_limite: limite
        });
    }

    async function ejecutarBusquedaActual({ ubicacion, servicio, desde, limite }) {
        if (codigoMunicipioActual) {
            const resultadoMunicipio = await ejecutarBusquedaMunicipio({
                codigoMunicipal: codigoMunicipioActual,
                servicio,
                desde,
                limite
            });

            if (!resultadoMunicipio.error) return resultadoMunicipio;

            console.warn(
                "La búsqueda optimizada por municipio falló; se usa la búsqueda general:",
                resultadoMunicipio.error
            );
        }

        return ejecutarBusquedaProfesional({ ubicacion, servicio, desde, limite });
    }

    async function cargarTalleres(poblacion = "", servicio = "", reiniciar = true) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || cargando) return;

        if (reiniciar) {
            versionBusqueda += 1;
            siguienteIndice = 0;
            totalResultadosActual = 0;
            poblacionActual = terminoSeguro(poblacion);
            servicioActual = terminoSeguro(servicio);
            codigoMunicipioActual = codigoMunicipioPreferente(poblacionActual);

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

            const html = talleres.map(crearTarjeta).join("");
            if (reiniciar) contenedor.innerHTML = html;
            else contenedor.insertAdjacentHTML("beforeend", html);

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
        const cargarMas = document.getElementById("boton-cargar-mas");

        formulario?.addEventListener("submit", evento => {
            evento.preventDefault();
            cargarTalleres(poblacion?.value || "", servicio?.value || "", true);
            document.getElementById("talleres")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

        cargarMas?.addEventListener("click", () => {
            cargarTalleres(poblacionActual, servicioActual, false);
        });

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
        const poblacionUrl = terminoSeguro(parametros.get("poblacion") || "");
        const servicioUrl = terminoSeguro(parametros.get("servicio") || "");

        if (!poblacionUrl && !servicioUrl) return;

        if (poblacion && poblacionUrl) poblacion.value = poblacionUrl;

        if (servicioUrl && promesaServicios) {
            await promesaServicios.catch(() => undefined);
        }

        if (servicio && servicioUrl && [...servicio.options].some(opcion => opcion.value === servicioUrl)) {
            servicio.value = servicioUrl;
        }

        cargarTalleres(
            poblacion?.value || poblacionUrl,
            servicio?.value || servicioUrl,
            true
        );
    }

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