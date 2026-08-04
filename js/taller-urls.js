(function () {
    "use strict";

    const SITE_URL = "https://www.tallermap.es";
    const CLEAN_PREFIX = "/talleres/";
    const LEGACY_PATH = "/pages/taller.html";

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function slugDesdeEnlace(enlace) {
        try {
            const url = new URL(enlace.href, window.location.origin);
            const parametro = url.searchParams.get("slug");
            if (parametro) return slugSeguro(parametro);

            if (url.pathname.startsWith(CLEAN_PREFIX)) {
                return slugSeguro(url.pathname.slice(CLEAN_PREFIX.length));
            }
        } catch (_error) {
            return "";
        }

        return "";
    }

    function urlLimpia(slug) {
        const limpio = slugSeguro(slug);
        return limpio ? `${CLEAN_PREFIX}${limpio}` : "";
    }

    function limpiarEnlacesTarjeta(tarjeta) {
        const enlacesFicha = [...tarjeta.querySelectorAll("a")]
            .filter((enlace) => {
                try {
                    const url = new URL(enlace.href, window.location.origin);
                    return url.pathname === LEGACY_PATH
                        || url.pathname.startsWith(CLEAN_PREFIX)
                        || enlace.classList.contains("enlace-ficha-taller");
                } catch (_error) {
                    return false;
                }
            });

        if (!enlacesFicha.length) return;

        const slug = enlacesFicha.map(slugDesdeEnlace).find(Boolean);
        if (!slug) return;

        let principal = enlacesFicha.find((enlace) =>
            enlace.classList.contains("enlace-ficha-taller")
        ) || enlacesFicha[0];

        principal.href = urlLimpia(slug);
        principal.classList.add("enlace-ficha-taller");
        principal.textContent = "Ver ficha";

        enlacesFicha.forEach((enlace) => {
            if (enlace !== principal) enlace.remove();
        });
    }

    function limpiarEnlacesPagina() {
        document.querySelectorAll(".taller-card").forEach(limpiarEnlacesTarjeta);

        document.querySelectorAll("a.taller-relacionado").forEach((enlace) => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) enlace.href = urlLimpia(slug);
        });
    }

    function slugActual() {
        const ruta = window.location.pathname;
        if (ruta.startsWith(CLEAN_PREFIX)) {
            return slugSeguro(ruta.slice(CLEAN_PREFIX.length));
        }

        const parametros = new URLSearchParams(window.location.search);
        return slugSeguro(parametros.get("slug") || "");
    }

    function actualizarFicha() {
        const slug = slugActual();
        if (!slug) return;

        const ruta = urlLimpia(slug);
        const absoluta = `${SITE_URL}${ruta}`;

        if (window.location.pathname === LEGACY_PATH) {
            window.history.replaceState({}, "", ruta);
        }

        const canonical = document.getElementById("canonical-taller")
            || document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = absoluta;

        ["datos-estructurados-taller", "datos-estructurados-migas"].forEach((id) => {
            const script = document.getElementById(id);
            if (!script?.textContent) return;

            try {
                const datos = JSON.parse(script.textContent);
                const reemplazar = (valor) => {
                    if (typeof valor === "string" && valor.includes(LEGACY_PATH)) {
                        return absoluta;
                    }
                    if (Array.isArray(valor)) return valor.map(reemplazar);
                    if (valor && typeof valor === "object") {
                        Object.keys(valor).forEach((clave) => {
                            valor[clave] = reemplazar(valor[clave]);
                        });
                    }
                    return valor;
                };
                script.textContent = JSON.stringify(reemplazar(datos));
            } catch (_error) {
                // El contenido puede estar actualizándose todavía; el observador lo reintentará.
            }
        });
    }

    function ejecutar() {
        limpiarEnlacesPagina();
        actualizarFicha();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ejecutar, { once: true });
    } else {
        ejecutar();
    }

    new MutationObserver(ejecutar).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}());
