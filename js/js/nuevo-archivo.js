// ============================================
// 🚀 CONFIGURACIÓN CENTRALIZADA
// ============================================

(function() {
    "use strict";

    // ========== CONFIGURACIÓN GLOBAL ==========
    const CONFIG = {
        // === APP ===
        APP_NAME: 'TallerMap',
        APP_VERSION: '2.0.0',
        APP_ENV: 'production', // 'development' | 'staging' | 'production'
        
        // === API ===
        API_URL: 'https://api.tallermap.com',
        API_TIMEOUT: 30000,
        
        // === SUPABASE ===
        SUPABASE_URL: 'https://cnyptelvbsndpkzbrete.supabase.co',
        SUPABASE_KEY: 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh',
        
        // === CACHE ===
        CACHE_DURATION: 3600000, // 1 hora
        CACHE_STORAGE_KEY: 'tallermap_cache',
        
        // === UI ===
        DEBUG: false,
        MAX_RESULTS: 50,
        DEFAULT_IMAGE: '/images/taller-default.jpg',
        
        // === LIMITES ===
        MAX_DESCRIPCION: 200,
        MAX_TITULO: 100,
        MAX_COMENTARIO: 500,
        
        // === VALORACIONES ===
        ESTRELLAS_MAX: 5,
        MIN_VALORACION: 1,
        
        // === GEOLOCALIZACIÓN ===
        DEFAULT_RADIO: 50, // km
        TIMEOUT_GEOLOCATION: 10000, // 10 segundos
        
        // === RECLAMACIONES ===
        MAX_MENSAJE: 1000,
        TIEMPO_VERIFICACION: 30, // días
        TIPO_DOCUMENTO: ['cif', 'nie', 'nif', 'pasaporte', 'otros'],
        
        // === MÓDULOS ACTIVOS ===
        MODULOS: {
            TALLERES: true,
            VALORACIONES: true,
            RECLAMACIONES: true,
            SEO: true,
            ANALYTICS: true,
        },
    };

    // ========== FUNCIONES DE UTILIDAD ==========
    function isDevelopment() {
        return CONFIG.APP_ENV === 'development';
    }

    function isProduction() {
        return CONFIG.APP_ENV === 'production';
    }

    function getConfig(key) {
        return key ? CONFIG[key] : CONFIG;
    }

    function updateConfig(key, value) {
        if (CONFIG[key] !== undefined) {
            CONFIG[key] = value;
            return true;
        }
        return false;
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.TallerMapConfig = {
        CONFIG: CONFIG,
        getConfig: getConfig,
        updateConfig: updateConfig,
        isDevelopment: isDevelopment,
        isProduction: isProduction,
        log: function(...args) {
            if (CONFIG.DEBUG) {
                console.log('[Config]', ...args);
            }
        }
    };

    console.log(`✅ ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} inicializado en modo ${CONFIG.APP_ENV}`);

})();
