(function () {
    "use strict";

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        BASE_URL: window.location.origin || "",
        PATH_TALLER: "/taller",
        PATH_BUSCADOR: "/buscador",
        PATH_PERFIL: "/perfil",
        PARAM_POBLACION: "poblacion",
        PARAM_SERVICIO: "servicio",
        PARAM_PAGINA: "pagina",
        PARAM_ORDEN: "orden",
        MAX_SLUG_LENGTH: 100,
        DEFAULT_IMAGE: "/images/taller-default.jpg",
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[TallerURLs]", ...args);
        }
    }

    // ========== UTILIDADES ==========
    function escaparHTML(texto) {
        if (!texto) return "";
        const mapa = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return String(texto).replace(/[&<>"']/g, function(m) {
            return mapa[m];
        });
    }

    function slugSeguro(texto) {
        if (!texto) return "";
        
        return String(texto)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, CONFIG.MAX_SLUG_LENGTH);
    }

    function urlSegura(url) {
        if (!url) return "";
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return "";
            }
            return url;
        } catch {
            return "";
        }
    }

    function codificarParametro(valor) {
        if (!valor) return "";
        return encodeURIComponent(String(valor));
    }

    function decodificarParametro(valor) {
        if (!valor) return "";
        try {
            return decodeURIComponent(valor);
        } catch {
            return valor;
        }
    }

    // ========== GENERACIÓN DE SLUGS ==========
    function generarSlugTaller(taller) {
        if (!taller || typeof taller !== 'object') {
            log("Taller inválido para generar slug");
            return "";
        }

        const nombre = taller.nombre || taller.empresa || "taller";
        const id = taller.id || taller.uuid || taller.slug || "";
        
        // Si ya tiene un slug, usarlo
        if (taller.slug && typeof taller.slug === 'string') {
            return slugSeguro(taller.slug);
        }

        // Generar slug combinando nombre e id
        const slugBase = slugSeguro(nombre);
        if (id) {
            const idCorto = String(id).slice(-6);
            return `${slugBase}-${idCorto}`;
        }
        
        return slugBase;
    }

    function generarSlugCategoria(categoria) {
        if (!categoria) return "";
        return slugSeguro(categoria.nombre || categoria);
    }

    function generarSlugServicio(servicio) {
        if (!servicio) return "";
        return slugSeguro(servicio.nombre || servicio.slug || servicio);
    }

    // ========== GENERACIÓN DE URLs ==========
    function urlTaller(taller, opciones = {}) {
        if (!taller) return "#";

        const slug = opciones.slug || generarSlugTaller(taller);
        const base = opciones.base || CONFIG.PATH_TALLER;
        
        if (!slug) {
            log("No se pudo generar URL para taller:", taller);
            return "#";
        }

        let url = `${base}/${slug}`;
        
        // Añadir parámetros
        const params = new URLSearchParams();
        if (opciones.utm) {
            Object.entries(opciones.utm).forEach(([key, value]) => {
                params.set(`utm_${key}`, String(value));
            });
        }
        if (opciones.ref) {
            params.set("ref", String(opciones.ref));
        }
        
        const query = params.toString();
        if (query) {
            url += `?${query}`;
        }
        
        return url;
    }

    function urlBusqueda(opciones = {}) {
        const base = opciones.base || CONFIG.PATH_BUSCADOR;
        const params = new URLSearchParams();

        // Añadir parámetros de búsqueda
        if (opciones.poblacion) {
            params.set(CONFIG.PARAM_POBLACION, codificarParametro(opciones.poblacion));
        }
        if (opciones.servicio) {
            params.set(CONFIG.PARAM_SERVICIO, codificarParametro(opciones.servicio));
        }
        if (opciones.pagina) {
            params.set(CONFIG.PARAM_PAGINA, String(opciones.pagina));
        }
        if (opciones.orden) {
            params.set(CONFIG.PARAM_ORDEN, String(opciones.orden));
        }

        // Añadir filtros adicionales
        if (opciones.filtros) {
            Object.entries(opciones.filtros).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    params.set(key, String(value));
                }
            });
        }

        const query = params.toString();
        return query ? `${base}?${query}` : base;
    }

    function urlPerfil(tallerId, opciones = {}) {
        if (!tallerId) return "#";
        
        const base = opciones.base || CONFIG.PATH_PERFIL;
        const params = new URLSearchParams();
        
        params.set("id", String(tallerId));
        
        if (opciones.accion) {
            params.set("accion", String(opciones.accion));
        }
        
        return `${base}?${params.toString()}`;
    }

    function urlImagen(ruta, opciones = {}) {
        if (!ruta) return CONFIG.DEFAULT_IMAGE;

        // Si es URL completa, validarla
        if (ruta.startsWith('http://') || ruta.startsWith('https://')) {
            return urlSegura(ruta) || CONFIG.DEFAULT_IMAGE;
        }

        // Si es ruta relativa, construir URL completa
        const base = opciones.base || window.location.origin;
        const path = ruta.startsWith('/') ? ruta : `/${ruta}`;
        
        const url = `${base}${path}`;
        return urlSegura(url) || CONFIG.DEFAULT_IMAGE;
    }

    // ========== PARSING DE URLs ==========
    function parsearUrlTaller(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            // Buscar slug en la URL
            const slugIndex = pathParts.indexOf('taller');
            if (slugIndex === -1 || slugIndex + 1 >= pathParts.length) {
                return null;
            }

            const slug = pathParts[slugIndex + 1];
            const params = Object.fromEntries(urlObj.searchParams);

            return {
                slug: slug,
                params: params,
                utm: {
                    source: params.utm_source || null,
                    medium: params.utm_medium || null,
                    campaign: params.utm_campaign || null,
                },
                ref: params.ref || null,
            };
        } catch {
            return null;
        }
    }

    function parsearUrlBusqueda(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const params = urlObj.searchParams;

            return {
                poblacion: decodificarParametro(params.get(CONFIG.PARAM_POBLACION) || ""),
                servicio: decodificarParametro(params.get(CONFIG.PARAM_SERVICIO) || ""),
                pagina: parseInt(params.get(CONFIG.PARAM_PAGINA)) || 1,
                orden: params.get(CONFIG.PARAM_ORDEN) || "relevancia",
                filtros: Object.fromEntries(
                    Array.from(params.entries())
                        .filter(([key]) => ![
                            CONFIG.PARAM_POBLACION,
                            CONFIG.PARAM_SERVICIO,
                            CONFIG.PARAM_PAGINA,
                            CONFIG.PARAM_ORDEN
                        ].includes(key))
                ),
            };
        } catch {
            return null;
        }
    }

    // ========== CONSTRUCCIÓN DE URLs AMIGABLES ==========
    function urlAmigable(texto, opciones = {}) {
        const slug = slugSeguro(texto);
        const prefijo = opciones.prefijo || "";
        const sufijo = opciones.sufijo || "";
        
        return `${prefijo}${slug}${sufijo}`;
    }

    function urlCategoria(categoria, opciones = {}) {
        const slug = generarSlugCategoria(categoria);
        if (!slug) return "#";
        
        return `/categoria/${slug}`;
    }

    function urlServicio(servicio, opciones = {}) {
        const slug = generarSlugServicio(servicio);
        if (!slug) return "#";
        
        return `/servicio/${slug}`;
    }

    function urlCiudad(ciudad, provincia = "", opciones = {}) {
        const ciudadSlug = slugSeguro(ciudad);
        if (!ciudadSlug) return "#";
        
        let url = `/ciudad/${ciudadSlug}`;
        if (provincia) {
            url += `?provincia=${codificarParametro(provincia)}`;
        }
        
        return url;
    }

    // ========== REDIRECCIONES ==========
    function redirigir(url, opciones = {}) {
        const { reemplazar = false, external = false } = opciones;
        
        if (!url || url === "#") {
            log("URL inválida para redirección");
            return false;
        }

        try {
            const urlObj = new URL(url, window.location.origin);
            
            if (external && urlObj.origin !== window.location.origin) {
                // Redirección externa
                if (reemplazar) {
                    window.location.replace(url);
                } else {
                    window.location.href = url;
                }
                return true;
            }

            // Redirección interna
            const ruta = urlObj.pathname + urlObj.search + urlObj.hash;
            if (reemplazar) {
                window.location.replace(ruta);
            } else {
                window.location.href = ruta;
            }
            return true;
        } catch {
            log("Error al redirigir a:", url);
            return false;
        }
    }

    function redirigirTaller(taller, opciones = {}) {
        const url = urlTaller(taller, opciones);
        if (url && url !== "#") {
            return redirigir(url, opciones);
        }
        return false;
    }

    // ========== MODIFICACIÓN DE URL ACTUAL ==========
    function actualizarUrlBusqueda(opciones = {}, reemplazar = false) {
        const url = urlBusqueda(opciones);
        if (!url) return false;

        try {
            if (reemplazar) {
                window.history.replaceState({}, "", url);
            } else {
                window.history.pushState({}, "", url);
            }
            return true;
        } catch {
            return false;
        }
    }

    function actualizarParametroUrl(key, value, reemplazar = false) {
        try {
            const url = new URL(window.location.href);
            
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            } else {
                url.searchParams.delete(key);
            }
            
            if (reemplazar) {
                window.history.replaceState({}, "", url.toString());
            } else {
                window.history.pushState({}, "", url.toString());
            }
            return true;
        } catch {
            return false;
        }
    }

    function obtenerParametrosUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            return Object.fromEntries(params.entries());
        } catch {
            return {};
        }
    }

    function obtenerParametroUrl(key) {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get(key);
        } catch {
            return null;
        }
    }

    // ========== CANONICAL Y META URLs ==========
    function urlCanonica(taller) {
        if (!taller) return window.location.href;
        
        const slug = generarSlugTaller(taller);
        return `${window.location.origin}${CONFIG.PATH_TALLER}/${slug}`;
    }

    function urlAmigableParaSEO(texto, opciones = {}) {
        const slug = slugSeguro(texto);
        const prefijo = opciones.prefijo || "";
        const sufijo = opciones.sufijo || "";
        const idioma = opciones.idioma || "es";
        
        return `/${idioma}${prefijo}${slug}${sufijo}`;
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.TallerMapTallerUrls = {
        // Constantes
        CONFIG: CONFIG,
        
        // Utilidades
        log: log,
        escaparHTML: escaparHTML,
        slugSeguro: slugSeguro,
        urlSegura: urlSegura,
        codificarParametro: codificarParametro,
        decodificarParametro: decodificarParametro,
        
        // Generación de slugs
        generarSlugTaller: generarSlugTaller,
        generarSlugCategoria: generarSlugCategoria,
        generarSlugServicio: generarSlugServicio,
        
        // Generación de URLs
        urlTaller: urlTaller,
        urlBusqueda: urlBusqueda,
        urlPerfil: urlPerfil,
        urlImagen: urlImagen,
        urlAmigable: urlAmigable,
        urlCategoria: urlCategoria,
        urlServicio: urlServicio,
        urlCiudad: urlCiudad,
        
        // Parsing de URLs
        parsearUrlTaller: parsearUrlTaller,
        parsearUrlBusqueda: parsearUrlBusqueda,
        
        // Redirecciones
        redirigir: redirigir,
        redirigirTaller: redirigirTaller,
        
        // Modificación de URL actual
        actualizarUrlBusqueda: actualizarUrlBusqueda,
        actualizarParametroUrl: actualizarParametroUrl,
        obtenerParametrosUrl: obtenerParametrosUrl,
        obtenerParametroUrl: obtenerParametroUrl,
        
        // Canonical y SEO
        urlCanonica: urlCanonica,
        urlAmigableParaSEO: urlAmigableParaSEO,
    };

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("TallerURLs core inicializado");
        
        // Escuchar cambios en la URL (para SPA)
        window.addEventListener('popstate', function(event) {
            log("Cambio de estado detectado:", event.state);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
