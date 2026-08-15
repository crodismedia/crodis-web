(function () {
    "use strict";

    const normalizarTexto = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        if (!formulario || !poblacion || !servicio) return;

        formulario.querySelectorAll(".campo-icono").forEach(el => el.remove());
        poblacion.closest(".campo-busqueda")?.querySelectorAll("small").forEach(el => el.remove());

        let radio = document.getElementById("radio-busqueda");
        if (!radio) {
            radio = document.createElement("select");
            radio.id = "radio-busqueda";
            radio.name = "radio";
            radio.setAttribute("aria-label", "Radio de búsqueda");
            radio.innerHTML = '<option value="1">1 km</option><option value="3">3 km</option><option value="5" selected>5 km</option><option value="10">10 km</option>';
            servicio.insertAdjacentElement("afterend", radio);
        }
        const radioUrl = new URLSearchParams(location.search).get("radio");
        if (["1","3","5","10"].includes(radioUrl)) radio.value = radioUrl;

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
            poblacion.closest(".campo-busqueda")?.querySelector("div > div")?.insertAdjacentElement("afterend", ubicacion);
        }

        ubicacion.onclick = () => {
            if (!navigator.geolocation) return;
            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";
            navigator.geolocation.getCurrentPosition(async pos => {
                try {
                    const p = new URLSearchParams({format:"jsonv2",lat:String(pos.coords.latitude),lon:String(pos.coords.longitude),zoom:"10",addressdetails:"1","accept-language":"es"});
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${p}`, {headers:{Accept:"application/json"}});
                    const d = await r.json();
                    const a = d.address || {};
                    const localidad = a.city || a.town || a.village || a.municipality || a.county || "";
                    if (localidad) { poblacion.value = localidad; formulario.requestSubmit(); }
                } catch (_) {}
                ubicacion.disabled = false; ubicacion.textContent = "Usar mi ubicación";
            }, () => { ubicacion.disabled = false; ubicacion.textContent = "Usar mi ubicación"; }, {timeout:15000,maximumAge:300000});
        };

        const params = new URLSearchParams(location.search);
        if (params.get("poblacion") && !poblacion.value) poblacion.value = params.get("poblacion").slice(0,80);
        const sv = normalizarTexto(params.get("servicio"));
        if (sv) {
            const op = [...servicio.options].find(o => normalizarTexto(o.value) === sv || normalizarTexto(o.textContent) === sv);
            if (op) servicio.value = op.value;
        }

        let style = document.getElementById("layout-buscador-final");
        if (!style) {
            style = document.createElement("style");
            style.id = "layout-buscador-final";
            style.textContent = `
            #formulario-buscador-publico{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:14px 28px!important;align-items:start!important;padding:22px!important}
            #formulario-buscador-publico>.campo-busqueda:nth-of-type(1){grid-column:1!important;grid-row:1!important;border-right:1px solid #dfe6ef!important;padding:8px 28px 8px 8px!important}
            #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:2!important;grid-row:1!important;padding:8px!important}
            #formulario-buscador-publico>.campo-busqueda>div{width:100%!important}
            #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{width:100%!important;min-height:48px!important;box-sizing:border-box!important;border:1px solid #cfd8e3!important;border-radius:9px!important;background:#fff!important;color:#162033!important;padding:10px 12px!important;font:inherit!important}
            #formulario-buscador-publico #radio-busqueda{display:block!important;margin-top:12px!important}
            #formulario-buscador-publico #usar-mi-ubicacion{display:flex!important;width:100%!important;min-height:48px!important;margin:12px 0 0!important;align-items:center!important;justify-content:center!important;background:#F59E0B!important;border:1px solid #F59E0B!important;border-radius:10px!important;color:#fff!important;font-weight:800!important;box-shadow:none!important}
            #formulario-buscador-publico #usar-mi-ubicacion:hover{background:#D97706!important;border-color:#D97706!important}
            #formulario-buscador-publico>a[href*="registro"]{grid-column:1!important;grid-row:2!important;width:calc(100% - 28px)!important;min-height:48px!important;margin:0 28px 0 8px!important;box-sizing:border-box!important;justify-self:start!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#07883f!important;border-color:#07883f!important;color:#fff!important;border-radius:10px!important;font-weight:800!important}
            #formulario-buscador-publico #boton-buscar{grid-column:2!important;grid-row:2!important;width:calc(100% - 16px)!important;min-height:48px!important;margin:0 8px!important;align-self:start!important;background:#07883f!important;border-color:#07883f!important;color:#fff!important;border-radius:10px!important;font-weight:800!important;padding:10px 16px!important}
            #formulario-buscador-publico #boton-buscar:hover,#formulario-buscador-publico>a[href*="registro"]:hover{background:#066d35!important;border-color:#066d35!important}
            @media(max-width:750px){
              #formulario-buscador-publico{grid-template-columns:1fr!important;gap:10px!important;padding:12px!important}
              #formulario-buscador-publico>.campo-busqueda:nth-of-type(1){grid-column:1!important;grid-row:1!important;border-right:0!important;border-bottom:0!important;padding:6px!important}
              #formulario-buscador-publico>a[href*="registro"]{grid-column:1!important;grid-row:2!important;width:calc(100% - 12px)!important;margin:0 6px!important}
              #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){grid-column:1!important;grid-row:3!important;padding:6px!important}
              #formulario-buscador-publico #boton-buscar{grid-column:1!important;grid-row:4!important;width:calc(100% - 12px)!important;margin:0 6px!important}
              #formulario-buscador-publico #poblacion,#formulario-buscador-publico #servicio,#formulario-buscador-publico #radio-busqueda{font-size:16px!important}
            }`;
            document.head.appendChild(style);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepararBuscador, {once:true});
    else prepararBuscador();
}());
