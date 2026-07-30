(function () {
    "use strict";

    if (!document.getElementById("formulario-buscador-internet")) return;

    const REEMPLAZOS = [
        ["ĂĄ", "á"], ["Ăˇ", "á"], ["ĂŠ", "é"], ["Ă©", "é"],
        ["Ă­", "í"], ["Ăł", "ó"], ["Ăş", "ú"], ["Ă±", "ñ"],
        ["Ă", "Á"], ["Ă‰", "É"], ["Ă", "Í"], ["Ă“", "Ó"],
        ["Ăš", "Ú"], ["Ă‘", "Ñ"], ["âŚ", "…"], ["â€¦", "…"],
        ["â", "—"], ["â€”", "—"], ["â", "–"], ["Âˇ", "·"],
        ["Â·", "·"], ["â", "✓"], ["âœ“", "✓"], ["Â¿", "¿"],
        ["Â¡", "¡"], ["Ã¡", "á"], ["Ã©", "é"], ["Ã­", "í"],
        ["Ã³", "ó"], ["Ãº", "ú"], ["Ã±", "ñ"], ["Ã", "Á"],
        ["Ã‰", "É"], ["Ã", "Í"], ["Ã“", "Ó"], ["Ãš", "Ú"],
        ["Ã‘", "Ñ"]
    ];

    function repararTexto(valor) {
        let texto = String(valor || "");
        for (let vuelta = 0; vuelta < 3; vuelta += 1) {
            const anterior = texto;
            for (const [incorrecto, correcto] of REEMPLAZOS) {
                texto = texto.split(incorrecto).join(correcto);
            }
            if (texto === anterior) break;
        }
        return texto;
    }

    function repararNodo(raiz) {
        if (!raiz) return;
        if (raiz.nodeType === Node.TEXT_NODE) {
            const reparado = repararTexto(raiz.textContent);
            if (reparado !== raiz.textContent) raiz.textContent = reparado;
            return;
        }
        if (raiz.nodeType !== Node.ELEMENT_NODE && raiz.nodeType !== Node.DOCUMENT_NODE) return;

        const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        let nodo = caminante.nextNode();
        while (nodo) {
            const reparado = repararTexto(nodo.textContent);
            if (reparado !== nodo.textContent) nodo.textContent = reparado;
            nodo = caminante.nextNode();
        }

        const elementos = raiz.nodeType === Node.ELEMENT_NODE
            ? [raiz, ...raiz.querySelectorAll("[placeholder], [title], [aria-label]")]
            : [...raiz.querySelectorAll("[placeholder], [title], [aria-label]")];
        for (const elemento of elementos) {
            for (const atributo of ["placeholder", "title", "aria-label"]) {
                if (!elemento.hasAttribute?.(atributo)) continue;
                const actual = elemento.getAttribute(atributo);
                const reparado = repararTexto(actual);
                if (reparado !== actual) elemento.setAttribute(atributo, reparado);
            }
        }
    }

    function instalarReparacionVisual() {
        repararNodo(document.body);
        const observador = new MutationObserver((cambios) => {
            for (const cambio of cambios) {
                if (cambio.type === "characterData") repararNodo(cambio.target);
                cambio.addedNodes.forEach(repararNodo);
            }
        });
        observador.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    function texto(valor, maximo = 255) {
        return String(valor || "").trim().slice(0, maximo);
    }

    function primerValor(objeto, claves) {
        for (const clave of claves) {
            if (objeto?.[clave]) return texto(objeto[clave]);
        }
        return "";
    }

    async function localizarPoblacionDesdeNavegador(ubicacion, radioKm) {
        const controlador = new AbortController();
        const limite = setTimeout(() => controlador.abort(), 15000);
        try {
            const url = new URL("https://nominatim.openstreetmap.org/search");
            url.searchParams.set("q", `${ubicacion}, España`);
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("addressdetails", "1");
            url.searchParams.set("countrycodes", "es");
            url.searchParams.set("limit", "1");

            const respuesta = await fetch(url, {
                headers: { Accept: "application/json", "Accept-Language": "es" },
                signal: controlador.signal
            });
            if (!respuesta.ok) throw new Error(`Nominatim HTTP ${respuesta.status}`);

            const lugares = await respuesta.json();
            if (!Array.isArray(lugares) || !lugares.length) {
                throw new Error("No se encontró esa ubicación en España");
            }

            const lugar = lugares[0];
            const latitud = Number(lugar.lat);
            const longitud = Number(lugar.lon);
            if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
                throw new Error("La ubicación no tiene coordenadas válidas");
            }

            const limiteRadio = Math.min(25, Math.max(1, Number(radioKm) || 10));
            const radioMetros = Math.round(limiteRadio * 1000);
            const limites = Array.isArray(lugar.boundingbox) && lugar.boundingbox.length === 4
                ? {
                    sur: Number(lugar.boundingbox[0]),
                    norte: Number(lugar.boundingbox[1]),
                    oeste: Number(lugar.boundingbox[2]),
                    este: Number(lugar.boundingbox[3])
                }
                : null;
            const direccion = lugar.address || {};
            const consultaOverpass = `[out:json][timeout:35];\n(\n  nwr["shop"="car_repair"](around:${radioMetros},${latitud},${longitud});\n  nwr["craft"="car_repair"](around:${radioMetros},${latitud},${longitud});\n  nwr["amenity"="car_repair"](around:${radioMetros},${latitud},${longitud});\n);\nout center tags 80;`;

            return {
                modo_consulta: "navegador",
                consulta_overpass: consultaOverpass,
                servidores_overpass: [
                    "https://overpass-api.de/api/interpreter",
                    "https://overpass.private.coffee/api/interpreter",
                    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
                ],
                ubicacion: {
                    nombre: texto(lugar.display_name, 300),
                    latitud,
                    longitud,
                    radio_km: limiteRadio
                },
                poblacion: {
                    nombre: primerValor(direccion, ["city", "town", "village", "municipality"])
                        || ubicacion.split(",")[0].trim(),
                    codigo_postal: texto(direccion.postcode, 10),
                    provincia: primerValor(direccion, ["province", "state"]),
                    limites
                },
                atribucion: "© colaboradores de OpenStreetMap, datos ODbL"
            };
        } finally {
            clearTimeout(limite);
        }
    }

    function instalarRescateBuscador() {
        const cliente = window.supabaseClient;
        if (!cliente?.functions?.invoke || cliente.functions.__tallermapRescate) return;

        const invocarOriginal = cliente.functions.invoke.bind(cliente.functions);
        cliente.functions.invoke = async function (nombre, opciones) {
            if (nombre !== "buscar-talleres-internet") {
                return invocarOriginal(nombre, opciones);
            }

            let respuestaOriginal = null;
            try {
                respuestaOriginal = await invocarOriginal(nombre, opciones);
                if (!respuestaOriginal?.error && respuestaOriginal?.data) {
                    return respuestaOriginal;
                }
            } catch (error) {
                respuestaOriginal = { data: null, error };
            }

            try {
                const ubicacion = texto(opciones?.body?.ubicacion, 120);
                if (ubicacion.length < 2) return respuestaOriginal;
                const data = await localizarPoblacionDesdeNavegador(
                    ubicacion,
                    opciones?.body?.radio_km
                );
                return { data, error: null };
            } catch (errorRescate) {
                console.error("No se pudo activar el rescate del buscador:", errorRescate);
                return respuestaOriginal || { data: null, error: errorRescate };
            }
        };
        cliente.functions.__tallermapRescate = true;
    }

    function iniciar() {
        instalarRescateBuscador();
        instalarReparacionVisual();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
