// ============================================
// 📦 REGISTRO DEL SERVICE WORKER
// ============================================

(function() {
    "use strict";

    console.log('[SW] Inicializando registro...');

    if (!('serviceWorker' in navigator)) {
        console.warn('[SW] ❌ Service Worker no soportado en este navegador');
        return;
    }

    // Registrar el Service Worker
    navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
            console.log('[SW] ✅ Registrado correctamente');
            console.log('[SW] Scope:', registration.scope);

            // Verificar actualizaciones
            registration.addEventListener('updatefound', () => {
                console.log('[SW] 🔄 Nueva versión disponible');
                const newWorker = registration.installing;
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[SW] 📦 Nueva versión lista, recarga para actualizar');
                        // Mostrar notificación al usuario
                        mostrarNotificacionActualizacion();
                    }
                });
            });
        })
        .catch(error => {
            console.error('[SW] ❌ Error al registrar:', error);
        });

    // Escuchar mensajes del Service Worker
    navigator.serviceWorker.addEventListener('message', event => {
        console.log('[SW] 📨 Mensaje recibido:', event.data);
    });

    // Notificación de actualización
    function mostrarNotificacionActualizacion() {
        const banner = document.createElement('div');
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2563eb;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 320px;
        `;
        banner.innerHTML = `
            <strong>🔄 Nueva versión disponible</strong>
            <p style="margin: 8px 0; font-size: 13px; opacity: 0.9;">
                Haz clic para actualizar
            </p>
            <button style="
                background: white;
                color: #2563eb;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
            " onclick="window.location.reload()">
                Actualizar ahora
            </button>
        `;
        document.body.appendChild(banner);
    }

})();
