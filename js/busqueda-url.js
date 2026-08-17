(function () {
    "use strict";

    const normalizarTexto = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const slugMunicipio = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    function prepararMenuTalleres() {
        document.querySelectorAll('header a[href="/#talleres"]').forEach(enlace => {
            enlace.setAttribute("href", "/talleres.html");
        });
    }

    function prepararServicios() {
        const seccion = document.getElementById("servicios");
        if (!seccion) return;

        let lista = document.getElementById("lista-servicios-publicos");
        if (!lista) {
            const contenedor = seccion.querySelector(".contenedor") || seccion;
            lista = document.createElement("div");
            lista.id = "lista-servicios-publicos";
            lista.className = "servicios-grid";
            contenedor.appendChild(lista);
        }

        if (window.TallerMapServicios?.rellenarTarjetas) {
            window.TallerMapServicios.rellenarTarjetas(lista);
        }
    }

    function prepararMenuDesguaces() {
        const enlaces = [...document.querySelectorAll('a[href="/desguaces.html"]')];
        if (!enlaces.length) return;

        if (!document.getElementById("estilos-menu-desguaces")) {
            const estilo = document.createElement("style");
            estilo.id = "estilos-menu-desguaces";
            estilo.textContent = `
                .tm-desguaces-menu{position:relative;display:inline-flex;align-items:stretch}
                .tm-desguaces-menu>a{display:flex!important;align-items:center;gap:5px}
                .tm-desguaces-menu>a::after{content:"▾";font-size:.72em}
                .tm-desguaces-submenu{display:none;position:absolute;top:100%;left:0;z-index:10000;min-width:190px;padding:8px;background:#fff;border:1px solid #dfe6ef;border-radius:12px;box-shadow:0 16px 34px rgba(20,36,64,.16)}
                .tm-desguaces-submenu a{display:block!important;padding:10px 12px!important;border-radius:8px!important;white-space:nowrap}
                .tm-desguaces-submenu a:hover,.tm-desguaces-submenu a:focus{background:#f3f7ff;outline:none}
                .tm-desguaces-menu:hover .tm-desguaces-submenu,.tm-desguaces-menu:focus-within .tm-desguaces-submenu{display:block}
                .menu-movil-panel .tm-desguaces-menu{display:block;width:100%}
                .menu-movil-panel .tm-desguaces-menu>a{width:100%}
                .menu-movil-panel .tm-desguaces-submenu{display:grid;position:static;min-width:0;margin:0 0 4px 14px;padding:0 0 0 12px;border:0;border-left:2px solid #dfe6ef;border-radius:0;box-shadow:none}
                .menu-movil-panel .tm-desguaces-submenu a{padding:10px 12px!important;font-size:.92em;font-weight:700!important}
            `;
            document.head.appendChild(estilo);
        }

        enlaces.forEach(enlace => {
            if (enlace.closest(".tm-desguaces-menu")) return;
            const contenedor = document.createElement("span");
            contenedor.className = "tm-desguaces-menu";
            enlace.parentNode.insertBefore(contenedor, enlace);
            contenedor.appendChild(enlace);

            const submenu = document.createElement("span");
            submenu.className = "tm-desguaces-submenu";
            submenu.innerHTML = `
                <a href="/desguaces.html?provincia=castellon">Castellón</a>
                <a href="/desguaces.html?provincia=valencia">Valencia</a>
                <a href="/desguaces.html?provincia=alicante">Alicante</a>
            `;
            contenedor.appendChild(submenu);
        });
    }

    function cargarMapaReal() {
        if (document.querySelector('script[data-tallermap-mapa="1"]')) return;
        const script = document.createElement("script");
        script.src = "/js/mapa-talleres.js?v=20260817-1";
        script.defer = true;
        script.dataset.tallermapMapa = "1";
        document.head.appendChild(script);
    }

    function obtenerPosicionActual() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 15000
            });
        });
    }

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const buscar = document.getElementById("boton-buscar");
        if (!formulario || !poblacion || !servicio || !buscar) return;

        formulario.querySelectorAll(".campo-icono").forEach(el => el.remove());
        const bloquePoblacion = poblacion.closest(".campo-busqueda");
        const contenidoPoblacion = bloquePoblacion?.querySelector(":scope > div");
        bloquePoblacion?.querySelectorAll("small").forEach(el => el.remove());

        const radioExistente = document.getElementById("radio-busqueda");
        radioExistente?.remove();
        const url = new URL(location.href);
        if (url.searchParams.has("radio")) {
            url.searchParams.delete("radio");
            history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
        }

        let estado = document.getElementById("estado-ubicacion");
        if (!estado) {
            estado = document.createElement("small");
            estado.id = "estado-ubicacion";
            estado.setAttribute("aria-live", "polite");
        }

        contenidoPoblacion?.appendChild(ubicacion);
        contenidoPoblacion?.appendChild(estado);
        contenidoPoblacion?.appendChild(buscar);

        formulario.addEventListener("submit", evento => {
            const nombreMunicipio = String(poblacion.value || "").trim();
            const codigoMunicipal = String(poblacion.dataset.codigoMunicipal || "").trim();

            if (!nombreMunicipio || !/^\d{5}$/.test(codigoMunicipal)) return;

            const slug = slugMunicipio(nombreMunicipio);
            if (!slug) return;

            evento.preventDefault();
            evento.stopImmediatePropagation();

            const parametros = new URLSearchParams();
            const servicioSeleccionado = String(servicio.value || "").trim();
            if (servicioSeleccionado) parametros.set("servicio", servicioSeleccionado);

            const query = parametros.toString();
            const destino = `/municipios/${slug}-${codigoMunicipal}.html${query ? `?${query}` : ""}#talleres`;
            window.location.assign(destino);
        }, true);

        ubicacion.onclick = async () => {
            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";
            estado.textContent = "Buscando tu ubicación…";
            try {
                const posicion = await obtenerPosicionActual();
                const parametros = new URLSearchParams({
                    format: "jsonv2",
                    lat: String(posicion.coords.latitude),
                    lon: String(posicion.coords.longitude),
                    zoom: "18",
                    addressdetails: "1",
                    "accept-language": "es"
                });
                const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?${parametros}`, {
                    headers: { Accept: "application/json" }
                });
                if (!respuesta.ok) throw new Error("No se pudo resolver la ubicación");

                const datos = await respuesta.json();
                const d = datos.address || {};
                const localidad = d.city || d.town || d.village || d.municipality || d.city_district || "";
                const cp = String(d.postcode || "").match(/^\d{5}$/)?.[0] || "";
                if (!localidad && !cp) throw new Error("No se pudo identificar la población");

                poblacion.value = localidad || cp;
                poblacion.dataset.codigoMunicipal = "";
                estado.textContent = localidad
                    ? `Ubicación detectada: ${localidad}${cp ? ` (${cp})` : ""}. Buscando talleres de esta población…`
                    : `Código postal detectado: ${cp}. Buscando talleres…`;

                formulario.requestSubmit();
            } catch (error) {
                console.error("Ubicación por población:", error);
                estado.textContent = "No se pudo obtener tu población. Revisa el permiso de ubicación.";
            } finally {
                ubicacion.disabled = false;
                ubicacion.textContent = "Usar mi ubicación";
            }
        };

        const params = new URLSearchParams(location.search);
        const poblacionUrl = params.get("poblacion");
        if (poblacionUrl && !poblacion.value) poblacion.value = poblacionUrl.slice(0, 80);
        const servicioUrl = normalizarTexto(params.get("servicio"));
        if (servicioUrl) {
            const opcion = [...servicio.options].find(o =>
                normalizarTexto(o.value) === servicioUrl || normalizarTexto(o.textContent) === servicioUrl
            );
            if (opcion) servicio.value = opcion.value;
        }
    }

    function iniciar() {
        prepararMenuTalleres();
        prepararServicios();
        prepararMenuDesguaces();
        prepararBuscador();
        cargarMapaReal();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
}());
