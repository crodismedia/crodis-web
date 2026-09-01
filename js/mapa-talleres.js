(function () {
    "use strict";

    const CENTRO_COMUNITAT = [39.4699, -0.3763];
    const MAX_PINES = 25;
    const CACHE_KEY = "tallermap_geocode_v2";
    let mapa = null;
    let capaPines = null;
    let marcadorUsuario = null;
    let versionRender = 0;

    function cargarCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (_) { return {}; } }
    function guardarCache(cache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {} }

    function cargarRecurso(url, tipo) {
        return new Promise((resolve, reject) => {
            const selector = tipo === "css" ? `link[href="${url}"]` : `script[src="${url}"]`;
            const existente = document.querySelector(selector);
            if (existente) {
                if (tipo === "css" || window.L) return resolve();
                existente.addEventListener("load", resolve, { once: true });
                existente.addEventListener("error", reject, { once: true });
                return;
            }
            const el = tipo === "css" ? document.createElement("link") : document.createElement("script");
            if (tipo === "css") { el.rel = "stylesheet"; el.href = url; } else { el.src = url; el.defer = true; }
            el.addEventListener("load", resolve, { once: true }); el.addEventListener("error", reject, { once: true });
            document.head.appendChild(el);
        });
    }
    async function cargarLeaflet() {
        await cargarRecurso("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "css");
        if (!window.L) await cargarRecurso("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "js");
    }

    function prepararContenedor() {
        const visual = document.querySelector(".hero-visual");
        const bloqueMapa = visual?.querySelector(".mapa-ficticio");
        const cabecera = bloqueMapa?.querySelector(".mapa-cabecera");
        const zona = bloqueMapa?.querySelector(".mapa-zona");
        const sello = visual?.querySelector(".sello-confianza");
        if (!visual || !bloqueMapa || !cabecera || !zona) return null;
        bloqueMapa.classList.add("mapa-real-activo");
        if (sello) cabecera.insertAdjacentElement("afterend", sello);
        zona.innerHTML = '<div id="mapa-talleres-real" role="application" aria-label="Mapa de talleres encontrados"></div><div id="mapa-talleres-mensaje" aria-live="polite">Busca una población o usa tu ubicación para ver talleres en el mapa.</div>';
        if (!document.getElementById("estilos-mapa-talleres")) {
            const estilos = document.createElement("style"); estilos.id = "estilos-mapa-talleres";
            estilos.textContent = `.hero-visual{pointer-events:auto!important}.mapa-real-activo>.sello-confianza{position:relative!important;inset:auto!important;transform:none!important;width:auto!important;max-width:none!important;margin:0 14px 12px!important;box-sizing:border-box!important;z-index:2!important}.mapa-real-activo .mapa-zona{position:relative!important;min-height:430px!important;overflow:hidden!important;background:#eef3f7!important}#mapa-talleres-real{position:absolute;inset:0;z-index:1;min-height:430px}#mapa-talleres-mensaje{position:absolute;left:14px;right:14px;bottom:14px;z-index:500;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(15,23,42,.14);font-size:.82rem;color:#334155;pointer-events:none}.mapa-real-activo .leaflet-control-attribution{font-size:9px}.mapa-real-activo .leaflet-popup-content{margin:12px 14px;min-width:180px}.mapa-popup-nombre{font-weight:800;color:#0f172a;margin-bottom:4px}.mapa-popup-direccion{font-size:.82rem;color:#475569;line-height:1.35;margin-bottom:8px}.mapa-popup-enlace{display:inline-flex;padding:7px 10px;border-radius:8px;background:#1457d9;color:#fff!important;font-weight:700;text-decoration:none}@media(max-width:750px){.hero-contenido{display:grid!important;grid-template-columns:1fr!important}.hero-visual{display:block!important;visibility:visible!important;opacity:1!important;grid-column:1!important;width:100%!important;max-width:100%!important;margin:24px 0 0!important;position:relative!important}.hero-visual .mapa-ficticio{display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;width:100%!important;max-width:100%!important}.mapa-real-activo>.sello-confianza{display:flex!important;margin:0 10px 10px!important}.mapa-real-activo .mapa-zona,#mapa-talleres-real{display:block!important;visibility:visible!important;min-height:340px!important;height:340px!important;width:100%!important}}`;
            document.head.appendChild(estilos);
        }
        return zona;
    }

    function ponerMensaje(texto) { const el = document.getElementById("mapa-talleres-mensaje"); if (el) el.textContent = texto; }
    function escapar(valor) { const div = document.createElement("div"); div.textContent = String(valor || ""); return div.innerHTML; }
    function poblacionActual() { return (new URLSearchParams(location.search).get("poblacion") || document.getElementById("poblacion")?.value || "").trim(); }
    function simplificarDireccion(texto) {
        return String(texto || "").replace(/\b(Polígono|Poligono|P\.I\.|PI)\b[^,]*/gi, "").replace(/\s+/g, " ").replace(/^\s*,|,\s*$/g, "").trim();
    }
    function leerTarjetas() {
        return [...document.querySelectorAll("#lista-talleres .taller-card")].slice(0, MAX_PINES).map(card => {
            const nombre = card.querySelector(".taller-titulo, h3")?.textContent?.trim() || "Taller";
            const ubicacion = (card.querySelector(".ubicacion")?.textContent || "").replace(/^\s*⌖\s*/, "").trim();
            const ficha = card.querySelector(".enlace-ficha-taller")?.getAttribute("href") || "";
            return { nombre, ubicacion, ficha };
        }).filter(item => item.ubicacion && !/no indicada/i.test(item.ubicacion));
    }

    async function geocodificarConsulta(texto) {
        const clave = texto.toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
        const cache = cargarCache();
        if (Array.isArray(cache[clave]) && cache[clave].length === 2) return cache[clave];
        const params = new URLSearchParams({ q: `${texto}, España`, format: "jsonv2", limit: "1", countrycodes: "es", "accept-language": "es" });
        const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
        if (!respuesta.ok) throw new Error("No se pudo geocodificar");
        const datos = await respuesta.json(); const primero = Array.isArray(datos) ? datos[0] : null;
        if (!primero) return null;
        const coords = [Number(primero.lat), Number(primero.lon)]; if (!coords.every(Number.isFinite)) return null;
        cache[clave] = coords; guardarCache(cache); return coords;
    }

    async function geocodificarTaller(taller) {
        const poblacion = poblacionActual();
        const simple = simplificarDireccion(taller.ubicacion);
        const consultas = [
            taller.ubicacion,
            poblacion ? `${taller.ubicacion}, ${poblacion}` : "",
            poblacion ? `${taller.nombre}, ${poblacion}` : taller.nombre,
            poblacion && simple && simple !== taller.ubicacion ? `${simple}, ${poblacion}` : ""
        ].filter((q, i, arr) => q && arr.indexOf(q) === i);
        for (let i = 0; i < consultas.length; i++) {
            const coords = await geocodificarConsulta(consultas[i]);
            if (coords) return coords;
            if (i < consultas.length - 1) await new Promise(resolve => setTimeout(resolve, 1050));
        }
        return null;
    }

    function popupTaller(taller) {
        const enlace = taller.ficha ? `<a class="mapa-popup-enlace" href="${escapar(taller.ficha)}">Ver ficha</a>` : "";
        return `<div class="mapa-popup-nombre">${escapar(taller.nombre)}</div><div class="mapa-popup-direccion">${escapar(taller.ubicacion)}</div>${enlace}`;
    }

    async function actualizarPines() {
        if (!mapa || !capaPines) return;
        const miVersion = ++versionRender; const talleres = leerTarjetas(); capaPines.clearLayers();
        if (!talleres.length) {
            const busqueda = poblacionActual();
            if (busqueda) { ponerMensaje(`Sin talleres localizables en el mapa para ${busqueda}.`); try { const centro = await geocodificarConsulta(busqueda); if (miVersion === versionRender && centro) mapa.setView(centro, 13); } catch (_) {} }
            else ponerMensaje("Busca una población o usa tu ubicación para ver talleres en el mapa.");
            return;
        }
        ponerMensaje(`Localizando 0 de ${talleres.length} talleres en el mapa…`);
        const limites = []; let encontrados = 0; let procesados = 0;
        for (const taller of talleres) {
            if (miVersion !== versionRender) return;
            try {
                const coords = await geocodificarTaller(taller);
                if (coords && miVersion === versionRender) { window.L.marker(coords).bindPopup(popupTaller(taller)).addTo(capaPines); limites.push(coords); encontrados += 1; }
            } catch (_) {}
            procesados += 1; ponerMensaje(`${encontrados} de ${talleres.length} talleres localizados · ${procesados} revisados.`);
            if (procesados < talleres.length) await new Promise(resolve => setTimeout(resolve, 1050));
        }
        if (miVersion !== versionRender) return;
        if (marcadorUsuario) limites.push(marcadorUsuario.getLatLng());
        if (limites.length > 1) mapa.fitBounds(limites, { padding: [28, 28], maxZoom: 15 }); else if (limites.length === 1) mapa.setView(limites[0], 15);
        ponerMensaje(encontrados ? `${encontrados} de ${talleres.length} talleres visibles localizados en el mapa.` : "No se pudieron situar con precisión los talleres de esta búsqueda.");
    }

    function observarResultados() {
        const lista = document.getElementById("lista-talleres"); if (!lista) return;
        let temporizador = null, firmaAnterior = "";
        const firmaTarjetas = () => [...lista.querySelectorAll(":scope > .taller-card")].map(card => card.dataset.tallerSlug || card.querySelector(".taller-titulo, h3")?.textContent || "").join("|");
        const programar = () => { const firma = firmaTarjetas(); if (firma === firmaAnterior) return; firmaAnterior = firma; clearTimeout(temporizador); temporizador = setTimeout(actualizarPines, 180); };
        new MutationObserver(programar).observe(lista, { childList: true, subtree: false }); programar();
    }

    async function poblacionDesdeCoordenadas(latitud, longitud) {
        const parametros = new URLSearchParams({
            latitude: String(latitud),
            longitude: String(longitud),
            localityLanguage: "es"
        });
        const respuesta = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${parametros}`, { headers: { Accept: "application/json" } });
        if (!respuesta.ok) throw new Error("No se pudo identificar la población");
        const lugar = await respuesta.json();
        return String(lugar.city || lugar.locality || lugar.principalSubdivision || "").trim();
    }

    function observarUbicacion() {
        const boton = document.getElementById("usar-mi-ubicacion"); if (!boton || !navigator.geolocation) return;
        boton.addEventListener("click", () => navigator.geolocation.getCurrentPosition(async pos => {
            if (!mapa) return;
            const coords = [pos.coords.latitude, pos.coords.longitude];
            if (marcadorUsuario) marcadorUsuario.setLatLng(coords); else marcadorUsuario = window.L.circleMarker(coords, { radius: 8, weight: 3, fillOpacity: .85 }).addTo(mapa).bindPopup("Tu ubicación");
            mapa.setView(coords, 13);
            ponerMensaje("Ubicación detectada. Buscando talleres cercanos…");

            try {
                const poblacion = await poblacionDesdeCoordenadas(coords[0], coords[1]);
                if (!poblacion) throw new Error("Población no encontrada");
                const campoPoblacion = document.getElementById("poblacion");
                const formulario = document.getElementById("formulario-buscador-publico") || document.querySelector("form.buscador");
                const estado = document.getElementById("estado-ubicacion");
                if (campoPoblacion) campoPoblacion.value = poblacion;
                if (estado) estado.textContent = `Ubicación detectada: ${poblacion}. Buscando talleres…`;
                ponerMensaje(`Ubicación detectada: ${poblacion}. Cargando talleres…`);
                if (formulario?.requestSubmit) formulario.requestSubmit();
                else formulario?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            } catch (error) {
                console.error("No se pudo buscar por ubicación:", error);
                ponerMensaje("Ubicación detectada, pero no se pudo identificar la población. Escribe tu localidad para buscar talleres.");
            }
        }, () => { ponerMensaje("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }), { passive: true });
    }

    async function iniciar() {
        if (!prepararContenedor()) return;
        try {
            await cargarLeaflet(); mapa = window.L.map("mapa-talleres-real", { scrollWheelZoom: false }).setView(CENTRO_COMUNITAT, 8);
            window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapa);
            capaPines = window.L.layerGroup().addTo(mapa); observarResultados(); observarUbicacion(); setTimeout(() => mapa.invalidateSize(), 250);
        } catch (error) { console.error("No se pudo iniciar el mapa de talleres:", error); ponerMensaje("El mapa no está disponible en este momento. La búsqueda de talleres sigue funcionando."); }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true }); else void iniciar();
}());
