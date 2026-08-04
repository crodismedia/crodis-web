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

    function enlacesDeFicha(tarjeta) {
        return [...tarjeta.querySelectorAll("a")].filter((enlace) => {
            try {
                const url = new URL(enlace.href, window.location.origin);
                return url.pathname === LEGACY_PATH
                    || url.pathname.startsWith(CLEAN_PREFIX)
                    || enlace.classList.contains("enlace-ficha-taller");
            } catch (_error) {
                return false;
            }
        });
    }

    function limpiarEnlacesTarjeta(tarjeta) {
        if (!(tarjeta instanceof Element)) return;
        const enlaces = enlacesDeFicha(tarjeta);
        if (!enlaces.length) return;

        const slug = enlaces.map(slugDesdeEnlace).find(Boolean);
        if (!slug) return;

        const principal = enlaces.find((enlace) =>
            enlace.classList.contains("enlace-ficha-taller")
        ) || enlaces[0];
        const destino = urlLimpia(slug);

        if (principal.getAttribute("href") !== destino) principal.href = destino;
        principal.classList.add("enlace-ficha-taller");
        if (principal.textContent.trim() !== "Ver ficha") principal.textContent = "Ver ficha";

        enlaces.forEach((enlace) => {
            if (enlace !== principal && enlace.isConnected) enlace.remove();
        });
    }

    function procesarNodo(nodo) {
        if (!(nodo instanceof Element)) return;
        if (nodo.matches(".taller-card")) limpiarEnlacesTarjeta(nodo);
        nodo.querySelectorAll?.(".taller-card").forEach(limpiarEnlacesTarjeta);

        if (nodo.matches("a.taller-relacionado")) {
            const slug = slugDesdeEnlace(nodo);
            if (slug) nodo.href = urlLimpia(slug);
        }
        nodo.querySelectorAll?.("a.taller-relacionado").forEach((enlace) => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) enlace.href = urlLimpia(slug);
        });
    }

    function actualizarFichaUnaVez() {
        const ruta = window.location.pathname;
        const parametros = new URLSearchParams(window.location.search);
        const slug = ruta.startsWith(CLEAN_PREFIX)
            ? slugSeguro(ruta.slice(CLEAN_PREFIX.length))
            : slugSeguro(parametros.get("slug") || "");

        if (!slug) return;
        const limpia = urlLimpia(slug);
        const absoluta = `${SITE_URL}${limpia}`;

        if (ruta === LEGACY_PATH) {
            window.history.replaceState({}, "", limpia);
        }

        const canonical = document.getElementById("canonical-taller")
            || document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = absoluta;
    }

    function iniciar() {
        document.querySelectorAll(".taller-card").forEach(limpiarEnlacesTarjeta);
        document.querySelectorAll("a.taller-relacionado").forEach((enlace) => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) enlace.href = urlLimpia(slug);
        });
        actualizarFichaUnaVez();

        const raiz = document.body;
        if (!raiz) return;
        new MutationObserver((cambios) => {
            cambios.forEach((cambio) => {
                cambio.addedNodes.forEach(procesarNodo);
            });
        }).observe(raiz, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
