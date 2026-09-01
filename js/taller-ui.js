(function () {
    "use strict";

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 3600000, // 1 hora
        STORAGE_KEY: "tallermap_ui_cache",
        MAX_DESCRIPCION: 150,
        DEFAULT_IMAGE: "/images/taller-default.jpg",
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[TallerUI]", ...args);
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

    function webSegura(url) {
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

    function slugTaller(taller) {
        if (!taller) return "";
        const nombre = taller.nombre || taller.empresa || "";
        const id = taller.id || taller.uuid || "";
        return `${String(nombre).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id}`.replace(/^-+|-+$/g, "");
    }

    function formatearDireccion(taller) {
        if (!taller) return "";
        const partes = [];
        if (taller.direccion) partes.push(taller.direccion);
        if (taller.municipio) partes.push(taller.municipio);
        if (taller.provincia) partes.push(taller.provincia);
        return partes.join(", ");
    }

    function formatearPrecio(precio) {
        if (!precio && precio !== 0) return "Consultar";
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(precio);
    }

    function truncarTexto(texto, limite = CONFIG.MAX_DESCRIPCION) {
        if (!texto) return "";
        if (texto.length <= limite) return texto;
        return texto.substring(0, limite).trim() + "...";
    }

    function obtenerValoracion(taller) {
        if (!taller) return null;
        const valoracion = taller.valoracion || taller.puntuacion || taller.rating;
        if (typeof valoracion === 'number' && valoracion > 0) {
            return Math.min(5, Math.max(0, valoracion));
        }
        return null;
    }

    function obtenerNumeroValoraciones(taller) {
        if (!taller) return 0;
        return taller.num_valoraciones || taller.total_valoraciones || 0;
    }

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
            console.warn("[TallerUI] Error al guardar cache:", error);
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
            console.warn("[TallerUI] Error al cargar cache:", error);
            return null;
        }
    }

    function limpiarCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CONFIG.STORAGE_KEY)) {
                    localStorage.removeItem(key);
                }
            });
            log("Cache limpiado");
        } catch (error) {
            console.warn("[TallerUI] Error al limpiar cache:", error);
        }
    }

    // ========== CREACIÓN DE TARJETAS ==========
    function crearTarjeta(taller) {
        if (!taller || typeof taller !== 'object') {
            console.warn("[TallerUI] Taller inválido:", taller);
            return '<div class="taller-card error">Datos de taller no disponibles</div>';
        }

        const slug = slugTaller(taller);
        const nombre = escaparHTML(taller.nombre || taller.empresa || "Taller sin nombre");
        const direccion = escaparHTML(formatearDireccion(taller));
        const descripcion = truncarTexto(escaparHTML(taller.descripcion || ""));
        const precio = formatearPrecio(taller.precio || taller.precio_minimo);
        const valoracion = obtenerValoracion(taller);
        const numValoraciones = obtenerNumeroValoraciones(taller);
        const foto = webSegura(taller.foto || taller.fotoFirmada || CONFIG.DEFAULT_IMAGE);

        // Servicios destacados
        const servicios = Array.isArray(taller.servicios) 
            ? taller.servicios.slice(0, 3).map(s => escaparHTML(s)).join(", ")
            : "";

        // Etiquetas
        const etiquetas = [];
        if (taller.destacado) etiquetas.push('<span class="etiqueta destacado">⭐ Destacado</span>');
        if (taller.verificado) etiquetas.push('<span class="etiqueta verificado">✅ Verificado</span>');
        if (taller.disponible === false) etiquetas.push('<span class="etiqueta no-disponible">⛔ No disponible</span>');
        
        // Estrellas de valoración
        let estrellas = "";
        if (valoracion !== null) {
            const estrellasLlenas = Math.floor(valoracion);
            const tieneMedia = valoracion % 1 >= 0.5;
            let html = "";
            for (let i = 0; i < 5; i++) {
                if (i < estrellasLlenas) {
                    html += '<span class="estrella llena">★</span>';
                } else if (i === estrellasLlenas && tieneMedia) {
                    html += '<span class="estrella media">★</span>';
                } else {
                    html += '<span class="estrella vacia">☆</span>';
                }
            }
            estrellas = `<div class="valoracion">${html} <span class="puntuacion">${valoracion.toFixed(1)}</span> (${numValoraciones})</div>`;
        }

        // HTML de la tarjeta
        return `
            <div class="taller-card" data-taller-slug="${slug}" data-taller-id="${taller.id || ''}">
                <div class="taller-imagen">
                    <img src="${foto}" alt="${nombre}" loading="lazy" decoding="async" 
                         onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
                    ${etiquetas.join(' ')}
                </div>
                <div class="taller-info">
                    <h3 class="taller-nombre">
                        <a href="/taller/${slug}" title="${nombre}">${nombre}</a>
                    </h3>
                    ${direccion ? `<p class="taller-direccion">📍 ${direccion}</p>` : ''}
                    ${descripcion ? `<p class="taller-descripcion">${descripcion}</p>` : ''}
                    ${servicios ? `<p class="taller-servicios">🔧 ${servicios}</p>` : ''}
                    ${estrellas}
                    <div class="taller-precio">
                        <span class="precio">${precio}</span>
                        <a href="/taller/${slug}" class="btn-ver-mas">Ver taller →</a>
                    </div>
                </div>
            </div>
        `;
    }

    function crearTarjetaMini(taller) {
        if (!taller) return "";

        const nombre = escaparHTML(taller.nombre || taller.empresa || "Taller");
        const slug = slugTaller(taller);
        const foto = webSegura(taller.foto || taller.fotoFirmada || CONFIG.DEFAULT_IMAGE);

        return `
            <div class="taller-card-mini" data-taller-slug="${slug}">
                <img src="${foto}" alt="${nombre}" loading="lazy" decoding="async" 
                     onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
                <div class="mini-info">
                    <h4><a href="/taller/${slug}">${nombre}</a></h4>
                    <p>${escaparHTML(taller.municipio || taller.ciudad || "")}</p>
                </div>
            </div>
        `;
    }

    function crearListaTalleres(talleres, opciones = {}) {
        if (!Array.isArray(talleres) || !talleres.length) {
            return '<p class="mensaje-vacio">No hay talleres disponibles</p>';
        }

        const { mini = false, grid = true } = opciones;
        const claseGrid = grid ? 'grid-talleres' : 'lista-talleres';
        
        const html = talleres.map(taller => 
            mini ? crearTarjetaMini(taller) : crearTarjeta(taller)
        ).join('');

        return `<div class="${claseGrid}">${html}</div>`;
    }

    // ========== MANIPULACIÓN DOM ==========
    function renderizarTalleres(contenedorId, talleres, opciones = {}) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) {
            console.error(`[TallerUI] Contenedor ${contenedorId} no encontrado`);
            return;
        }

        const html = crearListaTalleres(talleres, opciones);
        contenedor.innerHTML = html;
        log(`Renderizados ${talleres.length} talleres en ${contenedorId}`);
    }

    function actualizarTalleres(contenedorId, talleres, opciones = {}) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        const { agregar = false, mini = false } = opciones;
        
        if (agregar) {
            const html = talleres.map(t => mini ? crearTarjetaMini(t) : crearTarjeta(t)).join('');
            contenedor.insertAdjacentHTML('beforeend', html);
        } else {
            renderizarTalleres(contenedorId, talleres, opciones);
        }
    }

    // ========== FILTROS Y ORDENACIÓN ==========
    function filtrarTalleres(talleres, filtros = {}) {
        if (!Array.isArray(talleres)) return [];

        return talleres.filter(taller => {
            // Filtrar por servicio
            if (filtros.servicio) {
                const servicios = Array.isArray(taller.servicios) 
                    ? taller.servicios.map(s => s.toLowerCase())
                    : [];
                if (!servicios.includes(filtros.servicio.toLowerCase())) {
                    return false;
                }
            }

            // Filtrar por precio
            if (filtros.precio_min && taller.precio < filtros.precio_min) return false;
            if (filtros.precio_max && taller.precio > filtros.precio_max) return false;

            // Filtrar por valoración
            if (filtros.valoracion_min) {
                const valoracion = obtenerValoracion(taller);
                if (valoracion === null || valoracion < filtros.valoracion_min) return false;
            }

            // Filtrar por disponibilidad
            if (filtros.disponible !== undefined && taller.disponible !== filtros.disponible) {
                return false;
            }

            return true;
        });
    }

    function ordenarTalleres(talleres, criterio = 'nombre', ascendente = true) {
        if (!Array.isArray(talleres)) return [];

        const copia = [...talleres];
        
        copia.sort((a, b) => {
            let valorA, valorB;
            
            switch(criterio) {
                case 'precio':
                    valorA = a.precio || 0;
                    valorB = b.precio || 0;
                    break;
                case 'valoracion':
                    valorA = obtenerValoracion(a) || 0;
                    valorB = obtenerValoracion(b) || 0;
                    break;
                case 'nombre':
                default:
                    valorA = (a.nombre || a.empresa || "").toLowerCase();
                    valorB = (b.nombre || b.empresa || "").toLowerCase();
                    break;
            }

            if (valorA < valorB) return ascendente ? -1 : 1;
            if (valorA > valorB) return ascendente ? 1 : -1;
            return 0;
        });

        return copia;
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.TallerMapTallerUI = {
        // Constantes
        CONFIG: CONFIG,
        
        // Utilidades
        escaparHTML: escaparHTML,
        webSegura: webSegura,
        slugTaller: slugTaller,
        formatearDireccion: formatearDireccion,
        formatearPrecio: formatearPrecio,
        truncarTexto: truncarTexto,
        obtenerValoracion: obtenerValoracion,
        obtenerNumeroValoraciones: obtenerNumeroValoraciones,
        
        // Cache
        guardarCache: guardarCache,
        cargarCache: cargarCache,
        limpiarCache: limpiarCache,
        
        // Creación de tarjetas
        crearTarjeta: crearTarjeta,
        crearTarjetaMini: crearTarjetaMini,
        crearListaTalleres: crearListaTalleres,
        
        // Manipulación DOM
        renderizarTalleres: renderizarTalleres,
        actualizarTalleres: actualizarTalleres,
        
        // Filtros y ordenación
        filtrarTalleres: filtrarTalleres,
        ordenarTalleres: ordenarTalleres,
        
        // Logging
        log: log,
    };

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("TallerUI inicializado");
        
        // Inicializar componentes si existen
        const contenedores = document.querySelectorAll('[data-taller-ui]');
        contenedores.forEach(contenedor => {
            const tipo = contenedor.dataset.tallerUi;
            log(`Inicializando UI tipo: ${tipo} para ${contenedor.id || 'sin-id'}`);
            
            // Aquí se pueden agregar inicializaciones específicas
            // según el tipo de contenedor
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
