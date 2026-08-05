(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 30;

    if (!window.supabase?.createClient) {
        console.error("No se ha cargado la biblioteca de Supabase.");
        return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;

    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let totalResultadosActual = 0;
    let cargando = false;

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
            .slice(0, 80);
    }

    function webSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(String(valor));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
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

    function crearTarjeta(taller) {
        const nombre = escaparHTML(taller.nombre || "Taller sin nombre");
        const ubicacion = [taller.direccion, taller.ciudad, taller.provincia]
            .filter(Boolean)
            .map(escaparHTML)
            .join(", ");
        const descripcion = escaparHTML(taller.descripcion || "Información próximamente disponible.");
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = webSegura(taller.web);
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.slice(0, 4) : [];
        const foto = webSegura(taller.fotoFirmada);
        const enlaces = [];

        if (telefono) enlaces.push(`<a href="tel:${escaparHTML(telefono)}">Llamar</a>`);
        if (web) enlaces.push(`<a href="${escaparHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
        enlaces.push(`<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slugTaller(taller))}">Ver ficha</a>`);

        return `
            <article class="taller-card">
                <div class="taller-imagen taller-imagen-1">
                    ${foto ? `<img src="${escaparHTML(foto)}" alt="Fotografía de ${nombre}" loading="lazy">` : ""}
                    <span class="verificado">${taller.verificado ? "✓ Verificado" : "Publicado"}</span>
                </div>
                <div class="taller-informacion">
                    <div class="valoracion">★ Nuevo <span>Ficha publicada</span></div>
                    <h3>${nombre}</h3>
                    <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                    <p class="taller-descripcion">${descripcion}</p>
                    <div class="especialidades">
                        ${(servicios.length ? servicios : ["taller-mecanico"])
                            .map(servicio => `<span>${escaparHTML(etiquetaDesdeSlug(servicio))}</span>`)
                            .join("")}
                    </div>
                    <div class="taller-pie">
                        <span class="abierto">● Disponible</span>
                        <span class="taller-contactos">${enlaces.join("")}</span>
                    </div>
                </div>
            </article>`;
    }

    function mostrarEstado(mensaje) {
        const contenedor = document.getElementById("lista-talleres");
        if (contenedor) {
            contenedor.innerHTML = `<p class="mensaje-talleres">${escaparHTML(mensaje)}</p>`;
        }
    }

    function actualizarNumeroResultados(total) {
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) {
            indicador.textContent = `${total} ${total === 1 ? "disponible" : "disponibles"}`;
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

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(
            talleres
                .map(taller => Array.isArray(taller.fotos) ? taller.fotos[0] : "")
                .filter(Boolean)
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

        return talleres.map(taller => ({
            ...taller,
            fotoFirmada: porRuta.get(Array.isArray(taller.fotos) ? taller.fotos[0] : "") || ""
        }));
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
            opcion.value = servicio.slug;
            opcion.textContent = servicio.nombre;
            selector.appendChild(opcion);
        });

        if ([...selector.options].some(opcion => opcion.value === seleccionado)) {
            selector.value = seleccionado;
        }

        const parametros = new URLSearchParams(window.location.search);
        const servicioUrl = parametros.get("servicio") || "";
        if ([...selector.options].some(opcion => opcion.value === servicioUrl)) {
            selector.value = servicioUrl;
        }
    }

    async function cargarEstadisticas() {
        const { data, error } = await supabaseClient.rpc("estadisticas_publicas");
        if (error) return;

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

    async function cargarTalleres(poblacion = "", servicio = "", reiniciar = true) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || cargando) return;

        if (reiniciar) {
            siguienteIndice = 0;
            totalResultadosActual = 0;
            poblacionActual = terminoSeguro(poblacion);
            servicioActual = terminoSeguro(servicio);
            mostrarEstado("Cargando talleres...");
            actualizarBoton(false);
        }

        cargando = true;
        if (!reiniciar) actualizarBoton(true, true);

        try {
            const { data, error } = await supabaseClient.rpc("buscar_talleres_publicos", {
                p_poblacion: poblacionActual,
                p_servicio: servicioActual,
                p_desde: siguienteIndice,
                p_limite: TAMANO_PAGINA
            });

            if (error) {
                console.error("No se pudieron cargar los talleres:", error);
                if (reiniciar) mostrarEstado("No se pudieron cargar los talleres.");
                actualizarBoton(false);
                return;
            }

            const talleres = Array.isArray(data) ? data : [];

            if (!talleres.length) {
                if (reiniciar) {
                    mostrarEstado("No hemos encontrado talleres con esos criterios.");
                    actualizarNumeroResultados(0);
                }
                actualizarBoton(false);
                return;
            }

            const talleresConFotos = await adjuntarFotosFirmadas(talleres);
            const html = talleresConFotos.map(crearTarjeta).join("");

            if (reiniciar) contenedor.innerHTML = html;
            else contenedor.insertAdjacentHTML("beforeend", html);

            siguienteIndice += talleres.length;
            const total = Number(talleres[0]?.total_resultados);
            totalResultadosActual = Number.isFinite(total) ? total : siguienteIndice;

            actualizarNumeroResultados(totalResultadosActual);
            actualizarBoton(siguienteIndice < totalResultadosActual);
        } finally {
            cargando = false;
        }
    }

    function iniciar() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const cargarMas = document.getElementById("boton-cargar-mas");

        cargarServicios();
        cargarEstadisticas();

        formulario?.addEventListener("submit", evento => {
            evento.preventDefault();
            cargarTalleres(poblacion?.value || "", servicio?.value || "", true);
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });

        cargarMas?.addEventListener("click", () => {
            cargarTalleres(poblacionActual, servicioActual, false);
        });

        document.querySelectorAll("[data-servicio]").forEach(enlace => {
            enlace.addEventListener("click", evento => {
                evento.preventDefault();
                if (servicio) servicio.value = enlace.dataset.servicio || "";
                formulario?.requestSubmit();
            });
        });

        const parametros = new URLSearchParams(window.location.search);
        const poblacionUrl = (parametros.get("poblacion") || "").trim();
        const servicioUrl = (parametros.get("servicio") || "").trim();

        if (poblacion && poblacionUrl) poblacion.value = poblacionUrl;

        window.setTimeout(() => {
            if (servicio && servicioUrl && [...servicio.options].some(o => o.value === servicioUrl)) {
                servicio.value = servicioUrl;
            }
            cargarTalleres(poblacion?.value || "", servicio?.value || "", true);
        }, 250);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
