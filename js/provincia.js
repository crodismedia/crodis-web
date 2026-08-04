(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 100;

    if (!window.supabase?.createClient) return;

    const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const contenedor = document.getElementById("lista-talleres-provincia");
    if (!contenedor) return;

    const provinciaObjetivo = String(contenedor.dataset.provincia || "").trim();
    const estado = document.getElementById("estado-provincia");

    function normalizar(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function escapar(valor) {
        const div = document.createElement("div");
        div.textContent = valor == null ? "" : String(valor);
        return div.innerHTML;
    }

    function urlSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(String(valor).trim());
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function coincideProvincia(valor) {
        const provincia = normalizar(valor);
        const objetivo = normalizar(provinciaObjetivo);
        if (!provincia || !objetivo) return false;
        return provincia === objetivo || provincia.includes(objetivo) || objetivo.includes(provincia);
    }

    function obtenerImagen(taller) {
        const principal = urlSegura(taller.imagen_url);
        if (principal) return { url: principal, tipo: taller.imagen_tipo || "real" };

        if (Array.isArray(taller.fotos)) {
            const primera = taller.fotos.map(urlSegura).find(Boolean);
            if (primera) return { url: primera, tipo: "real" };
        }

        return { url: "", tipo: "" };
    }

    function crearImagenHtml(taller, nombre) {
        const imagen = obtenerImagen(taller);
        const estadoTaller = taller.verificado ? "✓ Verificado" : "Publicado";

        if (!imagen.url) {
            return `<div class="taller-imagen taller-imagen-1"><span class="verificado">${estadoTaller}</span></div>`;
        }

        const aviso = imagen.tipo === "generica"
            ? `<span style="position:absolute;right:8px;bottom:8px;z-index:2;padding:5px 9px;border-radius:6px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;line-height:1.2">Imagen representativa</span>`
            : "";

        return `<div class="taller-imagen taller-imagen-real" style="position:relative;width:100%;height:190px;overflow:hidden;background:#e5e7eb">
            <img src="${escapar(imagen.url)}" alt="Imagen de ${nombre}" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.classList.add('taller-imagen-1')">
            <span class="verificado">${estadoTaller}</span>
            ${aviso}
        </div>`;
    }

    function tarjeta(taller) {
        const nombre = escapar(taller.nombre || taller.nombre_taller || "Taller sin nombre");
        const direccion = escapar(taller.direccion || "");
        const ciudad = escapar(taller.ciudad || "");
        const provincia = escapar(taller.provincia || provinciaObjetivo);
        const ubicacion = [direccion, ciudad, provincia].filter(Boolean).join(", ");
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = urlSegura(taller.web);
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.slice(0, 4) : [];
        const parametros = new URLSearchParams({
            nombre: taller.nombre || taller.nombre_taller || "Taller",
            direccion: [taller.direccion, taller.ciudad, taller.provincia].filter(Boolean).join(", ")
        });

        if (telefono) parametros.set("telefono", telefono);
        if (web) parametros.set("web", web);
        if (servicios.length) parametros.set("servicios", servicios.join("|"));

        return `<article class="taller-card">
            ${crearImagenHtml(taller, nombre)}
            <div class="taller-informacion">
                <h3>${nombre}</h3>
                <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                <div class="especialidades">${servicios.map((servicio) => `<span>${escapar(servicio)}</span>`).join("")}</div>
                <div class="taller-pie">
                    <span class="abierto">● Disponible</span>
                    <span class="taller-contactos">
                        ${telefono ? `<a href="tel:${escapar(telefono)}">Llamar</a>` : ""}
                        <a href="../pages/taller.html?${parametros.toString()}">Ver ficha</a>
                    </span>
                </div>
            </div>
        </article>`;
    }

    async function cargar() {
        contenedor.innerHTML = `<p class="mensaje-talleres">Cargando talleres de la provincia de ${escapar(provinciaObjetivo)}…</p>`;
        const encontrados = [];
        let desde = 0;
        let total = Infinity;

        try {
            while (desde < total && desde < 10000) {
                const { data, error } = await cliente.rpc("buscar_talleres_publicos", {
                    p_poblacion: "",
                    p_servicio: "",
                    p_desde: desde,
                    p_limite: TAMANO_PAGINA
                });

                if (error) throw error;
                const lote = Array.isArray(data) ? data : [];
                if (!lote.length) break;

                encontrados.push(...lote.filter((taller) => coincideProvincia(taller.provincia)));
                const informado = Number(lote[0]?.total_resultados);
                total = Number.isFinite(informado) ? informado : desde + lote.length;
                desde += lote.length;
                if (lote.length < TAMANO_PAGINA) break;
            }

            encontrados.sort((a, b) => {
                const nombreA = String(a.nombre || a.nombre_taller || "Taller sin nombre");
                const nombreB = String(b.nombre || b.nombre_taller || "Taller sin nombre");
                const porNombre = nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
                return porNombre || String(a.ciudad || "").localeCompare(String(b.ciudad || ""), "es", { sensitivity: "base" });
            });

            if (!encontrados.length) {
                contenedor.innerHTML = `<p class="mensaje-talleres">Todavía no hay talleres publicados con la provincia ${escapar(provinciaObjetivo)}.</p>`;
                if (estado) estado.textContent = "0 talleres";
                return;
            }

            contenedor.innerHTML = encontrados.map(tarjeta).join("");
            if (estado) estado.textContent = `${encontrados.length} ${encontrados.length === 1 ? "taller" : "talleres"}`;
        } catch (error) {
            console.error("No se pudieron cargar los talleres de la provincia:", error);
            contenedor.innerHTML = `<p class="mensaje-talleres">No se pudieron cargar los talleres de la provincia. Inténtalo de nuevo más tarde.</p>`;
            if (estado) estado.textContent = "Error de carga";
        }
    }

    cargar();
}());
