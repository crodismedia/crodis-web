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
    const RADIOS_CERCANOS_KM = [3, 10, 25, 50];
    let siguienteIndice = 0;
    let poblacionActual = "";
    let servicioActual = "";
    let totalResultadosActual = 0;
    let cargandoTalleres = false;
    let modoUbicacion = false;

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

    function horarioHtml(horarios) {
        if (!horarios || typeof horarios !== "object") return "";
        const dias = [
            ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
            ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
            ["domingo", "Domingo"]
        ];
        const filas = dias.map(([clave, etiqueta]) => {
            const horario = horarios[clave];
            if (!horario) return "";
            const texto = horario.cerrado
                ? "Cerrado"
                : (horario.turnos || []).map((turno) => `${turno.apertura}–${turno.cierre}`).join(" y ");
            return texto
                ? `<div><dt>${etiqueta}</dt><dd>${escaparHTML(texto)}</dd></div>`
                : "";
        }).filter(Boolean).join("");
        return filas
            ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${filas}</dl></details>`
            : "";
    }

    function distanciaHtml(distanciaKm) {
        const distancia = Number(distanciaKm);
        if (!Number.isFinite(distancia) || distancia < 0) return "";
        const texto = new Intl.NumberFormat("es-ES", {
            minimumFractionDigits: distancia < 10 ? 1 : 0,
            maximumFractionDigits: distancia < 10 ? 1 : 0
        }).format(distancia);
        return `<p class="ubicacion"><strong>A ${texto} km de tu ubicación</strong></p>`;
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
        const horario = horarioHtml(taller.horarios);
        const distancia = distanciaHtml(taller.distancia_km);
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
                    ${distancia}
                    <p class="taller-descripcion">${descripcion}</p>
                    <div class="especialidades">
                        ${etiquetas.map((servicio) => `<span>${escaparHTML(etiquetaServicio(servicio))}</span>`).join("")}
                    </div>
                    ${horario}
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

        contenedorBoton.hidden = modoUbicacion || !hayMas;
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

        modoUbicacion = false;
        if (reiniciar) {
            siguienteIndice = 0;
            totalResultadosActual = 0;
            poblacionActual = terminoSeguro(poblacion);
            servicioActual = servicio;
            mostrarEstado(contenedor, "Cargando talleres...");
            actualizarBotonCarga(false);
        }

        const desde = siguienteIndice;
        cargandoTalleres = true;
        if (!reiniciar) actualizarBotonCarga(true, true);

        try {
            const { data, error } = await supabaseClient.rpc("buscar_talleres_publicos", {
                p_poblacion: poblacionActual,
                p_servicio: servicioActual,
                p_desde: desde,
                p_limite: TAMANO_PAGINA
            });
            const talleres = Array.isArray(data) ? data : [];
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
            if (!talleres.length && reiniciar) {
                mostrarEstado(contenedor, "No hemos encontrado talleres con esos criterios.");
                actualizarNumeroResultados(0);
                actualizarBotonCarga(false);
                return;
            }
            if (!talleres.length) {
                actualizarBotonCarga(false);
                return;
            }

            const talleresConFotos = await adjuntarFotosFirmadas(talleres);
            const tarjetas = talleresConFotos.map(crearTarjetaTaller).join("");
            if (reiniciar) contenedor.innerHTML = tarjetas;
            else contenedor.insertAdjacentHTML("beforeend", tarjetas);

            siguienteIndice += talleres.length;
            const totalInformado = Number(talleres[0]?.total_resultados);
            if (Number.isFinite(totalInformado)) totalResultadosActual = totalInformado;
            else totalResultadosActual = Math.max(totalResultadosActual, siguienteIndice);
            const hayMas = siguienteIndice < totalResultadosActual;
            actualizarNumeroResultados(totalResultadosActual);
            actualizarBotonCarga(hayMas);
        } finally {
            cargandoTalleres = false;
        }
    }

    async function cargarTalleresCercanos(latitud, longitud, servicio = "") {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || cargandoTalleres) return null;

        modoUbicacion = true;
        siguienteIndice = 0;
        poblacionActual = "";
        servicioActual = servicio;
        cargandoTalleres = true;
        mostrarEstado(contenedor, "Calculando talleres cercanos...");
        actualizarBotonCarga(false);

        try {
            let talleres = [];
            let radioUtilizado = RADIOS_CERCANOS_KM.at(-1);

            for (const radio of RADIOS_CERCANOS_KM) {
                const { data, error } = await supabaseClient.rpc("buscar_talleres_cercanos", {
                    p_latitud: latitud,
                    p_longitud: longitud,
                    p_radio_km: radio,
                    p_servicio: servicio || null,
                    p_limite: 50
                });

                if (error) throw error;
                talleres = Array.isArray(data) ? data : [];
                radioUtilizado = radio;
                if (talleres.length) break;
            }

            if (!talleres.length) {
                mostrarEstado(
                    contenedor,
                    "No encontramos talleres con coordenadas en un radio de 50 km. Puedes buscar por población."
                );
                actualizarNumeroResultados(0, "0 cercanos");
                return { total: 0, radio: radioUtilizado };
            }

            const talleresConFotos = await adjuntarFotosFirmadas(talleres);
            contenedor.innerHTML = talleresConFotos.map(crearTarjetaTaller).join("");
            actualizarNumeroResultados(talleres.length, `${talleres.length} por cercanía`);
            return { total: talleres.length, radio: radioUtilizado };
        } catch (error) {
            console.error("No se pudieron buscar talleres cercanos:", error);
            mostrarEstado(
                contenedor,
                "No se pudo calcular la distancia. Comprueba la función buscar_talleres_cercanos en Supabase."
            );
            actualizarNumeroResultados(0);
            return null;
        } finally {
            cargandoTalleres = false;
            actualizarBotonCarga(false);
        }
    }

    function actualizarNumeroResultados(total, textoPersonalizado = "") {
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) {
            indicador.textContent = textoPersonalizado
                || `${total} ${total === 1 ? "disponible" : "disponibles"}`;
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
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 120000
                });
            });
        }

        async function buscarDesdeMiUbicacion() {
            if (!botonUbicacion) return;

            botonUbicacion.disabled = true;
            botonUbicacion.textContent = "Localizando…";
            escribirEstadoUbicacion("Solicitando permiso y calculando distancias reales…");

            try {
                const posicion = await obtenerPosicionActual();
                const latitud = Number(posicion.coords.latitude);
                const longitud = Number(posicion.coords.longitude);
                if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
                    throw new Error("coordenadas-no-validas");
                }

                if (campoPoblacion) campoPoblacion.value = "";
                const resultado = await cargarTalleresCercanos(
                    latitud,
                    longitud,
                    campoServicio?.value || ""
                );
                document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });

                if (resultado?.total) {
                    escribirEstadoUbicacion(
                        `${resultado.total} ${resultado.total === 1 ? "taller encontrado" : "talleres encontrados"} a menos de ${resultado.radio} km, ordenados por distancia.`
                    );
                } else if (resultado) {
                    escribirEstadoUbicacion(
                        "No hay talleres con coordenadas a menos de 50 km. Prueba la búsqueda por población.",
                        true
                    );
                } else {
                    escribirEstadoUbicacion("No se pudo completar la búsqueda por distancia.", true);
                }
            } catch (error) {
                const permisoDenegado = error?.code === 1;
                escribirEstadoUbicacion(
                    permisoDenegado
                        ? "No has permitido acceder a tu ubicación. Puedes escribir la población manualmente."
                        : "No se pudo obtener tu ubicación. Puedes escribir la población manualmente.",
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

        botonUbicacion?.addEventListener("click", buscarDesdeMiUbicacion);

        botonCargarMas?.addEventListener("click", () => {
            if (!modoUbicacion) cargarTalleres(poblacionActual, servicioActual, false);
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
