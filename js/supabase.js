(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

    if (!window.supabase?.createClient) {
        console.error("No se ha cargado la biblioteca de Supabase.");
        return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;

    const ETIQUETAS_SERVICIOS = window.TallerMapServicios?.etiquetas || {
        "mecanica-general": "Mecánica general",
        "chapa-pintura": "Chapa y pintura",
        neumaticos: "Neumáticos",
        "diagnosis-electronica": "Diagnosis electrónica",
        "aire-acondicionado": "Aire acondicionado",
        "hibridos-electricos": "Híbridos y eléctricos"
    };
    const TAMANO_PAGINA = 30;
    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let cargandoTalleres = false;

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }
    window.escaparHTML = escaparHTML;

    function etiquetaServicio(servicio) {
        return ETIQUETAS_SERVICIOS[servicio] || servicio;
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

    function crearTarjetaTaller(taller) {
        const nombre = escaparHTML(taller.nombre || taller.nombre_taller || "Taller sin nombre");
        const ciudad = escaparHTML(taller.ciudad || "");
        const provincia = escaparHTML(taller.provincia || "");
        const direccion = escaparHTML(taller.direccion || "");
        const descripcion = escaparHTML(
            taller.descripcion || "Información próximamente disponible."
        );
        const ubicacion = [direccion, ciudad, provincia].filter(Boolean).join(", ");
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = webSegura(taller.web);
        const fotoPrincipal = webSegura(taller.fotoFirmada);
        const cantidadFotos = Array.isArray(taller.fotos) ? taller.fotos.length : 0;
        const distintivo = taller.verificado ? "✓ Verificado" : "Publicado";
        const servicios = Array.isArray(taller.servicios) ? taller.servicios : [];
        const etiquetas = servicios.length ? servicios.slice(0, 4) : ["Taller mecánico"];
        const enlaces = [];
        if (telefono) {
            enlaces.push(`<a href="tel:${escaparHTML(telefono)}" aria-label="Llamar a ${nombre}">Llamar</a>`);
        }
        if (web) {
            enlaces.push(`<a href="${escaparHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
        }
        const contacto = enlaces.length
            ? `<span class="taller-contactos">${enlaces.join("")}</span>`
            : "<span>Sin contacto publicado</span>";

        return `
            <article class="taller-card">
                <div class="taller-imagen taller-imagen-1">
                    ${fotoPrincipal ? `<img src="${escaparHTML(fotoPrincipal)}" alt="Fotografía de ${nombre}" loading="lazy">` : ""}
                    <span class="verificado">${distintivo}</span>
                    ${cantidadFotos ? `<span class="numero-fotos">${cantidadFotos} ${cantidadFotos === 1 ? "foto" : "fotos"}</span>` : ""}
                </div>
                <div class="taller-informacion">
                    <div class="valoracion">★ Nuevo <span>Ficha publicada</span></div>
                    <h3>${nombre}</h3>
                    <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                    <p class="taller-descripcion">${descripcion}</p>
                    <div class="especialidades">
                        ${etiquetas.map((servicio) => `<span>${escaparHTML(etiquetaServicio(servicio))}</span>`).join("")}
                    </div>
                    <div class="taller-pie">
                        <span class="abierto">● Disponible</span>
                        ${contacto}
                    </div>
                </div>
            </article>
        `;
    }

    function mostrarEstado(contenedor, mensaje) {
        contenedor.innerHTML = `<p class="mensaje-talleres">${escaparHTML(mensaje)}</p>`;
    }

    function escribirEstadistica(id, valor) {
        const elemento = document.getElementById(id);
        const numero = Number(valor);
        if (!elemento || !Number.isFinite(numero) || numero < 0) return;
        elemento.textContent = new Intl.NumberFormat("es-ES").format(numero);
    }

    async function cargarEstadisticas() {
        const { data, error } = await supabaseClient.rpc("estadisticas_publicas");
        if (error) {
            console.error("No se pudieron cargar las estadísticas públicas:", error);
            return;
        }
        escribirEstadistica("contador-altas-cabecera", data?.talleres_activos);
        escribirEstadistica("estadistica-talleres", data?.talleres_activos);
        escribirEstadistica("estadistica-provincias", data?.provincias_disponibles);
        escribirEstadistica("estadistica-servicios", data?.servicios_disponibles);
    }

    function terminoSeguro(valor) {
        return String(valor || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
    }

    function actualizarBotonCarga(hayMas, cargando = false) {
        const contenedorBoton = document.getElementById("contenedor-cargar-mas");
        const boton = document.getElementById("boton-cargar-mas");
        if (!contenedorBoton || !boton) return;

        contenedorBoton.hidden = !hayMas;
        boton.disabled = cargando;
        boton.textContent = cargando ? "Cargando talleres..." : "Cargar más talleres";
    }

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(talleres
            .map((taller) => Array.isArray(taller.fotos) ? taller.fotos[0] : "")
            .filter(Boolean))];
        if (!rutas.length || !supabaseClient.storage?.from) return talleres;

        const { data, error } = await supabaseClient.storage
            .from("fotos-talleres")
            .createSignedUrls(rutas, 3600);
        if (error) {
            console.error("No se pudieron preparar las fotografías públicas:", error);
            return talleres;
        }

        const porRuta = new Map(
            (data || []).map((foto) => [foto.path, foto.signedUrl || foto.signedURL || ""])
        );
        return talleres.map((taller) => ({
            ...taller,
            fotoFirmada: porRuta.get(Array.isArray(taller.fotos) ? taller.fotos[0] : "") || ""
        }));
    }

    async function cargarTalleres(poblacion = "", servicio = "", reiniciar = true) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || cargandoTalleres) return;

        if (reiniciar) {
            siguienteIndice = 0;
            poblacionActual = terminoSeguro(poblacion);
            servicioActual = servicio;
            mostrarEstado(contenedor, "Cargando talleres...");
            actualizarBotonCarga(false);
        }

        const desde = siguienteIndice;
        const hasta = desde + TAMANO_PAGINA - 1;
        cargandoTalleres = true;
        if (!reiniciar) actualizarBotonCarga(true, true);

        function construirConsulta(incluirServicios, incluirFotos) {
            const columnas = [
                "id", "nombre", "telefono", "web", "direccion", "codigo_postal",
                "ciudad", "provincia", "descripcion", "verificado"
            ];
            if (incluirServicios) columnas.push("servicios");
            if (incluirFotos) columnas.push("fotos");
            let consulta = supabaseClient
                .from("talleres")
                .select(columnas.join(","), { count: "exact" })
                .eq("activo", true)
                .order("created_at", { ascending: false })
                .range(desde, hasta);

            if (poblacionActual) {
                consulta = consulta.ilike("ciudad", `%${poblacionActual}%`);
            }
            if (servicioActual && incluirServicios) {
                consulta = consulta.contains("servicios", [servicioActual]);
            }
            return consulta;
        }

        try {
            // Compatibilidad con instalaciones que todavía no tienen las columnas
            // opcionales de servicios o fotografías.
            let incluirServicios = true;
            let incluirFotos = true;
            let resultado;
            for (let intento = 0; intento < 3; intento += 1) {
                resultado = await construirConsulta(incluirServicios, incluirFotos);
                const detalle = String(resultado.error?.message || "").toLowerCase();
                if (resultado.error?.code !== "42703") break;
                if (detalle.includes("fotos") && incluirFotos) {
                    incluirFotos = false;
                    continue;
                }
                if (detalle.includes("servicios") && incluirServicios) {
                    incluirServicios = false;
                    continue;
                }
                break;
            }

            const { data: talleres, error, count } = resultado;
            if (error) {
                console.error("No se pudieron cargar los talleres:", error);
                if (reiniciar) {
                    mostrarEstado(
                        contenedor,
                        "No se pudieron cargar los talleres. Comprueba la configuración pública de Supabase."
                    );
                }
                actualizarBotonCarga(!reiniciar);
                return;
            }
            if (!talleres?.length && reiniciar) {
                mostrarEstado(contenedor, "No hemos encontrado talleres con esos criterios.");
                actualizarNumeroResultados(0);
                actualizarBotonCarga(false);
                return;
            }

            const talleresConFotos = await adjuntarFotosFirmadas(talleres);
            const tarjetas = talleresConFotos.map(crearTarjetaTaller).join("");
            if (reiniciar) contenedor.innerHTML = tarjetas;
            else contenedor.insertAdjacentHTML("beforeend", tarjetas);

            siguienteIndice += talleres.length;
            const total = Number.isInteger(count) ? count : siguienteIndice;
            const hayMas = Number.isInteger(count)
                ? siguienteIndice < count
                : talleres.length === TAMANO_PAGINA;
            actualizarNumeroResultados(total);
            actualizarBotonCarga(hayMas);
        } finally {
            cargandoTalleres = false;
        }
    }

    function actualizarNumeroResultados(total) {
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) {
            indicador.textContent = `${total} ${total === 1 ? "disponible" : "disponibles"}`;
        }
    }

    function iniciarAplicacion() {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor) return;

        const formularioBusqueda = document.querySelector("form.buscador");
        const campoPoblacion = document.getElementById("poblacion");
        const campoServicio = document.getElementById("servicio");
        const botonCargarMas = document.getElementById("boton-cargar-mas");
        const botonUbicacion = document.getElementById("usar-mi-ubicacion");
        const estadoUbicacion = document.getElementById("estado-ubicacion");

        function escribirEstadoUbicacion(mensaje, esError = false) {
            if (!estadoUbicacion) return;
            estadoUbicacion.textContent = mensaje;
            estadoUbicacion.classList.toggle("estado-ubicacion-error", esError);
        }

        function obtenerPosicionActual() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("geolocation-no-disponible"));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 12000,
                    maximumAge: 300000
                });
            });
        }

        async function detectarPoblacion() {
            if (!botonUbicacion || !campoPoblacion) return;

            botonUbicacion.disabled = true;
            botonUbicacion.textContent = "Localizando…";
            escribirEstadoUbicacion("Solicitando permiso para conocer tu ubicación…");

            try {
                const posicion = await obtenerPosicionActual();
                const parametros = new URLSearchParams({
                    latitude: String(posicion.coords.latitude),
                    longitude: String(posicion.coords.longitude),
                    localityLanguage: "es"
                });
                const respuesta = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?${parametros}`,
                    { headers: { Accept: "application/json" } }
                );
                if (!respuesta.ok) throw new Error("geocodificacion-no-disponible");

                const lugar = await respuesta.json();
                if (lugar.countryCode && lugar.countryCode !== "ES") {
                    throw new Error("fuera-de-espana");
                }

                const poblacion = String(lugar.city || lugar.locality || "").trim();
                if (!poblacion) throw new Error("poblacion-no-encontrada");

                campoPoblacion.value = poblacion;
                escribirEstadoUbicacion(`Ubicación detectada: ${poblacion}. Buscando talleres…`);
                formularioBusqueda?.requestSubmit();
            } catch (error) {
                const permisoDenegado = error?.code === 1;
                const fueraDeEspana = error?.message === "fuera-de-espana";
                escribirEstadoUbicacion(
                    fueraDeEspana
                        ? "La búsqueda automática está disponible actualmente en España."
                        : permisoDenegado
                            ? "No has permitido acceder a tu ubicación. Escribe la población manualmente."
                            : "No se pudo detectar tu población. Puedes escribirla manualmente.",
                    true
                );
            } finally {
                botonUbicacion.disabled = false;
                botonUbicacion.innerHTML = '<span aria-hidden="true">⌖</span> 2 · Mi ubicación';
            }
        }

        formularioBusqueda?.addEventListener("submit", (evento) => {
            evento.preventDefault();
            cargarTalleres(campoPoblacion?.value || "", campoServicio?.value || "");
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });

        botonUbicacion?.addEventListener("click", detectarPoblacion);

        botonCargarMas?.addEventListener("click", () => {
            cargarTalleres(poblacionActual, servicioActual, false);
        });

        document.querySelectorAll("[data-servicio]").forEach((enlace) => {
            enlace.addEventListener("click", (evento) => {
                evento.preventDefault();
                if (campoServicio) campoServicio.value = enlace.dataset.servicio || "";
                formularioBusqueda?.requestSubmit();
            });
        });

        cargarEstadisticas();
        cargarTalleres();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarAplicacion);
    } else {
        iniciarAplicacion();
    }
}());
