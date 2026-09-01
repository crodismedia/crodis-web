(function() {
    "use strict";

    // ============ CONFIGURACIÓN ============
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 3600000, // 1 hora
        STORAGE_KEY: "tallermap_servicios_cache"
    };

    // ============ LOGGING ============
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[Servicios]", ...args);
        }
    }

    // ============ CATEGORÍAS DE SERVICIOS ============
    const CATEGORIAS = {
        "mecanica": {
            id: "mecanica",
            nombre: "Mecánica general",
            icono: "🔧",
            orden: 1
        },
        "frenos": {
            id: "frenos",
            nombre: "Frenos y transmisión",
            icono: "🛞",
            orden: 2
        },
        "motor": {
            id: "motor",
            nombre: "Motor y sistema",
            icono: "⚙️",
            orden: 3
        },
        "neumaticos": {
            id: "neumaticos",
            nombre: "Neumáticos y suspensión",
            icono: "🚗",
            orden: 4
        },
        "electronica": {
            id: "electronica",
            nombre: "Electrónica y diagnóstico",
            icono: "🔌",
            orden: 5
        },
        "carroceria": {
            id: "carroceria",
            nombre: "Carrocería y confort",
            icono: "🎨",
            orden: 6
        },
        "especiales": {
            id: "especiales",
            nombre: "Servicios especiales",
            icono: "⚡",
            orden: 7
        },
        "comerciales": {
            id: "comerciales",
            nombre: "Vehículos comerciales",
            icono: "🚛",
            orden: 8
        },
        "premium": {
            id: "premium",
            nombre: "Servicios premium",
            icono: "🏆",
            orden: 9
        }
    };

    // ============ SERVIDORES CON DATOS COMPLETOS ============
    const SERVICIOS = {
        // 🔧 Mecánica general
        "mecanica-general": {
            id: "mecanica-general",
            nombre: "Mecánica general",
            categoria: "mecanica",
            descripcion: "Reparación y mantenimiento general del vehículo",
            precioDesde: 50,
            duracion: 60,
            popular: true
        },
        "mantenimiento-programado": {
            id: "mantenimiento-programado",
            nombre: "Mantenimiento programado",
            categoria: "mecanica",
            descripcion: "Revisión y mantenimiento según kilometraje",
            precioDesde: 80,
            duracion: 90,
            popular: true
        },
        "cambio-aceite-filtros": {
            id: "cambio-aceite-filtros",
            nombre: "Cambio de aceite y filtros",
            categoria: "mecanica",
            descripcion: "Cambio de aceite, filtro de aceite y filtro de aire",
            precioDesde: 60,
            duracion: 45,
            popular: true
        },
        "pre-itv": {
            id: "pre-itv",
            nombre: "Pre-ITV",
            categoria: "mecanica",
            descripcion: "Revisión completa previa a la ITV",
            precioDesde: 40,
            duracion: 30,
            popular: true
        },
        "revision-completa": {
            id: "revision-completa",
            nombre: "Revisión completa del vehículo",
            categoria: "mecanica",
            descripcion: "Revisión exhaustiva de todos los sistemas",
            precioDesde: 100,
            duracion: 120,
            popular: false
        },

        // 🛞 Frenos y transmisión
        "frenos": {
            id: "frenos",
            nombre: "Frenos",
            categoria: "frenos",
            descripcion: "Revisión y reparación del sistema de frenos",
            precioDesde: 80,
            duracion: 60,
            popular: true
        },
        "cambio-pastillas-frenos": {
            id: "cambio-pastillas-frenos",
            nombre: "Cambio de pastillas de freno",
            categoria: "frenos",
            descripcion: "Sustitución de pastillas de freno delanteras y traseras",
            precioDesde: 60,
            duracion: 45,
            popular: true
        },
        "cambio-discos-frenos": {
            id: "cambio-discos-frenos",
            nombre: "Cambio de discos de freno",
            categoria: "frenos",
            descripcion: "Sustitución de discos de freno",
            precioDesde: 120,
            duracion: 60,
            popular: false
        },
        "embrague": {
            id: "embrague",
            nombre: "Embrague",
            categoria: "frenos",
            descripcion: "Reparación y cambio del embrague",
            precioDesde: 300,
            duracion: 180,
            popular: false
        },
        "cambio-embrague": {
            id: "cambio-embrague",
            nombre: "Cambio de embrague",
            categoria: "frenos",
            descripcion: "Sustitución completa del embrague",
            precioDesde: 350,
            duracion: 240,
            popular: false
        },
        "correa-distribucion": {
            id: "correa-distribucion",
            nombre: "Correa de distribución",
            categoria: "frenos",
            descripcion: "Cambio de correa de distribución",
            precioDesde: 250,
            duracion: 180,
            popular: true
        },
        "cambio-correa-distribucion": {
            id: "cambio-correa-distribucion",
            nombre: "Cambio de correa de distribución",
            categoria: "frenos",
            descripcion: "Sustitución de correa de distribución y tensores",
            precioDesde: 280,
            duracion: 200,
            popular: true
        },
        "caja-cambios": {
            id: "caja-cambios",
            nombre: "Caja de cambios",
            categoria: "frenos",
            descripcion: "Reparación de caja de cambios",
            precioDesde: 400,
            duracion: 300,
            popular: false
        },
        "reparacion-caja-cambios": {
            id: "reparacion-caja-cambios",
            nombre: "Reparación de caja de cambios",
            categoria: "frenos",
            descripcion: "Reparación de caja de cambios manual o automática",
            precioDesde: 450,
            duracion: 360,
            popular: false
        },

        // ⚙️ Motor y sistema
        "sistema-refrigeracion": {
            id: "sistema-refrigeracion",
            nombre: "Sistema de refrigeración",
            categoria: "motor",
            descripcion: "Reparación del sistema de refrigeración",
            precioDesde: 100,
            duracion: 90,
            popular: false
        },
        "reparacion-refrigeracion": {
            id: "reparacion-refrigeracion",
            nombre: "Reparación del sistema de refrigeración",
            categoria: "motor",
            descripcion: "Reparación de radiador, bomba de agua y termostato",
            precioDesde: 120,
            duracion: 120,
            popular: false
        },
        "escape-catalizador": {
            id: "escape-catalizador",
            nombre: "Escape y catalizador",
            categoria: "motor",
            descripcion: "Reparación del sistema de escape",
            precioDesde: 150,
            duracion: 90,
            popular: false
        },
        "reparacion-escape": {
            id: "reparacion-escape",
            nombre: "Reparación del sistema de escape",
            categoria: "motor",
            descripcion: "Reparación de tubos de escape y silenciadores",
            precioDesde: 130,
            duracion: 80,
            popular: false
        },
        "cambio-catalizador": {
            id: "cambio-catalizador",
            nombre: "Cambio de catalizador",
            categoria: "motor",
            descripcion: "Sustitución del catalizador",
            precioDesde: 200,
            duracion: 120,
            popular: false
        },
        "filtro-particulas": {
            id: "filtro-particulas",
            nombre: "Filtro de partículas (DPF)",
            categoria: "motor",
            descripcion: "Mantenimiento y regeneración del FAP",
            precioDesde: 180,
            duracion: 90,
            popular: true
        },
        "regeneracion-fap": {
            id: "regeneracion-fap",
            nombre: "Regeneración de filtro de partículas",
            categoria: "motor",
            descripcion: "Regeneración forzada del filtro de partículas",
            precioDesde: 150,
            duracion: 60,
            popular: true
        },
        "inyeccion-combustible": {
            id: "inyeccion-combustible",
            nombre: "Sistema de inyección",
            categoria: "motor",
            descripcion: "Reparación del sistema de inyección",
            precioDesde: 200,
            duracion: 120,
            popular: false
        },
        "limpieza-inyectores": {
            id: "limpieza-inyectores",
            nombre: "Limpieza de inyectores",
            categoria: "motor",
            descripcion: "Limpieza profesional de inyectores",
            precioDesde: 80,
            duracion: 60,
            popular: true
        },

        // 🚗 Neumáticos y suspensión
        "neumaticos": {
            id: "neumaticos",
            nombre: "Neumáticos",
            categoria: "neumaticos",
            descripcion: "Cambio y reparación de neumáticos",
            precioDesde: 50,
            duracion: 30,
            popular: true
        },
        "cambio-neumaticos": {
            id: "cambio-neumaticos",
            nombre: "Cambio de neumáticos",
            categoria: "neumaticos",
            descripcion: "Montaje y equilibrado de neumáticos",
            precioDesde: 40,
            duracion: 30,
            popular: true
        },
        "alineacion-direccion": {
            id: "alineacion-direccion",
            nombre: "Alineación y dirección",
            categoria: "neumaticos",
            descripcion: "Alineación de la dirección",
            precioDesde: 60,
            duracion: 45,
            popular: true
        },
        "alineacion-ruedas": {
            id: "alineacion-ruedas",
            nombre: "Alineación de ruedas",
            categoria: "neumaticos",
            descripcion: "Alineación de ruedas delanteras y traseras",
            precioDesde: 50,
            duracion: 40,
            popular: true
        },
        "equilibrado-ruedas": {
            id: "equilibrado-ruedas",
            nombre: "Equilibrado de ruedas",
            categoria: "neumaticos",
            descripcion: "Equilibrado estático y dinámico",
            precioDesde: 30,
            duracion: 20,
            popular: true
        },
        "suspension-amortiguadores": {
            id: "suspension-amortiguadores",
            nombre: "Suspensión y amortiguadores",
            categoria: "neumaticos",
            descripcion: "Reparación de suspensión",
            precioDesde: 150,
            duracion: 120,
            popular: false
        },
        "cambio-amortiguadores": {
            id: "cambio-amortiguadores",
            nombre: "Cambio de amortiguadores",
            categoria: "neumaticos",
            descripcion: "Sustitución de amortiguadores",
            precioDesde: 180,
            duracion: 150,
            popular: false
        },
        "direccion": {
            id: "direccion",
            nombre: "Dirección",
            categoria: "neumaticos",
            descripcion: "Reparación de la dirección",
            precioDesde: 120,
            duracion: 90,
            popular: false
        },
        "reparacion-direccion": {
            id: "reparacion-direccion",
            nombre: "Reparación de la dirección",
            categoria: "neumaticos",
            descripcion: "Reparación de cremallera y bombín",
            precioDesde: 140,
            duracion: 100,
            popular: false
        },

        // 🔌 Electrónica y diagnóstico
        "diagnosis-electronica": {
            id: "diagnosis-electronica",
            nombre: "Diagnosis electrónica",
            categoria: "electronica",
            descripcion: "Diagnóstico completo del vehículo",
            precioDesde: 50,
            duracion: 30,
            popular: true
        },
        "diagnosis-vehiculo": {
            id: "diagnosis-vehiculo",
            nombre: "Diagnosis del vehículo",
            categoria: "electronica",
            descripcion: "Escaneo de todos los sistemas electrónicos",
            precioDesde: 60,
            duracion: 40,
            popular: true
        },
        "electricidad-automovil": {
            id: "electricidad-automovil",
            nombre: "Electricidad del automóvil",
            categoria: "electronica",
            descripcion: "Reparación eléctrica del vehículo",
            precioDesde: 80,
            duracion: 60,
            popular: false
        },
        "reparacion-electrica": {
            id: "reparacion-electrica",
            nombre: "Reparación eléctrica",
            categoria: "electronica",
            descripcion: "Reparación del sistema eléctrico",
            precioDesde: 90,
            duracion: 70,
            popular: false
        },
        "baterias": {
            id: "baterias",
            nombre: "Baterías",
            categoria: "electronica",
            descripcion: "Cambio de batería",
            precioDesde: 80,
            duracion: 20,
            popular: true
        },
        "cambio-bateria": {
            id: "cambio-bateria",
            nombre: "Cambio de batería",
            categoria: "electronica",
            descripcion: "Sustitución y reciclaje de batería",
            precioDesde: 100,
            duracion: 30,
            popular: true
        },
        "alternador-motor-arranque": {
            id: "alternador-motor-arranque",
            nombre: "Alternador y motor de arranque",
            categoria: "electronica",
            descripcion: "Reparación de alternador y motor de arranque",
            precioDesde: 150,
            duracion: 90,
            popular: false
        },
        "reparacion-alternador": {
            id: "reparacion-alternador",
            nombre: "Reparación de alternador",
            categoria: "electronica",
            descripcion: "Reparación o cambio del alternador",
            precioDesde: 160,
            duracion: 100,
            popular: false
        },
        "reparacion-motor-arranque": {
            id: "reparacion-motor-arranque",
            nombre: "Reparación de motor de arranque",
            categoria: "electronica",
            descripcion: "Reparación o cambio del motor de arranque",
            precioDesde: 140,
            duracion: 80,
            popular: false
        },
        "centralitas-electronica": {
            id: "centralitas-electronica",
            nombre: "Centralitas y electrónica",
            categoria: "electronica",
            descripcion: "Reparación y reprogramación de centralitas",
            precioDesde: 200,
            duracion: 120,
            popular: false
        },
        "reprogramacion-centralitas": {
            id: "reprogramacion-centralitas",
            nombre: "Reprogramación de centralitas",
            categoria: "electronica",
            descripcion: "Reprogramación de ECU y centralitas",
            precioDesde: 220,
            duracion: 150,
            popular: false
        },
        "sistemas-adas": {
            id: "sistemas-adas",
            nombre: "Sistemas ADAS",
            categoria: "electronica",
            descripcion: "Mantenimiento y calibración de ADAS",
            precioDesde: 150,
            duracion: 90,
            popular: true
        },
        "calibracion-adas": {
            id: "calibracion-adas",
            nombre: "Calibración de sistemas ADAS",
            categoria: "electronica",
            descripcion: "Calibración de cámaras y sensores ADAS",
            precioDesde: 180,
            duracion: 120,
            popular: true
        },

        // 🎨 Carrocería y confort
        "tapiceria": {
            id: "tapiceria",
            nombre: "Tapicería",
            categoria: "carroceria",
            descripcion: "Reparación de tapicería",
            precioDesde: 80,
            duracion: 60,
            popular: false
        },
        "reparacion-tapiceria": {
            id: "reparacion-tapiceria",
            nombre: "Reparación de tapicería",
            categoria: "carroceria",
            descripcion: "Reparación de asientos y tapicería interior",
            precioDesde: 90,
            duracion: 70,
            popular: false
        },
        "chapa-pintura": {
            id: "chapa-pintura",
            nombre: "Chapa y pintura",
            categoria: "carroceria",
            descripcion: "Reparación de chapa y pintura",
            precioDesde: 150,
            duracion: 180,
            popular: true
        },
        "reparacion-chapa": {
            id: "reparacion-chapa",
            nombre: "Reparación de chapa",
            categoria: "carroceria",
            descripcion: "Reparación de abolladuras y chapa",
            precioDesde: 120,
            duracion: 150,
            popular: true
        },
        "pintura-automovil": {
            id: "pintura-automovil",
            nombre: "Pintura de automóviles",
            categoria: "carroceria",
            descripcion: "Pintura de carrocería",
            precioDesde: 200,
            duracion: 240,
            popular: false
        },
        "pulido-barnizado": {
            id: "pulido-barnizado",
            nombre: "Pulido y barnizado",
            categoria: "carroceria",
            descripcion: "Pulido y tratamiento de pintura",
            precioDesde: 100,
            duracion: 120,
            popular: false
        },
        "aire-acondicionado": {
            id: "aire-acondicionado",
            nombre: "Aire acondicionado",
            categoria: "carroceria",
            descripcion: "Mantenimiento del aire acondicionado",
            precioDesde: 60,
            duracion: 40,
            popular: true
        },
        "recarga-gas-climatizacion": {
            id: "recarga-gas-climatizacion",
            nombre: "Recarga de gas de climatización",
            categoria: "carroceria",
            descripcion: "Recarga de gas del aire acondicionado",
            precioDesde: 70,
            duracion: 30,
            popular: true
        },
        "reparacion-climatizacion": {
            id: "reparacion-climatizacion",
            nombre: "Reparación de climatización",
            categoria: "carroceria",
            descripcion: "Reparación del sistema de climatización",
            precioDesde: 120,
            duracion: 90,
            popular: false
        },

        // ⚡ Especiales
        "hibridos-electricos": {
            id: "hibridos-electricos",
            nombre: "Híbridos y eléctricos",
            categoria: "especiales",
            descripcion: "Mantenimiento de vehículos híbridos y eléctricos",
            precioDesde: 100,
            duracion: 60,
            popular: true
        },
        "mantenimiento-hibrido": {
            id: "mantenimiento-hibrido",
            nombre: "Mantenimiento de vehículos híbridos",
            categoria: "especiales",
            descripcion: "Mantenimiento específico de híbridos",
            precioDesde: 120,
            duracion: 90,
            popular: true
        },
        "mantenimiento-electrico": {
            id: "mantenimiento-electrico",
            nombre: "Mantenimiento de vehículos eléctricos",
            categoria: "especiales",
            descripcion: "Mantenimiento de vehículos 100% eléctricos",
            precioDesde: 130,
            duracion: 90,
            popular: true
        },
        "baterias-alto-voltaje": {
            id: "baterias-alto-voltaje",
            nombre: "Baterías de alto voltaje",
            categoria: "especiales",
            descripcion: "Mantenimiento de baterías de alto voltaje",
            precioDesde: 200,
            duracion: 120,
            popular: false
        },

        // 🚛 Vehículos comerciales
        "vehiculos-comerciales": {
            id: "vehiculos-comerciales",
            nombre: "Vehículos comerciales",
            categoria: "comerciales",
            descripcion: "Mantenimiento de vehículos comerciales",
            precioDesde: 100,
            duracion: 60,
            popular: false
        },
        "mantenimiento-furgonetas": {
            id: "mantenimiento-furgonetas",
            nombre: "Mantenimiento de furgonetas",
            categoria: "comerciales",
            descripcion: "Mantenimiento de furgonetas comerciales",
            precioDesde: 120,
            duracion: 90,
            popular: false
        },
        "mantenimiento-camiones": {
            id: "mantenimiento-camiones",
            nombre: "Mantenimiento de camiones",
            categoria: "comerciales",
            descripcion: "Mantenimiento de camiones y vehículos pesados",
            precioDesde: 200,
            duracion: 180,
            popular: false
        },

        // 🏆 Servicios premium
        "preparacion-competicion": {
            id: "preparacion-competicion",
            nombre: "Preparación para competición",
            categoria: "premium",
            descripcion: "Preparación de vehículos para competición",
            precioDesde: 500,
            duracion: 480,
            popular: false
        },
        "tuning-automovil": {
            id: "tuning-automovil",
            nombre: "Tuning automovilístico",
            categoria: "premium",
            descripcion: "Personalización y tuning del vehículo",
            precioDesde: 300,
            duracion: 360,
            popular: false
        },
        "personalizacion-vehiculos": {
            id: "personalizacion-vehiculos",
            nombre: "Personalización de vehículos",
            categoria: "premium",
            descripcion: "Personalización estética y mecánica",
            precioDesde: 250,
            duracion: 240,
            popular: false
        }
    };

    // ============ FUNCIONES PRINCIPALES ============
    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function getServicio(id) {
        const clave = slugSeguro(id);
        return SERVICIOS[clave] || null;
    }

    function getServiciosPorCategoria(categoriaId) {
        const catId = slugSeguro(categoriaId);
        const resultado = [];
        
        for (const [key, servicio] of Object.entries(SERVICIOS)) {
            if (servicio.categoria === catId) {
                resultado.push({ ...servicio, id: key });
            }
        }
        
        // Ordenar por popularidad y precio
        resultado.sort((a, b) => {
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            return a.precioDesde - b.precioDesde;
        });
        
        return resultado;
    }

    function getCategorias() {
        return Object.values(CATEGORIAS).sort((a, b) => a.orden - b.orden);
    }

    function getCategoria(id) {
        const clave = slugSeguro(id);
        return CATEGORIAS[clave] || null;
    }

    function getServiciosPopulares(limite = 6) {
        const populares = [];
        
        for (const [key, servicio] of Object.entries(SERVICIOS)) {
            if (servicio.popular) {
                populares.push({ ...servicio, id: key });
            }
        }
        
        return populares.slice(0, limite);
    }

    function buscarServicios(query) {
        const termino = query.toLowerCase().trim();
        if (!termino) return [];

        const resultados = [];
        
        for (const [key, servicio] of Object.entries(SERVICIOS)) {
            const coincidencia = 
                servicio.nombre.toLowerCase().includes(termino) ||
                servicio.descripcion.toLowerCase().includes(termino) ||
                key.toLowerCase().includes(termino);
            
            if (coincidencia) {
                resultados.push({ ...servicio, id: key, relevancia: 1 });
            }
        }
        
        // Ordenar por relevancia
        resultados.sort((a, b) => {
            const aNombre = a.nombre.toLowerCase().includes(termino);
            const bNombre = b.nombre.toLowerCase().includes(termino);
            if (aNombre && !bNombre) return -1;
            if (!aNombre && bNombre) return 1;
            return a.precioDesde - b.precioDesde;
        });
        
        return resultados;
    }

    function getPrecioMinimo() {
        let min = Infinity;
        for (const servicio of Object.values(SERVICIOS)) {
            if (servicio.precioDesde < min) {
                min = servicio.precioDesde;
            }
        }
        return min === Infinity ? 0 : min;
    }

    function getPrecioMaximo() {
        let max = 0;
        for (const servicio of Object.values(SERVICIOS)) {
            if (servicio.precioDesde > max) {
                max = servicio.precioDesde;
            }
        }
        return max;
    }

    function getServiciosPorRangoPrecio(min, max) {
        const resultado = [];
        
        for (const [key, servicio] of Object.entries(SERVICIOS)) {
            if (servicio.precioDesde >= min && servicio.precioDesde <= max) {
                resultado.push({ ...servicio, id: key });
            }
        }
        
        return resultado;
    }

    function getServiciosRelacionados(id, limite = 3) {
        const servicio = getServicio(id);
        if (!servicio) return [];

        const relacionados = [];
        const categoria = servicio.categoria;
        
        for (const [key, otro] of Object.entries(SERVICIOS)) {
            if (key !== id && otro.categoria === categoria) {
                relacionados.push({ ...otro, id: key });
            }
        }
        
        // Ordenar por popularidad
        relacionados.sort((a, b) => {
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            return 0;
        });
        
        return relacionados.slice(0, limite);
    }

    // ============ CACHÉ ============
    function guardarCache() {
        try {
            const cache = {
                timestamp: Date.now(),
                data: SERVICIOS
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(cache));
            log("Cache guardado");
        } catch (_) {
            // Ignorar
        }
    }

    function cargarCache() {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!raw) return null;
            
            const cache = JSON.parse(raw);
            const edad = Date.now() - cache.timestamp;
            
            if (edad < CONFIG.CACHE_DURATION) {
                log("Cache cargado (edad:", edad / 1000, "s)");
                return cache.data;
            }
            
            log("Cache expirado");
            return null;
        } catch (_) {
            return null;
        }
    }

    // ============ EXPORTAR ============
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            SERVICIOS,
            CATEGORIAS,
            getServicio,
            getServiciosPorCategoria,
            getCategorias,
            getCategoria,
            getServiciosPopulares,
            buscarServicios,
            getPrecioMinimo,
            getPrecioMaximo,
            getServiciosPorRangoPrecio,
            getServiciosRelacionados
        };
    }

    // ============ INICIALIZACIÓN ============
    log("Servicios.js cargado -", Object.keys(SERVICIOS).length, "servicios disponibles");

    // Cargar caché si existe
    const cacheData = cargarCache();
    if (cacheData) {
        // Usar datos de caché para mejorar rendimiento
        Object.assign(SERVICIOS, cacheData);
    }

    // Guardar caché en intervalo
    setInterval(guardarCache, CONFIG.CACHE_DURATION);

})();
