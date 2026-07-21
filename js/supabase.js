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

    const ETIQUETAS_SERVICIOS = {
        "mecanica-general": "Mecánica general",
        "chapa-pintura": "Chapa y pintura",
        neumaticos: "Neumáticos",
        "diagnosis-electronica": "Diagnosis electrónica",
        "aire-acondicionado": "Aire acondicionado",
        "hibridos-electricos": "Híbridos y eléctricos"
    };

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }
    window.escaparHTML = escaparHTML;

    function etiquetaServicio(servicio) {
        return ETIQUETAS_SERVICIOS[servicio] || servicio;
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
        const distintivo = taller.verificado ? "✓ Verificado" : "Publicado";
        const servicios = Array.isArray(taller.servicios) ? taller.servicios : [];
        const etiquetas = servicios.length ? servicios.slice(0, 4) : ["Taller mecánico"];
        const contacto = telefono
            ? `<a href="tel:${escaparHTML(telefono)}" aria-label="Llamar a ${nombre}">Llamar</a>`
            : "<span>Consulta su ficha</span>";

        return `
            <article class="taller-card">
                <div class="taller-imagen taller-imagen-1">
                    <span class="verificado">${distintivo}</span>
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

    function terminoSeguro(valor) {
        return String(valor || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
    }

    async function cargarTalleres(ubicacion = "", servicio = "") {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor) return;

        mostrarEstado(contenedor, "Cargando talleres...");

        const termino = terminoSeguro(ubicacion);
        function construirConsulta(incluirServicios) {
            const columnas = incluirServicios
                ? "id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,descripcion,servicios,verificado"
                : "id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,descripcion,verificado";
            let consulta = supabaseClient
                .from("talleres")
                .select(columnas)
                .eq("activo", true)
                .limit(50);

            if (termino) {
                consulta = consulta.or(
                    `ciudad.ilike.%${termino}%,provincia.ilike.%${termino}%,codigo_postal.ilike.%${termino}%`
                );
            }
            if (servicio && incluirServicios) {
                consulta = consulta.contains("servicios", [servicio]);
            }
            return consulta;
        }

        let resultado = await construirConsulta(true);
        if (
            resultado.error?.code === "42703" &&
            String(resultado.error.message || "").includes("servicios")
        ) {
            resultado = await construirConsulta(false);
        }

        const { data: talleres, error } = resultado;
        if (error) {
            console.error("No se pudieron cargar los talleres:", error);
            mostrarEstado(
                contenedor,
                "No se pudieron cargar los talleres. Comprueba la configuración pública de Supabase."
            );
            return;
        }
        if (!talleres?.length) {
            mostrarEstado(contenedor, "No hemos encontrado talleres con esos criterios.");
            actualizarNumeroResultados(0);
            return;
        }

        contenedor.innerHTML = talleres.map(crearTarjetaTaller).join("");
        actualizarNumeroResultados(talleres.length);
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
        const campoUbicacion = document.getElementById("ubicacion");
        const campoServicio = document.getElementById("servicio");

        formularioBusqueda?.addEventListener("submit", (evento) => {
            evento.preventDefault();
            cargarTalleres(campoUbicacion?.value || "", campoServicio?.value || "");
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });

        document.querySelectorAll("[data-servicio]").forEach((enlace) => {
            enlace.addEventListener("click", (evento) => {
                evento.preventDefault();
                if (campoServicio) campoServicio.value = enlace.dataset.servicio || "";
                formularioBusqueda?.requestSubmit();
            });
        });

        cargarTalleres();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarAplicacion);
    } else {
        iniciarAplicacion();
    }
}());
