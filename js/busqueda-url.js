(function () {
    "use strict";

    const RADIOS_VALIDOS = new Set(["1","2","3","4","5","6","7","8","9","10"]);

    const normalizarTexto = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    function cargarMapaReal() {
        if (document.querySelector('script[data-tallermap-mapa="1"]')) return;
        const script = document.createElement("script");
        script.src = "/js/mapa-talleres.js?v=20260815-2";
        script.defer = true;
        script.dataset.tallermapMapa = "1";
        document.head.appendChild(script);
    }

    function obtenerPosicionActual() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 15000
            });
        });
    }

    function actualizarUrlRadio(radio) {
        const url = new URL(location.href);
        if (radio) url.searchParams.set("radio", radio); else url.searchParams.delete("radio");
        history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function renderCercanos(talleres, radio, estado) {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor) return;
        const ui = window.TallerMapTallerUI;
        const ordenados = [...talleres].sort((a,b) => Number(a.distancia_km ?? Infinity) - Number(b.distancia_km ?? Infinity));

        if (!ordenados.length) {
            contenedor.innerHTML = `<p class="mensaje-talleres">No hay talleres con ubicación registrada dentro de ${radio} km.</p>`;
            estado.textContent = `No se encontraron talleres dentro de ${radio} km.`;
            return;
        }

        if (ui?.crearTarjeta) {
            contenedor.innerHTML = ordenados.map(taller => ui.crearTarjeta(taller)).join("");
        } else {
            contenedor.innerHTML = ordenados.map(taller => {
                const nombre = String(taller.nombre || "Taller").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
                const distancia = Number(taller.distancia_km);
                const d = Number.isFinite(distancia) ? `${distancia.toFixed(1)} km` : "";
                return `<article class="taller-card"><div class="taller-informacion"><h3>${nombre}</h3>${d?`<p class="ubicacion"><strong>A ${d}</strong></p>`:""}</div></article>`;
            }).join("");
        }

        const titulo = document.querySelector("#talleres .titulo-seccion h2");
        if (titulo) titulo.textContent = `${ordenados.length} talleres dentro de ${radio} km`;
        const indicador = document.querySelector(".mapa-estado");
        if (indicador) indicador.textContent = `${ordenados.length} por proximidad`;
        estado.textContent = `${ordenados.length} talleres encontrados dentro de ${radio} km, ordenados por distancia real.`;
    }

    async function buscarPorDistancia({ radio, servicio, estado, boton }) {
        const sb = window.supabaseClient;
        if (!sb?.rpc) throw new Error("Supabase no disponible");
        const posicion = await obtenerPosicionActual();
        const precision = Number(posicion.coords.accuracy);
        if (Number.isFinite(precision) && precision > 3000) throw new Error("La ubicación del dispositivo es demasiado imprecisa");

        const { data, error } = await sb.rpc("buscar_talleres_cercanos", {
            p_latitud: Number(posicion.coords.latitude),
            p_longitud: Number(posicion.coords.longitude),
            p_radio_km: Number(radio),
            p_servicio: servicio || null,
            p_limite: 20
        });
        if (error) throw error;
        renderCercanos(Array.isArray(data) ? data : [], radio, estado);
        document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth", block: "start" });
        boton.textContent = "Buscar talleres";
    }

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const buscar = document.getElementById("boton-buscar");
        if (!formulario || !poblacion || !servicio || !buscar) return;

        formulario.querySelectorAll(".campo-icono").forEach(el => el.remove());
        const bloquePoblacion = poblacion.closest(".campo-busqueda");
        const bloqueServicio = servicio.closest(".campo-busqueda");
        const contenidoPoblacion = bloquePoblacion?.querySelector(":scope > div");
        const contenidoServicio = bloqueServicio?.querySelector(":scope > div");
        bloquePoblacion?.querySelectorAll("small").forEach(el => el.remove());

        let radio = document.getElementById("radio-busqueda");
        if (!radio) {
            radio = document.createElement("select");
            radio.id = "radio-busqueda";
            radio.name = "radio";
            radio.setAttribute("aria-label", "Distancia desde mi ubicación");
            radio.innerHTML = ['<option value="">Distancia</option>', ...Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1} km</option>`)].join("");
        }

        const radioUrl = new URLSearchParams(location.search).get("radio") || "";
        radio.value = RADIOS_VALIDOS.has(radioUrl) ? radioUrl : "";

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
        }

        let estado = document.getElementById("estado-ubicacion");
        if (!estado) {
            estado = document.createElement("small");
            estado.id = "estado-ubicacion";
            estado.setAttribute("aria-live", "polite");
        }

        contenidoPoblacion?.appendChild(ubicacion);
        contenidoPoblacion?.appendChild(estado);
        contenidoPoblacion?.appendChild(buscar);
        contenidoServicio?.appendChild(radio);

        ubicacion.onclick = async () => {
            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";
            estado.textContent = "Buscando tu ubicación…";
            try {
                const posicion = await obtenerPosicionActual();
                const parametros = new URLSearchParams({format:"jsonv2",lat:String(posicion.coords.latitude),lon:String(posicion.coords.longitude),zoom:"18",addressdetails:"1","accept-language":"es"});
                const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?${parametros}`, { headers: { Accept: "application/json" } });
                if (!respuesta.ok) throw new Error("No se pudo resolver la ubicación");
                const datos = await respuesta.json();
                const d = datos.address || {};
                const localidad = d.town || d.village || d.city || d.municipality || d.city_district || "";
                const cp = String(d.postcode || "").match(/^\d{5}$/)?.[0] || "";
                if (localidad || cp) poblacion.value = localidad || cp;
                estado.textContent = localidad ? `Ubicación detectada: ${localidad}${cp?` (${cp})`:""}.` : "Ubicación detectada.";
            } catch (error) {
                estado.textContent = "No se pudo obtener tu ubicación. Revisa el permiso de ubicación.";
            } finally {
                ubicacion.disabled = false;
                ubicacion.textContent = "Usar mi ubicación";
            }
        };

        radio.addEventListener("change", () => {
            actualizarUrlRadio(RADIOS_VALIDOS.has(radio.value) ? radio.value : "");
            estado.textContent = radio.value ? `Filtro activo: hasta ${radio.value} km desde tu ubicación.` : "";
        });

        formulario.addEventListener("submit", async evento => {
            const r = RADIOS_VALIDOS.has(radio.value) ? radio.value : "";
            if (!r) return;
            evento.preventDefault();
            evento.stopImmediatePropagation();
            actualizarUrlRadio(r);
            buscar.disabled = true;
            buscar.textContent = "Buscando por distancia…";
            estado.textContent = `Buscando talleres a menos de ${r} km…`;
            try {
                await buscarPorDistancia({ radio:r, servicio:servicio.value || "", estado, boton:buscar });
            } catch (error) {
                console.error("Búsqueda por distancia:", error);
                estado.textContent = error?.code === 1
                    ? "Necesitas permitir la ubicación para usar el filtro de distancia."
                    : `No se pudo aplicar el filtro de distancia: ${error?.message || "error de ubicación"}.`;
            } finally {
                buscar.disabled = false;
                buscar.textContent = "Buscar talleres";
            }
        }, true);

        const params = new URLSearchParams(location.search);
        const poblacionUrl = params.get("poblacion");
        if (poblacionUrl && !poblacion.value) poblacion.value = poblacionUrl.slice(0,80);
        const servicioUrl = normalizarTexto(params.get("servicio"));
        if (servicioUrl) {
            const opcion = [...servicio.options].find(o => normalizarTexto(o.value) === servicioUrl || normalizarTexto(o.textContent) === servicioUrl);
            if (opcion) servicio.value = opcion.value;
        }

        let estilos = document.getElementById("layout-buscador-final");
        if (!estilos) {
            estilos = document.createElement("style");
            estilos.id = "layout-buscador-final";
            estilos.textContent = `
                #formulario-buscador-publico{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:0!important;align-items:stretch!important;padding:22px!important}
                #formulario-buscador-publico>.campo-busqueda{display:block!important;min-width:0!important;position:relative!important;margin:0!important;box-sizing:border-box!important}
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(1){grid-column:1!important;padding:8px 28px 8px 8px!important;border-right:1px solid #dfe6ef!important}
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:2!important;padding:8px 8px 8px 28px!important}
                #formulario-buscador-publico>.campo-busqueda>div{display:flex!important;flex-direction:column!important;width:100%!important;min-width:0!important}
                #formulario-buscador-publico label{display:block!important;margin:0 0 8px!important}
                #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{display:block!important;width:100%!important;min-height:48px!important;box-sizing:border-box!important;border:1px solid #cfd8e3!important;border-radius:9px!important;background:#fff!important;color:#162033!important;padding:10px 12px!important;font:inherit!important}
                #formulario-buscador-publico #radio-busqueda{margin:12px 0 0!important}
                #formulario-buscador-publico #usar-mi-ubicacion,#formulario-buscador-publico #boton-buscar{display:flex!important;width:100%!important;min-height:48px!important;margin:12px 0 0!important;align-items:center!important;justify-content:center!important;padding:10px 16px!important;border-radius:10px!important;font-weight:800!important}
                #formulario-buscador-publico #estado-ubicacion{display:block!important;margin:7px 0 0!important;color:#64748b!important;font-size:.74rem!important;line-height:1.35!important}
                #formulario-buscador-publico #estado-ubicacion:empty{display:none!important}
                #formulario-buscador-publico #usar-mi-ubicacion{background:#F59E0B!important;border:1px solid #F59E0B!important;color:#fff!important}
                #formulario-buscador-publico #boton-buscar{background:#07883F!important;border:1px solid #07883F!important;color:#fff!important}
                @media(max-width:1050px){
                    #formulario-buscador-publico{grid-template-columns:1fr!important;gap:10px!important;padding:12px!important}
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1),#formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:1!important;border-right:0!important;padding:6px!important}
                    #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{font-size:16px!important}
                }
            `;
            document.head.appendChild(estilos);
        }
    }

    function iniciar() {
        prepararBuscador();
        cargarMapaReal();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once:true });
    else iniciar();
}());
