(function () {
    "use strict";

    // ========== DEPENDENCIAS ==========
    // Este archivo depende de:
    // - taller-urls-core.js (window.TallerMapTallerUrls)
    // - taller-ui.js (window.TallerMapTallerUI)

    if (!window.TallerMapTallerUrls) {
        console.error("[TallerURLs] Dependencia faltante: taller-urls-core.js");
        return;
    }

    if (!window.TallerMapTallerUI) {
        console.warn("[TallerURLs] Dependencia faltante: taller-ui.js (algunas funciones pueden no estar disponibles)");
    }

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 3600000, // 1 hora
        STORAGE_KEY: "tallermap_urls_cache",
        MAX_RECENT: 10,
        TIMEOUT_REDIRECT: 3000,
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[TallerURLs]", ...args);
        }
    }

    // ========== REFERENCIAS ==========
    const core = window.TallerMapTallerUrls;
    const ui = window.TallerMapTallerUI || {};

    // ========== CACHE ==========
    function guardarCache(key, data) {
        try {
            const item = {
                data: data,
                timestamp: Date.now(),
                expiry: CONFIG.CACHE_DURATION,
            };
            localStorage.setItem(`${CONFIG.STORAGE_KEY}_${key}`, JSON.stringify(item));
            log(`Cache guardado para ${key}`);
        } catch (error) {
            console.warn("[TallerURLs] Error al guardar cache:", error);
        }
    }

    function cargarCache(key) {
        try {
            const itemStr = localStorage.getItem(`${CONFIG.STORAGE_KEY}_${key}`);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            const ahora = Date.now();

            if (ahora - item.timestamp > item.expiry) {
                localStorage.removeItem(`${CONFIG.STORAGE_KEY}_${key}`);
                log(`Cache expirado para ${key}`);
                return null;
            }

            log(`Cache cargado para ${key}`);
            return item.data;
        } catch (error) {
            console.warn("[TallerURLs] Error al cargar cache:", error);
            return null;
        }
    }

    // ========== HISTORIAL DE URLs ==========
    function guardarEnHistorial(url) {
        try {
            let historial = JSON.parse(localStorage.getItem('tallermap_historial') || '[]');
            
            // Eliminar duplicados y mantener orden
            historial = historial.filter(item => item !== url);
            historial.unshift(url);
            
            // Limitar tamaño
            if (historial.length > CONFIG.MAX_RECENT) {
                historial = historial.slice(0, CONFIG.MAX_RECENT);
            }
            
            localStorage.setItem('tallermap_historial', JSON.stringify(historial));
            log(`URL guardada en historial: ${url}`);
        } catch (error) {
            console.warn("[TallerURLs] Error al guardar historial:", error);
        }
    }

    function obtenerHistorial() {
        try {
            return JSON.parse(localStorage.getItem('tallermap_historial') || '[]');
        } catch {
            return [];
        }
    }

    function limpiarHistorial() {
        try {
            localStorage.removeItem('tallermap_historial');
            log("Historial limpiado");
            return true;
        } catch {
            return false;
        }
    }

    // ========== GENERADORES DE URLs ESPECÍFICOS ==========
    function urlMapaTalleres(opciones = {}) {
        const base = opciones.base || "/mapa";
        const params = new URLSearchParams();

        if (opciones.centro) {
            const { lat, lng } = opciones.centro;
            params.set("lat", String(lat));
            params.set("lng", String(lng));
        }

        if (opciones.zoom) {
            params.set("zoom", String(opciones.zoom));
        }

        if (opciones.servicio) {
            params.set("servicio", core.codificarParametro(opciones.servicio));
        }

        if (opciones.poblacion) {
            params.set("poblacion", core.codificarParametro(opciones.poblacion));
        }

        const query = params.toString();
        return query ? `${base}?${query}` : base;
    }

    function urlCompartirTaller(taller, opciones = {}) {
        const url = core.urlTaller(taller);
        if (!url || url === "#") return "#";

        const params = new URLSearchParams();
        params.set("url", url);
        
        if (opciones.titulo) {
            params.set("titulo", core.codificarParametro(opciones.titulo));
        }

        const plataforma = opciones.plataforma || "whatsapp";
        const shareUrls = {
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`${opciones.titulo || ''} ${url}`)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(opciones.titulo || '')}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            email: `mailto:?subject=${encodeURIComponent(opciones.titulo || '')}&body=${encodeURIComponent(`Mira este taller: ${url}`)}`,
        };

        return shareUrls[plataforma] || shareUrls.whatsapp;
    }

    function urlImagenTaller(taller, opciones = {}) {
        if (!taller) return core.CONFIG.DEFAULT_IMAGE;

        const tamaño = opciones.tamaño || "medium";
        const tamanos = {
            small: "200x200",
            medium: "400x400",
            large: "800x800",
            original: "original",
        };

        const foto = taller.foto || taller.fotoFirmada || taller.imagen;
        if (!foto) return core.CONFIG.DEFAULT_IMAGE;

        // Si es URL de Supabase, añadir transformación
        if (foto.includes('supabase.co')) {
            const params = new URLSearchParams();
            if (tamaños[tamaño] && tamaño !== "original") {
                params.set("width", tamanos[tamaño].split('x')[0]);
                params.set("height", tamanos[tamaño].split('x')[1]);
                params.set("resize", "cover");
            }
            return `${foto}${foto.includes('?') ? '&' : '?'}${params.toString()}`;
        }

        return core.urlImagen(foto, opciones);
    }

    // ========== REDIRECCIONES INTELIGENTES ==========
    function redirigirInicio(opciones = {}) {
        const { reemplazar = false, delay = 0 } = opciones;
        
        const url = "/";
        if (delay > 0) {
            setTimeout(() => {
                core.redirigir(url, { reemplazar });
            }, delay);
        } else {
            core.redirigir(url, { reemplazar });
        }
    }

    function redirigirBusqueda(opciones = {}) {
        const url = core.urlBusqueda(opciones);
        if (url && url !== "#") {
            core.redirigir(url, { reemplazar: opciones.reemplazar || false });
            return true;
        }
        return false;
    }

    function redirigir404(opciones = {}) {
        const { reemplazar = false, delay = 0 } = opciones;
        
        const url = "/404";
        if (delay > 0) {
            setTimeout(() => {
                core.redirigir(url, { reemplazar });
            }, delay);
        } else {
            core.redirigir(url, { reemplazar });
        }
    }

    function detectarRedireccionAutomatica() {
        // Detectar si hay parámetros de redirección en la URL
        const params = core.obtenerParametrosUrl();
        
        if (params.redirect) {
            const url = params.redirect;
            core.redirigir(url, { reemplazar: true });
            return true;
        }

        if (params.taller) {
            const tallerId = params.taller;
            // Intentar cargar taller y redirigir
            // Esto normalmente se haría con una llamada a API
            log(`Redirección a taller: ${tallerId}`);
            return true;
        }

        return false;
    }

    // ========== ENLACES Y ANCLAS ==========
    function generarLinkTaller(taller, opciones = {}) {
        if (!taller) return "";

        const url = core.urlTaller(taller);
        const nombre = ui.escaparHTML ? ui.escaparHTML(taller.nombre || taller.empresa || "Taller") : taller.nombre || "Taller";
        const target = opciones.target || "_self";
        const rel = opciones.external ? "noopener noreferrer" : "";
        const cssClass = opciones.className || "taller-link";

        if (!url || url === "#") {
            return `<span class="${cssClass}">${nombre}</span>`;
        }

        return `<a href="${url}" target="${target}" rel="${rel}" class="${cssClass}" title="${nombre}">${nombre}</a>`;
    }

    function generarLinkBusqueda(texto, opciones = {}) {
        const params = new URLSearchParams();
        
        if (opciones.poblacion) {
            params.set("poblacion", core.codificarParametro(opciones.poblacion));
        }
        if (opciones.servicio) {
            params.set("servicio", core.codificarParametro(opciones.servicio));
        }

        const query = params.toString();
        const url = query ? `/buscador?${query}` : "/buscador";
        const target = opciones.target || "_self";
        const cssClass = opciones.className || "busqueda-link";

        return `<a href="${url}" target="${target}" class="${cssClass}">${texto}</a>`;
    }

    function generarBotonCompartir(taller, opciones = {}) {
        const plataformas = opciones.plataformas || ["whatsapp", "facebook", "twitter", "linkedin", "email"];
        const titulo = opciones.titulo || `Visita este taller: ${taller.nombre || ''}`;
        
        const botones = plataformas.map(plataforma => {
            const url = core.urlCompartirTaller(taller, { plataforma, titulo });
            const iconos = {
                whatsapp: '📱',
                facebook: '👍',
                twitter: '🐦',
                linkedin: '💼',
                email: '✉️',
            };
            
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="compartir-btn compartir-${plataforma}" title="Compartir en ${plataforma}">
                ${iconos[plataforma] || '🔗'}
            </a>`;
        }).join('');

        return `<div class="compartir-botones">${botones}</div>`;
    }

    // ========== VALIDACIÓN DE URLs ==========
    function validarUrlTaller(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const urlObj = new URL(url, window.location.origin);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            // Verificar que es una URL de taller válida
            return pathParts.includes('taller') && pathParts.length >= 2;
        } catch {
            return false;
        }
    }

    function extraerSlugDeUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            const slugIndex = pathParts.indexOf('taller');
            if (slugIndex !== -1 && slugIndex + 1 < pathParts.length) {
                return pathParts[slugIndex + 1];
            }
            
            return null;
        } catch {
            return null;
        }
    }

    function urlEsValida(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // ========== UTILIDADES PARA NAVEGACIÓN ==========
    function navegarA(url, opciones = {}) {
        const { reemplazar = false, state = null, title = "" } = opciones;
        
        if (!url || url === "#") return false;

        try {
            if (state !== null) {
                window.history.pushState(state, title, url);
                if (title) document.title = title;
            } else if (reemplazar) {
                window.history.replaceState(state, title, url);
                if (title) document.title = title;
            } else {
                window.history.pushState({}, title, url);
                if (title) document.title = title;
            }
            
            // Disparar evento de navegación
            const event = new CustomEvent('navigation', { detail: { url, state, title } });
            window.dispatchEvent(event);
            
            log(`Navegación a: ${url}`);
            return true;
        } catch {
            return false;
        }
    }

    function recargarUrl(reemplazar = false) {
        if (reemplazar) {
            window.location.replace(window.location.href);
        } else {
            window.location.reload();
        }
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.TallerMapTallerUrls = {
        ...window.TallerMapTallerUrls,
        
        // Configuración
        CONFIG: CONFIG,
        
        // Cache
        guardarCache: guardarCache,
        cargarCache: cargarCache,
        
        // Historial
        guardarEnHistorial: guardarEnHistorial,
        obtenerHistorial: obtenerHistorial,
        limpiarHistorial: limpiarHistorial,
        
        // Generadores específicos
        urlMapaTalleres: urlMapaTalleres,
        urlCompartirTaller: urlCompartirTaller,
        urlImagenTaller: urlImagenTaller,
        
        // Redirecciones inteligentes
        redirigirInicio: redirigirInicio,
        redirigirBusqueda: redirigirBusqueda,
        redirigir404: redirigir404,
        detectarRedireccionAutomatica: detectarRedireccionAutomatica,
        
        // Enlaces y anclas
        generarLinkTaller: generarLinkTaller,
        generarLinkBusqueda: generarLinkBusqueda,
        generarBotonCompartir: generarBotonCompartir,
        
        // Validación
        validarUrlTaller: validarUrlTaller,
        extraerSlugDeUrl: extraerSlugDeUrl,
        urlEsValida: urlEsValida,
        
        // Navegación
        navegarA: navegarA,
        recargarUrl: recargarUrl,
    };

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("TallerURLs integrado inicializado");
        
        // Detectar redirecciones automáticas
        if (detectarRedireccionAutomatica()) {
            log("Redirección automática detectada y ejecutada");
            return;
        }

        // Inicializar listeners para enlaces dinámicos
        document.addEventListener('click', function(event) {
            const link = event.target.closest('a[data-nav]');
            if (link) {
                event.preventDefault();
                const url = link.getAttribute('href');
                const title = link.textContent || "";
                navegarA(url, { title });
            }
        });

        // Guardar URL actual en historial
        const urlActual = window.location.href;
        guardarEnHistorial(urlActual);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
