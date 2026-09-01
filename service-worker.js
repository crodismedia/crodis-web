// ============================================
// 📦 SERVICE WORKER - TALLERMAP
// ============================================

const CACHE_NAME = 'tallermap-v1';

// Archivos a cachear
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/config.js',
  '/js/servicios.js',
  '/js/taller-ui.js',
  '/js/taller-urls-core.js',
  '/js/taller-urls.js',
  '/js/talleres-locales.js',
  '/js/valoraciones.js',
  '/js/reclamar-taller.js',
  '/js/provincias.js',
  '/js/registro.js',
  '/js/openai-config.js',
  '/js/subabase.js',
  '/offline.html',
];

// Instalación - Cachear archivos
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] ✅ Instalación completa');
        return self.skipWaiting();
      })
  );
});

// Activación - Limpiar cache antiguo
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - Interceptar peticiones
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devolverlo
        if (response) {
          return response;
        }
        // Si no, ir a la red
        return fetch(event.request)
          .then(response => {
            // Guardar en caché para futuras visitas
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
            return response;
          })
          .catch(() => {
            // Si falla, mostrar página offline
            return caches.match('/offline.html');
          });
      })
  );
});
