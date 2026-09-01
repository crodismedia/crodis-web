(function() {
    "use strict";

    // ============ MAPA COMPLETO DE SERVICIOS ============
    const NOMBRES_SERVICIOS = {
        // 🔧 Mecánica general
        "mecanica-general": "Mecánica general",
        "mantenimiento-programado": "Mantenimiento programado",
        "cambio-aceite-filtros": "Cambio de aceite y filtros",
        "pre-itv": "Pre-ITV",
        "revision-completa": "Revisión completa del vehículo",
        
        // 🛞 Frenos y transmisión
        "frenos": "Frenos",
        "cambio-pastillas-frenos": "Cambio de pastillas de freno",
        "cambio-discos-frenos": "Cambio de discos de freno",
        "embrague": "Embrague",
        "cambio-embrague": "Cambio de embrague",
        "correa-distribucion": "Correa de distribución",
        "cambio-correa-distribucion": "Cambio de correa de distribución",
        "caja-cambios": "Caja de cambios",
        "reparacion-caja-cambios": "Reparación de caja de cambios",
        
        // ⚙️ Motor y sistema
        "sistema-refrigeracion": "Sistema de refrigeración",
        "reparacion-refrigeracion": "Reparación del sistema de refrigeración",
        "escape-catalizador": "Escape y catalizador",
        "reparacion-escape": "Reparación del sistema de escape",
        "cambio-catalizador": "Cambio de catalizador",
        "filtro-particulas": "Filtro de partículas (DPF)",
        "regeneracion-fap": "Regeneración de filtro de partículas",
        "inyeccion-combustible": "Sistema de inyección",
        "limpieza-inyectores": "Limpieza de inyectores",
        
        // 🚗 Neumáticos y suspensión
        "neumaticos": "Neumáticos",
        "cambio-neumaticos": "Cambio de neumáticos",
        "alineacion-direccion": "Alineación y dirección",
        "alineacion-ruedas": "Alineación de ruedas",
        "equilibrado-ruedas": "Equilibrado de ruedas",
        "suspension-amortiguadores": "Suspensión y amortiguadores",
        "cambio-amortiguadores": "Cambio de amortiguadores",
        "direccion": "Dirección",
        "reparacion-direccion": "Reparación de la dirección",
        
        // 🔌 Electrónica y diagnóstico
        "diagnosis-electronica": "Diagnosis electrónica",
        "diagnosis-vehiculo": "Diagnosis del vehículo",
        "electricidad-automovil": "Electricidad del automóvil",
        "reparacion-electrica": "Reparación eléctrica",
        "baterias": "Baterías",
        "cambio-bateria": "Cambio de batería",
        "alternador-motor-arranque": "Alternador y motor de arranque",
        "reparacion-alternador": "Reparación de alternador",
        "reparacion-motor-arranque": "Reparación de motor de arranque",
        "centralitas-electronica": "Centralitas y electrónica",
        "reprogramacion-centralitas": "Reprogramación de centralitas",
        "sistemas-adas": "Sistemas ADAS",
        "calibracion-adas": "Calibración de sistemas ADAS",
        
        // 🎨 Carrocería y confort
        "tapiceria": "Tapicería",
        "reparacion-tapiceria": "Reparación de tapicería",
        "chapa-pintura": "Chapa y pintura",
        "reparacion-chapa": "Reparación de chapa",
        "pintura-automovil": "Pintura de automóviles",
        "pulido-barnizado": "Pulido y barnizado",
        "aire-acondicionado": "Aire acondicionado",
        "recarga-gas-climatizacion": "Recarga de gas de climatización",
        "reparacion-climatizacion": "Reparación de climatización",
        
        // ⚡ Especiales
        "hibridos-electricos": "Híbridos y eléctricos",
        "mantenimiento-hibrido": "Mantenimiento de vehículos híbridos",
        "mantenimiento-electrico": "Mantenimiento de vehículos eléctricos",
        "baterias-alto-voltaje": "Baterías de alto voltaje",
        
        // 🚛 Vehículos comerciales
        "vehiculos-comerciales": "Vehículos comerciales",
        "mantenimiento-furgonetas": "Mantenimiento de furgonetas",
        "mantenimiento-camiones": "Mantenimiento de camiones",
        
        // 🏆 Servicios premium
        "preparacion-competicion": "Preparación para competición",
        "tuning-automovil": "Tuning automovilístico",
        "personalizacion-vehiculos": "Personalización de vehículos"
    };

    // ============ SERVICIOS RELACIONADOS ============
    const SERVICIOS_RELACIONADOS = {
        "frenos": ["cambio-pastillas-frenos", "cambio-discos-frenos", "revision-frenos"],
        "embrague": ["cambio-embrague", "reparacion-embrague"],
        "correa-distribucion": ["cambio-correa-distribucion", "revision-distribucion"],
        "neumaticos": ["cambio-neumaticos", "equilibrado-ruedas", "alineacion-ruedas"],
        "diagnosis-electronica": ["diagnosis-vehiculo", "reprogramacion-centralitas"],
        "aire-acondicionado": ["recarga-gas-climatizacion", "reparacion-climatizacion"],
        "hibridos-electricos": ["mantenimiento-hibrido", "mantenimiento-electrico"]
    };

    // ============ FUNCIONES PRINCIPALES ============
    function nombreServicio(clave) {
        const limpio = slugSeguro(clave);
        return NOMBRES_SERVICIOS[limpio] || formatearServicio(limpio);
    }

    function formatearServicio(texto) {
        return texto
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^./, letra => letra.toUpperCase())
            .replace(/\b\w/g, letra => letra.toUpperCase());
    }

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function obtenerServiciosRelacionados(servicio) {
        const clave = slugSeguro(servicio);
        return SERVICIOS_RELACIONADOS[clave] || [];
    }

    function esServicioValido(servicio) {
        const clave = slugSeguro(servicio);
        return !!NOMBRES_SERVICIOS[clave];
    }

    function obtenerListaServicios() {
        return Object.values(NOMBRES_SERVICIOS);
    }

    function obtenerCategoriasServicios() {
        return Object.keys(NOMBRES_SERVICIOS);
    }

    // ============ EXPORTAR (si se usa como módulo) ============
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            NOMBRES_SERVICIOS,
            SERVICIOS_RELACIONADOS,
            nombreServicio,
            obtenerServiciosRelacionados,
            esServicioValido,
            obtenerListaServicios,
            obtenerCategoriasServicios,
            slugSeguro
        };
    }

    // ============ AUTO-EJECUCIÓN PARA CORREGIR HTML ============
    function corregirServiciosEnPagina() {
        // Corregir servicios en fichas de taller
        document.querySelectorAll("#taller-servicios span, .taller-servicios span, .servicios-taller span").forEach(el => {
            const original = el.textContent.trim();
            if (original) {
                const corregido = nombreServicio(original);
                if (corregido && el.textContent.trim() !== corregido) {
                    el.textContent = corregido;
                    el.setAttribute("data-servicio-original", original);
                    el.setAttribute("data-servicio-normalizado", slugSeguro(original));
                }
            }
        });

        // Corregir servicios en tarjetas
        document.querySelectorAll(".card-servicio, .servicio-item").forEach(el => {
            const nombre = el.querySelector(".servicio-nombre, .nombre-servicio");
            if (nombre) {
                const original = nombre.textContent.trim();
                const corregido = nombreServicio(original);
                if (corregido && nombre.textContent.trim() !== corregido) {
                    nombre.textContent = corregido;
                }
            }
        });
    }

    // Ejecutar al cargar
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", corregirServiciosEnPagina);
    } else {
        corregirServiciosEnPagina();
    }

    // Observar cambios dinámicos
    if (document.body) {
        const observer = new MutationObserver(() => {
            corregirServiciosEnPagina();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

})();
