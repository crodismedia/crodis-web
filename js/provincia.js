(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const TAMANO_PAGINA = 30;
    const TAMANO_LOTE_LEGADO = 100;
    const PREFIJOS_PROVINCIA = {
        alicante: "03",
        alacant: "03",
        castellon: "12",
        castello: "12",
        valencia: "46"
    };

    if (!window.supabase?.createClient) return;

    const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const contenedor = document.getElementById("lista-talleres-provincia");
    if (!contenedor) return;

    const provinciaObjetivo = String(contenedor.dataset.provincia || "").trim();
    const estado = document.getElementById("estado-provincia");
    const listaMunicipios = document.getElementById("lista-municipios-provincia");
    const botonCargarMas = document.getElementById("boton-cargar-mas-provincia");
    const contenedorCargarMas = document.getElementById("contenedor-cargar-mas-provincia");
    let siguienteIndice = (paginaSolicitada() - 1) * TAMANO_PAGINA;
    let totalTalleres = 0;
    let cargando = false;
    let datosLegadosPromesa = null;

    function normalizar(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
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

    function codigoProvincia() {
        const provincia = normalizar(provinciaObjetivo);
        const clave = Object.keys(PREFIJOS_PROVINCIA).find((nombre) => provincia.includes(nombre));
        return clave ? PREFIJOS_PROVINCIA[clave] : "";
    }

    function coincideProvincia(taller) {
        const prefijo = codigoProvincia();
        const codigoPostal = String(taller.codigo_postal || "");
        if (prefijo && codigoPostal.startsWith(prefijo)) return true;

        const provincia = normalizar(taller.provincia);
        if (!provincia) return false;
        if (prefijo === "03") return provincia.includes("alicante") || provincia.includes("alacant");
        if (prefijo === "12") return provincia.includes("castellon") || provincia.includes("castello");
        if (prefijo === "46") return provincia.includes("valencia");
        return provincia === normalizar(provinciaObjetivo);
    }

    function slugMunicipio(nombre) {
        return String(nombre || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .replace(/-+/g, "-");
    }

    function slugTaller(taller) {
        if (taller.slug) return String(taller.slug);
        const base = slugMunicipio(`${taller.nombre || "taller"}-${taller.ciudad || ""}`);
        return taller.id ? `${base}-${String(taller.id).slice(0, 8)}` : base;
    }

    function urlFicha(taller) {
        const slug = slugTaller(taller);
        return slug ? `/talleres/${encodeURIComponent(slug)}` : "";
    }

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(talleres
            .map((taller) => Array.isArray(taller.fotos) ? taller.fotos[0] : "")
            .filter((ruta) => ruta && !urlSegura(ruta)))];
        if (!rutas.length || !cliente.storage?.from) return talleres;

        const { data, error } = await cliente.storage
            .from("fotos-talleres")
            .createSignedUrls(rutas, 3600);
        if (error) return talleres;

        const porRuta = new Map((data || []).map((foto) => [foto.path, foto.signedUrl || foto.signedURL || ""]));
        return talleres.map((taller) => {
            const primera = Array.isArray(taller.fotos) ? taller.fotos[0] : "";
            return { ...taller, fotoFirmada: urlSegura(primera) || porRuta.get(primera) || "" };
        });
    }

    function imagenHtml(taller, nombre) {
        const imagen = urlSegura(taller.imagen_url) || urlSegura(taller.fotoFirmada)
            || (Array.isArray(taller.fotos) ? taller.fotos.map(urlSegura).find(Boolean) : "");
        const distintivo = taller.verificado ? "✓ Verificado" : "Publicado";
        return `<div class="taller-imagen ${imagen ? "taller-imagen-real" : "taller-imagen-1"}"${imagen ? ' style="position:relative;width:100%;height:190px;overflow:hidden;background:#e5e7eb"' : ""}>
            ${imagen ? `<img src="${escapar(imagen)}" alt="Imagen de ${nombre}" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:cover">` : ""}
            <span class="verificado">${distintivo}</span>
        </div>`;
    }

    function tarjeta(taller) {
        const nombre = escapar(taller.nombre || taller.nombre_taller || "Taller sin nombre");
        const ubicacion = [taller.direccion, taller.ciudad, taller.provincia].filter(Boolean).map(escapar).join(", ");
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const web = urlSegura(taller.web);
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.slice(0, 4) : [];

        return `<article class="taller-card">
            ${imagenHtml(taller, nombre)}
            <div class="taller-informacion">
                <h3>${nombre}</h3>
                <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                <div class="especialidades">${servicios.map((servicio) => `<span>${escapar(servicio)}</span>`).join("")}</div>
                <div class="taller-pie">
                    <span class="abierto">● Disponible</span>
                    <span class="taller-contactos">
                        ${telefono ? `<a href="tel:${escapar(telefono)}">Llamar</a>` : ""}
                        ${web ? `<a href="${escapar(web)}" target="_blank" rel="noopener noreferrer">Web</a>` : ""}
                        <a class="enlace-ficha-taller" href="${escapar(urlFicha(taller))}">Ver ficha</a>
                    </span>
                </div>
            </div>
        </article>`;
    }

    function paginaSolicitada() {
        const pagina = Number(new URLSearchParams(window.location.search).get("pagina"));
        return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
    }

    function urlPagina(pagina) {
        const url = new URL(window.location.href);
        if (pagina > 1) url.searchParams.set("pagina", String(pagina));
        else url.searchParams.delete("pagina");
        return `${url.pathname}${url.search}`;
    }

    function actualizarBotonCarga(_hayMas, ocupado = false) {
        if (!contenedorCargarMas) return;
        const paginas = Math.max(1, Math.ceil(totalTalleres / TAMANO_PAGINA));
        const actual = Math.floor(siguienteIndice / TAMANO_PAGINA) + 1;
        const anteriorDeshabilitado = ocupado || actual <= 1;
        const siguienteDeshabilitado = ocupado || actual >= paginas;
        contenedorCargarMas.hidden = totalTalleres <= TAMANO_PAGINA;
        contenedorCargarMas.classList.add("municipio-paginacion");
        contenedorCargarMas.innerHTML = `
            <a id="pagina-anterior-provincia" class="boton boton-claro${anteriorDeshabilitado ? " deshabilitado" : ""}"
               aria-disabled="${anteriorDeshabilitado}" href="${escapar(urlPagina(Math.max(1, actual - 1)))}">← Anterior</a>
            <span aria-live="polite">Página ${actual} de ${paginas}</span>
            <a id="pagina-siguiente-provincia" class="boton${siguienteDeshabilitado ? " deshabilitado" : ""}"
               aria-disabled="${siguienteDeshabilitado}" href="${escapar(urlPagina(Math.min(paginas, actual + 1)))}">Siguiente →</a>`;
        contenedorCargarMas.querySelectorAll("a").forEach((enlace) => enlace.addEventListener("click", (evento) => {
            evento.preventDefault();
            if (enlace.getAttribute("aria-disabled") === "true") return;
            const pagina = Number(new URL(enlace.href).searchParams.get("pagina")) || 1;
            window.history.pushState({}, "", urlPagina(pagina));
            siguienteIndice = (pagina - 1) * TAMANO_PAGINA;
            cargarTalleres(false);
            contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
        }));
    }

    async function obtenerDatosLegados() {
        if (datosLegadosPromesa) return datosLegadosPromesa;
        datosLegadosPromesa = (async () => {
            const encontrados = [];
            let desde = 0;
            let total = Infinity;
            while (desde < total && desde < 10000) {
                const { data, error } = await cliente.rpc("buscar_talleres_publicos", {
                    p_poblacion: "",
                    p_servicio: "",
                    p_desde: desde,
                    p_limite: TAMANO_LOTE_LEGADO
                });
                if (error) throw error;
                const lote = Array.isArray(data) ? data : [];
                if (!lote.length) break;
                encontrados.push(...lote.filter(coincideProvincia));
                const informado = Number(lote[0]?.total_resultados);
                total = Number.isFinite(informado) ? informado : desde + lote.length;
                desde += lote.length;
                if (lote.length < TAMANO_LOTE_LEGADO) break;
            }
            return encontrados.sort((a, b) =>
                String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
            );
        })();
        return datosLegadosPromesa;
    }

    async function municipiosLegados() {
        const prefijo = codigoProvincia();
        const [{ data, error }, talleres] = await Promise.all([
            cliente.from("municipios").select("codigo_municipal,nombre").eq("activo", true).order("nombre"),
            obtenerDatosLegados()
        ]);
        if (error) throw error;

        const catalogo = (data || []).filter((municipio) =>
            String(municipio.codigo_municipal || "").startsWith(prefijo)
        );
        return catalogo.map((municipio) => {
            const alias = String(municipio.nombre || "").split("/").map(normalizar);
            const ids = new Set(talleres
                .filter((taller) => alias.includes(normalizar(taller.ciudad)))
                .map((taller) => taller.id || `${taller.nombre}-${taller.direccion}`));
            return {
                codigo_municipal: municipio.codigo_municipal,
                municipio: municipio.nombre,
                total_talleres: ids.size
            };
        }).filter((municipio) => municipio.total_talleres > 0);
    }

    function mostrarMunicipios(municipios) {
        if (!listaMunicipios) return;
        if (!municipios.length) {
            listaMunicipios.innerHTML = '<li class="mensaje-talleres">No hay municipios con talleres publicados.</li>';
            return;
        }
        listaMunicipios.innerHTML = municipios
            .sort((a, b) => String(a.municipio).localeCompare(String(b.municipio), "es", { sensitivity: "base" }))
            .map((municipio) => {
                const total = Number(municipio.total_talleres) || 0;
                const archivo = `${slugMunicipio(municipio.municipio)}-${municipio.codigo_municipal}.html`;
                return `<li data-nombre="${escapar(normalizar(municipio.municipio))}">
                    <a href="../municipios/${escapar(archivo)}">
                        <strong>${escapar(municipio.municipio)}</strong>
                        <span>${total} ${total === 1 ? "taller" : "talleres"}</span>
                    </a>
                </li>`;
            }).join("");
    }

    async function cargarMunicipios() {
        if (!listaMunicipios) return;
        listaMunicipios.innerHTML = '<li class="mensaje-talleres">Calculando talleres por municipio…</li>';
        try {
            let municipios = [];
            const { data, error } = await cliente.rpc("listar_municipios_publicos", {
                p_provincia: provinciaObjetivo
            });
            if (!error) municipios = Array.isArray(data) ? data : [];
            else municipios = await municipiosLegados();
            mostrarMunicipios(municipios);
        } catch (error) {
            console.error("No se pudieron cargar los municipios de la provincia:", error);
            listaMunicipios.innerHTML = '<li class="mensaje-talleres">No se pudo cargar el directorio municipal en este momento.</li>';
        }
    }

    async function cargarTalleres(reiniciar = true) {
        if (cargando) return;
        if (reiniciar) {
            siguienteIndice = (paginaSolicitada() - 1) * TAMANO_PAGINA;
            totalTalleres = 0;
            contenedor.innerHTML = `<p class="mensaje-talleres">Cargando talleres de la provincia de ${escapar(provinciaObjetivo)}…</p>`;
            actualizarBotonCarga(false);
        }

        cargando = true;
        if (!reiniciar) actualizarBotonCarga(true, true);
        try {
            let talleres;
            let total;
            const { data, error } = await cliente.rpc("buscar_talleres_provincia", {
                p_provincia: provinciaObjetivo,
                p_desde: siguienteIndice,
                p_limite: TAMANO_PAGINA
            });
            if (!error) {
                talleres = Array.isArray(data) ? data : [];
                total = Number(talleres[0]?.total_resultados) || 0;
            } else {
                const legados = await obtenerDatosLegados();
                total = legados.length;
                talleres = legados.slice(siguienteIndice, siguienteIndice + TAMANO_PAGINA);
            }

            if (!talleres.length && reiniciar) {
                contenedor.innerHTML = `<p class="mensaje-talleres">Todavía no hay talleres publicados en ${escapar(provinciaObjetivo)}.</p>`;
                if (estado) estado.textContent = "0 talleres";
                return;
            }

            const conFotos = await adjuntarFotosFirmadas(talleres);
            const tarjetas = conFotos.map(tarjeta).join("");
            contenedor.innerHTML = tarjetas;
            totalTalleres = total;
            if (estado) estado.textContent = `${totalTalleres} ${totalTalleres === 1 ? "taller" : "talleres"}`;
            actualizarBotonCarga(siguienteIndice + talleres.length < totalTalleres);
        } catch (error) {
            console.error("No se pudieron cargar los talleres de la provincia:", error);
            if (reiniciar) contenedor.innerHTML = '<p class="mensaje-talleres">No se pudieron cargar los talleres de la provincia.</p>';
            if (estado) estado.textContent = "Error de carga";
            actualizarBotonCarga(false);
        } finally {
            cargando = false;
        }
    }

    botonCargarMas?.remove();
    window.addEventListener("popstate", () => {
        siguienteIndice = (paginaSolicitada() - 1) * TAMANO_PAGINA;
        cargarTalleres(false);
    });
    Promise.allSettled([cargarMunicipios(), cargarTalleres(true)]);
}());
