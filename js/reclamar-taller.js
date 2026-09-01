(function() {
    "use strict";

    // ============ CONFIGURACIÓN ============
    const CONFIG = {
        SITE_URL: "https://www.tallermap.es",
        CLEAN_PREFIX: "/talleres/",
        DEBUG: false
    };

    // ============ UTILIDADES ============
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[Redirect]", ...args);
        }
    }

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function urlLimpia(slug) {
        const limpio = slugSeguro(slug);
        return limpio ? ${CONFIG.CLEAN_PREFIX}${limpio} : "";
    }

    // ============ DETECTORES DE RUTAS LEGACY ============
    function detectarTipoLegacy(path, params) {
        // 1. Ruta de taller.php
        if (path.includes("taller.php")) {
            const id = params.get("id") || params.get("taller_id");
            const nombre = params.get("nombre") || params.get("slug");
            return { tipo: "php", id, nombre };
        }

        // 2. Ruta de /pages/taller.html
        if (path === "/pages/taller.html" || path.includes("/pages/taller.html")) {
            const slug = params.get("slug") || params.get("taller");
            return { tipo: "pages", slug };
        }

        // 3. Ruta con ID numérico (/taller/123)
        const matchId = path.match(/\/taller\/(\d+)/);
        if (matchId) {
            return { tipo: "id", id: matchId[1] };
        }

        // 4. Ruta con slug antiguo (/taller/mi-taller)
        const matchSlug = path.match(/\/taller\/([a-z0-9-]+)/);
        if (matchSlug) {
            return { tipo: "slug", slug: matchSlug[1] };
        }

        // 5. Ruta con parámetro slug
        if (params.has("slug")) {
            return { tipo: "param", slug: params.get("slug") };
        }

        // 6. Ruta con nombre de taller en URL
        const matchNombre = path.match(/\/taller\/(.+)/);
        if (matchNombre) {
            return { tipo: "nombre", nombre: matchNombre[1] };
        }

        // 7. Ruta con formato antiguo /taller.php?slug=xxx
        if (path.includes("taller.php") && params.has("slug")) {
            return { tipo: "php-slug", slug: params.get("slug") };
        }

        // 8. Ruta con ID y nombre /taller/123-mi-taller
        const matchIdNombre = path.match(/\/taller\/(\d+)-(.+)/);
        if (matchIdNombre) {
            return { tipo: "id-nombre", id: matchIdNombre[1], nombre: matchIdNombre[2] };
        }

        return { tipo: "unknown" };
    }

    // ============ OBTENER SLUG CORRECTO ============
    function obtenerSlugCorrecto(path, params) {
        const deteccion = detectarTipoLegacy(path, params);
        log("Detección:", deteccion);

        switch (deteccion.tipo) {
            case "php":
            case "pages":
            case "param":
            case "php-slug":
                return slugSeguro(deteccion.slug);

            case "id":
                // Intentar obtener nombre desde el DOM o API
                const nombre = document.querySelector("#taller-nombre, .taller-nombre")?.textContent?.trim();
                return nombre ? slugSeguro(nombre) : deteccion.id;

            case "slug":
                return slugSeguro(deteccion.slug);

            case "nombre":
                return slugSeguro(deteccion.nombre);

            case "id-nombre":
                return slugSeguro(deteccion.nombre) || deteccion.id;

            case "unknown":
                // Intentar extraer de la URL
                const partes = path.split("/").filter(Boolean);
                const ultimo = partes[partes.length - 1];
                if (ultimo && ultimo !== "taller" && ultimo !== "pages") {
                    return slugSeguro(ultimo);
                }
                return "";

            default:
                return "";
        }
    }

    // ============ MANEJADORES DE REDIRECCIÓN ============
    function manejarRedireccion(destino, permanente = true) {
        if (!destino) return false;

        // Verificar que no estamos ya en el destino correcto
        const path = window.location.pathname;
        if (path === destino || path === ${destino}/) {
            log("Ya en el destino correcto");
            return false;
        }

        const urlCompleta = ${window.location.origin}${destino};
        log(Redirigiendo a: ${urlCompleta});

        if (permanente) {
            window.location.replace(urlCompleta);
        } else {
            window.location.href = urlCompleta;
        }
        return true;
    }

    function manejarRedireccionesLegacy() {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const esLegacy = detectarTipoLegacy(path, params).tipo !== "unknown";

        log("Path:", path);
        log("Es Legacy:", esLegacy);

        // Si es una URL legacy, redirigir
        if (esLegacy) {
            const slug = obtenerSlugCorrecto(path, params);
            if (slug) {
                const destino = urlLimpia(slug);
                if (destino) {
                    manejarRedireccion(destino, true);
                    return true;
                }
            }
        }

        // Caso especial: URL con caracteres codificados
        if (path.includes("%") || decodeURIComponent(path) !== path) {
            const slug = slugSeguro(decodeURIComponent(path));
            if (slug) {
                const destino = urlLimpia(slug);
                if (destino && destino !== path) {
                    manejarRedireccion(destino, true);
                    return true;
                }
            }
        }

        // Caso especial: Redirigir /taller/ a /talleres/
        if (path.startsWith("/taller/") && !path.startsWith(CONFIG.CLEAN_PREFIX)) {
            const slug = slugSeguro(path.replace("/taller/", ""));
            if (slug) {
                const destino = urlLimpia(slug);
                if (destino) {
                    manejarRedireccion(destino, true);
                    return true;
                }
            }
        }

        return false;
    }

    // ============ GUARDAR HISTORIAL ============
    function guardarHistorialRedireccion(origen, destino) {
        try {
            const historial = JSON.parse(sessionStorage.getItem("redirect-history") || "[]");
            historial.push({
                from: origen,
                to: destino,
                timestamp: new Date().toISOString()
            });
            // Mantener solo los últimos 50
            if (historial.length > 50) {
                historial.splice(0, historial.length - 50);
            }
            sessionStorage.setItem("redirect-history", JSON.stringify(historial));
        } catch (_) {
            // Ignorar errores de almacenamiento
        }
    }

    // ============ NOTIFICAR A GOOGLE ============
    function notificarGoogle(origen, destino) {
        // Ping a Google Search Console si existe el endpoint
        if (navigator.sendBeacon) {
            try {
                const data = new FormData();
                data.append("from", origen);
                data.append("to", destino);
                data.append("type", "redirect");
                navigator.sendBeacon("/api/analytics/redirect", data);
            } catch (_) {
                // Ignorar errores
            }
        }
    }

    // ============ INICIALIZACIÓN ============
    function inicializar() {
        const path = window.location.pathname;
        const esPaginaTaller = path === "/pages/taller.html" || 
                               path.startsWith("/talleres/") ||
                               path.startsWith("/taller/") ||
                               document.querySelector("#taller-nombre") !== null;

        if (!esPaginaTaller) {
            log("No es página de taller, omitiendo");
            return;
        }

        // Intentar redirigir
        const redirigido = manejarRedireccionesLegacy();

        if (redirigido) {
            const destino = window.location.pathname;
            guardarHistorialRedireccion(path, destino);
            notificarGoogle(path, destino);
        } else {
            log("No se requirió redirección");
        }
    }

    // ============ EJECUCIÓN ============
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar, { once: true });
    } else {
        inicializar();
    }

    // ============ EXPORTAR (para pruebas) ============
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            detectarTipoLegacy,
            obtenerSlugCorrecto,
            manejarRedireccionesLegacy,
            CONFIG
        };
    }

})();
