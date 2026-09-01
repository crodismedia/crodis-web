(function () {
    "use strict";

    // ========== DEPENDENCIAS ==========
    if (!window.TallerMapTallerUrls) {
        console.error("[TalleresLocales] Dependencia faltante: taller-urls-core.js");
        return;
    }

    if (!window.TallerMapTallerUI) {
        console.warn("[TalleresLocales] Dependencia faltante: taller-ui.js");
        return;
    }

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 3600000, // 1 hora
        STORAGE_KEY: "tallermap_locales_cache",
        MAX_LOCALES: 10,
        DEFAULT_RADIO: 50, // km
        TIMEOUT_GEOLOCATION: 10000, // 10 segundos
        MAX_ATTEMPTS: 3,
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[TalleresLocales]", ...args);
        }
    }

    // ========== REFERENCIAS ==========
    const core = window.TallerMapTallerUrls;
    const ui = window.TallerMapTallerUI || {};

    // ========== ESTADO ==========
    const state = {
        ubicacionUsuario: null,
        codigoPostal: null,
        municipio: null,
        provincia: null,
        talleresCercanos: [],
        cargando: false,
        error: null,
        intentos: 0,
        ultimaActualizacion: null,
    };

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
            console.warn("[TalleresLocales] Error al guardar cache:", error);
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
            console.warn("[TalleresLocales] Error al cargar cache:", error);
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
            log("Cache de talleres locales limpiado");
        } catch (error) {
            console.warn("[TalleresLocales] Error al limpiar cache:", error);
        }
    }

    // ========== GEOLOCALIZACIÓN ==========
    function obtenerUbicacionUsuario() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocalización no soportada por el navegador"));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error("Tiempo de espera de geolocalización agotado"));
            }, CONFIG.TIMEOUT_GEOLOCATION);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    const ubicacion = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                    };
                    state.ubicacionUsuario = ubicacion;
                    log("Ubicación obtenida:", ubicacion);
                    resolve(ubicacion);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    log("Error de geolocalización:", error.message);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: CONFIG.TIMEOUT_GEOLOCATION,
                    maximumAge: 60000,
                }
            );
        });
    }

    // ========== DETECCIÓN DE UBICACIÓN POR IP ==========
    async function obtenerUbicacionPorIP() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('Error al obtener ubicación por IP');
            
            const data = await response.json();
            
            const ubicacion = {
                ip: data.ip,
                ciudad: data.city,
                region: data.region,
                pais: data.country_name,
                codigoPostal: data.postal,
                lat: data.latitude,
                lng: data.longitude,
                zonaHoraria: data.timezone,
            };
            
            log("Ubicación por IP obtenida:", ubicacion);
            return ubicacion;
        } catch (error) {
            log("Error al obtener ubicación por IP:", error);
            return null;
        }
    }

    // ========== DETECCIÓN DE CÓDIGO POSTAL ==========
    async function obtenerCodigoPostalPorUbicacion(lat, lng) {
        try {
            const response = await fetch(
                `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=tu-api-key&language=es`
            );
            if (!response.ok) throw new Error('Error al obtener código postal');
            
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const components = data.results[0].components;
                return {
                    codigoPostal: components.postcode || null,
                    municipio: components.city || components.town || components.village || null,
                    provincia: components.state || components.province || null,
                    pais: components.country || null,
                };
            }
            return null;
        } catch (error) {
            log("Error al obtener código postal:", error);
            return null;
        }
    }

    // ========== DETECCIÓN DE PROVINCIA POR CÓDIGO POSTAL ==========
    function obtenerProvinciaPorCodigoPostal(codigoPostal) {
        if (!codigoPostal || typeof codigoPostal !== 'string') return null;
        
        // Mapa de códigos postales a provincias (España)
        const mapaProvincias = {
            '01': 'Álava',
            '02': 'Albacete',
            '03': 'Alicante',
            '04': 'Almería',
            '05': 'Ávila',
            '06': 'Badajoz',
            '07': 'Baleares',
            '08': 'Barcelona',
            '09': 'Burgos',
            '10': 'Cáceres',
            '11': 'Cádiz',
            '12': 'Castellón',
            '13': 'Ciudad Real',
            '14': 'Córdoba',
            '15': 'La Coruña',
            '16': 'Cuenca',
            '17': 'Girona',
            '18': 'Granada',
            '19': 'Guadalajara',
            '20': 'Guipúzcoa',
            '21': 'Huelva',
            '22': 'Huesca',
            '23': 'Jaén',
            '24': 'León',
            '25': 'Lleida',
            '26': 'La Rioja',
            '27': 'Lugo',
            '28': 'Madrid',
            '29': 'Málaga',
            '30': 'Murcia',
            '31': 'Navarra',
            '32': 'Ourense',
            '33': 'Asturias',
            '34': 'Palencia',
            '35': 'Las Palmas',
            '36': 'Pontevedra',
            '37': 'Salamanca',
            '38': 'Santa Cruz de Tenerife',
            '39': 'Cantabria',
            '40': 'Segovia',
            '41': 'Sevilla',
            '42': 'Soria',
            '43': 'Tarragona',
            '44': 'Teruel',
            '45': 'Toledo',
            '46': 'Valencia',
            '47': 'Valladolid',
            '48': 'Vizcaya',
            '49': 'Zamora',
            '50': 'Zaragoza',
            '51': 'Ceuta',
            '52': 'Melilla',
        };

        const prefijo = codigoPostal.substring(0, 2);
        return mapaProvincias[prefijo] || null;
    }

    // ========== DETECCIÓN DE TALLERES CERCANOS ==========
    function calcularDistancia(lat1, lng1, lat2, lng2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function filtrarTalleresCercanos(talleres, ubicacion, radio = CONFIG.DEFAULT_RADIO) {
        if (!talleres || !talleres.length || !ubicacion) return [];

        return talleres
            .filter(taller => {
                if (!taller.lat || !taller.lng) return false;
                const distancia = calcularDistancia(
                    ubicacion.lat,
                    ubicacion.lng,
                    parseFloat(taller.lat),
                    parseFloat(taller.lng)
                );
                return distancia <= radio;
            })
            .map(taller => ({
                ...taller,
                distancia: calcularDistancia(
                    ubicacion.lat,
                    ubicacion.lng,
                    parseFloat(taller.lat),
                    parseFloat(taller.lng)
                )
            }))
            .sort((a, b) => a.distancia - b.distancia)
            .slice(0, CONFIG.MAX_LOCALES);
    }

    // ========== CARGA DE TALLERES LOCALES ==========
    async function cargarTalleresLocales(ubicacion, opciones = {}) {
        const { radio = CONFIG.DEFAULT_RADIO, force = false } = opciones;

        if (state.cargando) {
            log("Ya se está cargando talleres locales");
            return null;
        }

        if (!force && state.ultimaActualizacion && 
            Date.now() - state.ultimaActualizacion < CONFIG.CACHE_DURATION) {
            log("Usando talleres locales en caché");
            return state.talleresCercanos;
        }

        state.cargando = true;
        state.error = null;

        try {
            // Intentar cargar desde cache primero
            const cacheKey = `talleres_${ubicacion.lat}_${ubicacion.lng}`;
            const cached = cargarCache(cacheKey);
            if (cached && !force) {
                state.talleresCercanos = cached;
                state.ultimaActualizacion = Date.now();
                state.cargando = false;
                return cached;
            }

            // Obtener talleres del servidor
            const response = await fetch('/api/talleres/cercanos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lat: ubicacion.lat,
                    lng: ubicacion.lng,
                    radio: radio,
                    limite: CONFIG.MAX_LOCALES,
                }),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const talleres = data.talleres || [];

            // Filtrar y ordenar por distancia
            const talleresFiltrados = filtrarTalleresCercanos(talleres, ubicacion, radio);
            
            state.talleresCercanos = talleresFiltrados;
            state.ultimaActualizacion = Date.now();
            
            // Guardar en cache
            guardarCache(cacheKey, talleresFiltrados);
            
            log(`${talleresFiltrados.length} talleres locales cargados`);
            return talleresFiltrados;
        } catch (error) {
            state.error = error.message;
            log("Error al cargar talleres locales:", error);
            return null;
        } finally {
            state.cargando = false;
        }
    }

    // ========== DETECCIÓN AUTOMÁTICA ==========
    async function detectarTalleresLocales(opciones = {}) {
        const { radio = CONFIG.DEFAULT_RADIO, force = false } = opciones;

        try {
            // Intentar obtener ubicación por geolocalización
            try {
                const ubicacion = await obtenerUbicacionUsuario();
                if (ubicacion) {
                    const talleres = await cargarTalleresLocales(ubicacion, { radio, force });
                    return {
                        origen: 'geolocation',
                        ubicacion: ubicacion,
                        talleres: talleres,
                    };
                }
            } catch (geoError) {
                log("Geolocalización falló, intentando por IP:", geoError);
            }

            // Fallback: ubicación por IP
            const ubicacionIP = await obtenerUbicacionPorIP();
            if (ubicacionIP && ubicacionIP.lat && ubicacionIP.lng) {
                const ubicacion = {
                    lat: ubicacionIP.lat,
                    lng: ubicacionIP.lng,
                    accuracy: 1000, // Menos precisa
                    origen: 'ip',
                };
                const talleres = await cargarTalleresLocales(ubicacion, { radio, force });
                return {
                    origen: 'ip',
                    ubicacion: ubicacion,
                    talleres: talleres,
                };
            }

            // Último fallback: usar código postal de cookie o localStorage
            const codigoPostal = localStorage.getItem('tallermap_codigo_postal');
            if (codigoPostal) {
                const provincia = obtenerProvinciaPorCodigoPostal(codigoPostal);
                const talleres = await cargarTalleresPorCodigoPostal(codigoPostal);
                return {
                    origen: 'codigo_postal',
                    codigoPostal: codigoPostal,
                    provincia: provincia,
                    talleres: talleres,
                };
            }

            log("No se pudo detectar ubicación");
            return null;
        } catch (error) {
            log("Error en detección de talleres locales:", error);
            return null;
        }
    }

    // ========== CARGA POR CÓDIGO POSTAL ==========
    async function cargarTalleresPorCodigoPostal(codigoPostal, opciones = {}) {
        if (!codigoPostal) return null;

        const { limite = CONFIG.MAX_LOCALES } = opciones;

        try {
            const response = await fetch(`/api/talleres/codigo-postal/${codigoPostal}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const talleres = data.talleres || [];
            
            state.talleresCercanos = talleres.slice(0, limite);
            state.codigoPostal = codigoPostal;
            state.ultimaActualizacion = Date.now();
            
            // Guardar en localStorage para futuras visitas
            localStorage.setItem('tallermap_codigo_postal', codigoPostal);
            
            log(`${talleres.length} talleres cargados para código postal ${codigoPostal}`);
            return talleres;
        } catch (error) {
            log("Error al cargar talleres por código postal:", error);
            return null;
        }
    }

    // ========== FUNCIONES DE UI ==========
    function mostrarTalleresLocales(contenedorId, opciones = {}) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) {
            log(`Contenedor ${contenedorId} no encontrado`);
            return;
        }

        const talleres = state.talleresCercanos;
        if (!talleres || !talleres.length) {
            contenedor.innerHTML = `
                <div class="talleres-locales-vacio">
                    <p>No hay talleres cercanos disponibles</p>
                    <button class="btn-buscar-talleres" onclick="window.TalleresLocales.buscarTalleresCercanos()">
                        🔍 Buscar talleres cercanos
                    </button>
                </div>
            `;
            return;
        }

        const html = talleres.map((taller, index) => {
            const distancia = taller.distancia ? `${taller.distancia.toFixed(1)} km` : '';
            const tarjeta = ui.crearTarjeta ? ui.crearTarjeta(taller) : '';
            return `
                <div class="taller-local-item" data-index="${index}">
                    ${tarjeta || `
                        <div class="taller-local-info">
                            <h4>${taller.nombre || 'Taller'}</h4>
                            <p>${taller.direccion || ''}</p>
                            ${distancia ? `<p class="distancia">📏 ${distancia}</p>` : ''}
                            <a href="${core.urlTaller(taller)}" class="btn-ver">Ver taller</a>
                        </div>
                    `}
                </div>
            `;
        }).join('');

        contenedor.innerHTML = `
            <div class="talleres-locales-container">
                <div class="talleres-locales-header">
                    <h3>📌 Talleres cercanos</h3>
                    <span class="talleres-count">${talleres.length} talleres</span>
                    <button class="btn-actualizar" onclick="window.TalleresLocales.actualizarTalleresLocales()">
                        🔄 Actualizar
                    </button>
                </div>
                <div class="talleres-locales-grid">
                    ${html}
                </div>
            </div>
        `;
    }

    // ========== FUNCIONES PÚBLICAS ==========
    const TalleresLocales = {
        CONFIG: CONFIG,
        
        // Estado
        getState: () => ({ ...state }),
        
        // Geolocalización
        obtenerUbicacionUsuario: obtenerUbicacionUsuario,
        obtenerUbicacionPorIP: obtenerUbicacionPorIP,
        obtenerCodigoPostalPorUbicacion: obtenerCodigoPostalPorUbicacion,
        obtenerProvinciaPorCodigoPostal: obtenerProvinciaPorCodigoPostal,
        
        // Carga de talleres
        cargarTalleresLocales: cargarTalleresLocales,
        cargarTalleresPorCodigoPostal: cargarTalleresPorCodigoPostal,
        detectarTalleresLocales: detectarTalleresLocales,
        
        // Filtrado
        filtrarTalleresCercanos: filtrarTalleresCercanos,
        calcularDistancia: calcularDistancia,
        
        // Cache
        guardarCache: guardarCache,
        cargarCache: cargarCache,
        limpiarCache: limpiarCache,
        
        // UI
        mostrarTalleresLocales: mostrarTalleresLocales,
        
        // Acciones
        async buscarTalleresCercanos() {
            const resultado = await detectarTalleresLocales({ force: true });
            if (resultado && resultado.talleres) {
                const contenedor = document.getElementById('talleres-locales-container');
                if (contenedor) {
                    mostrarTalleresLocales('talleres-locales-container');
                }
                return resultado.talleres;
            }
            return null;
        },
        
        async actualizarTalleresLocales() {
            if (state.ubicacionUsuario) {
                return await cargarTalleresLocales(state.ubicacionUsuario, { force: true });
            }
            return await buscarTalleresCercanos();
        },
        
        // Inicialización
        async init(opciones = {}) {
            log("Inicializando sistema de talleres locales");
            
            // Intentar detectar talleres locales automáticamente
            const resultado = await detectarTalleresLocales(opciones);
            
            if (resultado && resultado.talleres) {
                log("Talleres locales detectados:", resultado.talleres.length);
                
                // Renderizar en contenedor predeterminado si existe
                const contenedor = document.getElementById('talleres-locales-container');
                if (contenedor) {
                    mostrarTalleresLocales('talleres-locales-container');
                }
                
                return resultado;
            }
            
            return null;
        }
    };

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.TalleresLocales = TalleresLocales;
    window.TallerMapTalleresLocales = TalleresLocales;

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("Talleres Locales inicializado");
        
        // Inicializar automáticamente si no se desactiva
        const autoInit = document.querySelector('[data-talleres-locales-auto]')?.dataset.talleresLocalesAuto !== 'false';
        
        if (autoInit) {
            // Esperar a que la página esté lista
            setTimeout(() => {
                TalleresLocales.init().catch(error => {
                    log("Error en inicialización automática:", error);
                });
            }, 1000);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
