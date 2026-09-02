(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 30;

    if (!window.supabase?.createClient) {
        console.error("Supabase no está disponible");
        return;
    }

    const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const contenedor = document.getElementById("lista-talleres-provincia");
    if (!contenedor) return;

    const provinciaObjetivo = String(contenedor.dataset.provincia || "").trim();
    const estado = document.getElementById("estado-provincia");
    const listaMunicipios = document.getElementById("lista-municipios-provincia");
    const contenedorPaginacion = document.getElementById("contenedor-cargar-mas-provincia");
    const botonViejo = document.getElementById("boton-cargar-mas-provincia");
    botonViejo?.remove();

    let totalTalleres = 0;
    let cargando = false;

    function escapar(valor) {
        const div = document.createElement("div");
        div.textContent = valor == null ? "" : String(valor);
        return div.innerHTML;
    }

    function slug(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .replace(/-+/g, "-");
    }

    function urlSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(String(valor).trim());
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_) {
            return "";
        }
    }

    function paginaActual() {
        const pagina = Number(new URLSearchParams(location.search).get("pagina"));
        return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
    }

    function urlPagina(pagina) {
        const url = new URL(location.href);
        if (pagina > 1) url.searchParams.set("pagina", String(pagina));
        else url.searchParams.delete("pagina");
        return `${url.pathname}${url.search}`;
    }

    function urlFicha(taller) {
        const valor = String(taller.slug || "").trim();
        if (valor) return `/talleres/${encodeURIComponent(valor)}`;
        const base = slug(`${taller.nombre || "taller"}-${taller.ciudad || ""}`);
        return taller.id ? `/talleres/${base}-${String(taller.id).slice(0, 8)}` : "#";
    }

    function etiquetaServicio(servicio) {
        const raw = typeof servicio === "string" ? servicio : (servicio?.nombre || servicio?.slug || "");
        return window.TallerMapServicios?.etiquetas?.[raw]
            || String(raw).replace(/[-_]+/g, " ").replace(/^./, (l) => l.toLocaleUpperCase("es"));
    }

    function tarjeta(taller) {
        const nombrePlano = taller.nombre || "Taller sin nombre";
        const nombre = escapar(nombrePlano);
        const ubicacion = [taller.direccion, taller.ciudad, taller.provincia].filter(Boolean).map(escapar).join(", ");
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = urlSegura(taller.web);
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.slice(0, 4) : [];
        const distintivo = taller.verificado ? "✓ Información revisada" : "Información publicada";

        return `<article class="taller-card">
            <div class="taller-informacion">
                <span class="verificado verificado-en-contenido">${distintivo}</span>
                <h3>${nombre}</h3>
                <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                <div class="especialidades">${servicios.map((s) => `<span>${escapar(etiquetaServicio(s))}</span>`).join("")}</div>
                <div class="taller-pie">
                    <span class="abierto">● Disponible</span>
                    <span class="taller-contactos">
                        ${telefono ? `<a href="tel:${escapar(telefono)}">Llamar</a>` : ""}
                        ${web ? `<a href="${escapar(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : ""}
                        <a class="enlace-ficha-taller" href="${escapar(urlFicha(taller))}">Ver servicios</a>
                    </span>
                </div>
            </div>
        </article>`;
    }

    function pintarPaginacion() {
        if (!contenedorPaginacion) return;
        const paginas = Math.max(1, Math.ceil(totalTalleres / TAMANO_PAGINA));
        const actual = paginaActual();
        contenedorPaginacion.hidden = paginas <= 1;
        contenedorPaginacion.classList.add("municipio-paginacion");
        if (paginas <= 1) return;

        contenedorPaginacion.innerHTML = `
            ${actual > 1 ? `<a class="boton boton-claro" href="${escapar(urlPagina(actual - 1))}">← Anterior</a>` : '<span class="boton boton-claro deshabilitado" aria-disabled="true">← Anterior</span>'}
            <span aria-live="polite">Página ${actual} de ${paginas}</span>
            ${actual < paginas ? `<a class="boton" href="${escapar(urlPagina(actual + 1))}">Siguiente →</a>` : '<span class="boton deshabilitado" aria-disabled="true">Siguiente →</span>'}`;
    }

    async function cargarMunicipios() {
        if (!listaMunicipios) return;
        listaMunicipios.innerHTML = '<li class="mensaje-talleres">Calculando talleres por municipio…</li>';

        try {
            const { data, error } = await cliente.rpc("listar_municipios_publicos", {
                p_provincia: provinciaObjetivo
            });
            if (error) throw error;

            const municipios = Array.isArray(data) ? data : [];
            if (!municipios.length) {
                listaMunicipios.innerHTML = '<li class="mensaje-talleres">No hay municipios con talleres publicados.</li>';
                return;
            }

            listaMunicipios.innerHTML = municipios.map((municipio) => {
                const total = Number(municipio.total_talleres) || 0;
                const archivo = `${slug(municipio.municipio)}-${municipio.codigo_municipal}.html`;
                return `<li><a href="../municipios/${escapar(archivo)}"><strong>${escapar(municipio.municipio)}</strong><span>${total} ${total === 1 ? "taller" : "talleres"}</span></a></li>`;
            }).join("");
        } catch (error) {
            console.error("Error cargando municipios:", error);
            listaMunicipios.innerHTML = '<li class="mensaje-talleres">No se pudo cargar el directorio municipal.</li>';
        }
    }

    async function cargarTalleres() {
        if (cargando) return;
        cargando = true;
        const pagina = paginaActual();
        const desde = (pagina - 1) * TAMANO_PAGINA;
        contenedor.innerHTML = `<p class="mensaje-talleres">Cargando talleres de la provincia de ${escapar(provinciaObjetivo)}…</p>`;
        if (estado) estado.textContent = "Cargando…";

        try {
            const { data, error } = await cliente.rpc("buscar_talleres_provincia", {
                p_provincia: provinciaObjetivo,
                p_desde: desde,
                p_limite: TAMANO_PAGINA
            });
            if (error) throw error;

            const talleres = Array.isArray(data) ? data : [];
            totalTalleres = Number(talleres[0]?.total_resultados) || 0;

            if (!talleres.length) {
                contenedor.innerHTML = `<p class="mensaje-talleres">Todavía no hay talleres publicados en ${escapar(provinciaObjetivo)}.</p>`;
                if (estado) estado.textContent = "0 talleres";
                pintarPaginacion();
                return;
            }

            contenedor.innerHTML = talleres.map(tarjeta).join("");
            if (estado) estado.textContent = `${totalTalleres} ${totalTalleres === 1 ? "taller" : "talleres"}`;
            pintarPaginacion();
        } catch (error) {
            console.error("Error cargando provincia:", error);
            contenedor.innerHTML = '<p class="mensaje-talleres">No se pudieron cargar los talleres de la provincia.</p>';
            if (estado) estado.textContent = "Error de carga";
            if (contenedorPaginacion) contenedorPaginacion.hidden = true;
        } finally {
            cargando = false;
        }
    }

    Promise.allSettled([cargarMunicipios(), cargarTalleres()]);
}());
