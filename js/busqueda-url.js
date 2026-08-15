(function () {
    "use strict";

    const normalizarTexto = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    function prepararBuscador() {
        const formulario = document.getElementById("formulario-buscador-publico");
        const poblacion = document.getElementById("poblacion");
        const servicio = document.getElementById("servicio");
        const buscar = document.getElementById("boton-buscar");
        const registro = formulario?.querySelector(':scope > a[href*="registro"]');
        if (!formulario || !poblacion || !servicio || !buscar || !registro) return;

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
            radio.setAttribute("aria-label", "Radio de búsqueda");
            radio.innerHTML = [
                '<option value="1">1 km</option>',
                '<option value="3">3 km</option>',
                '<option value="5" selected>5 km</option>',
                '<option value="10">10 km</option>'
            ].join("");
        }

        const radioUrl = new URLSearchParams(location.search).get("radio");
        if (["1", "3", "5", "10"].includes(radioUrl)) radio.value = radioUrl;

        let ubicacion = document.getElementById("usar-mi-ubicacion");
        if (!ubicacion) {
            ubicacion = document.createElement("button");
            ubicacion.type = "button";
            ubicacion.id = "usar-mi-ubicacion";
            ubicacion.className = "boton";
            ubicacion.textContent = "Usar mi ubicación";
        }

        /* Orden definitivo de cada columna. */
        contenidoPoblacion?.appendChild(ubicacion);
        contenidoPoblacion?.appendChild(registro);
        contenidoServicio?.appendChild(radio);
        contenidoServicio?.appendChild(buscar);

        ubicacion.onclick = () => {
            if (!navigator.geolocation) return;
            ubicacion.disabled = true;
            ubicacion.textContent = "Localizando…";

            navigator.geolocation.getCurrentPosition(async posicion => {
                try {
                    const parametros = new URLSearchParams({
                        format: "jsonv2",
                        lat: String(posicion.coords.latitude),
                        lon: String(posicion.coords.longitude),
                        zoom: "10",
                        addressdetails: "1",
                        "accept-language": "es"
                    });

                    const respuesta = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?${parametros}`,
                        { headers: { Accept: "application/json" } }
                    );
                    const datos = await respuesta.json();
                    const direccion = datos.address || {};
                    const localidad = direccion.city || direccion.town || direccion.village
                        || direccion.municipality || direccion.county || "";

                    if (localidad) {
                        poblacion.value = localidad;
                        formulario.requestSubmit();
                    }
                } catch (_) {
                    /* Mantener búsqueda manual disponible. */
                } finally {
                    ubicacion.disabled = false;
                    ubicacion.textContent = "Usar mi ubicación";
                }
            }, () => {
                ubicacion.disabled = false;
                ubicacion.textContent = "Usar mi ubicación";
            }, { timeout: 15000, maximumAge: 300000 });
        };

        const params = new URLSearchParams(location.search);
        const poblacionUrl = params.get("poblacion");
        if (poblacionUrl && !poblacion.value) poblacion.value = poblacionUrl.slice(0, 80);

        const servicioUrl = normalizarTexto(params.get("servicio"));
        if (servicioUrl) {
            const opcion = [...servicio.options].find(o =>
                normalizarTexto(o.value) === servicioUrl
                || normalizarTexto(o.textContent) === servicioUrl
            );
            if (opcion) servicio.value = opcion.value;
        }

        let estilos = document.getElementById("layout-buscador-final");
        if (!estilos) {
            estilos = document.createElement("style");
            estilos.id = "layout-buscador-final";
            estilos.textContent = `
                #formulario-buscador-publico{
                    display:grid!important;
                    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
                    gap:0!important;
                    align-items:stretch!important;
                    padding:22px!important;
                }
                #formulario-buscador-publico>.campo-busqueda{
                    display:block!important;
                    min-width:0!important;
                    position:relative!important;
                    inset:auto!important;
                    transform:none!important;
                    margin:0!important;
                    box-sizing:border-box!important;
                }
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(1){
                    grid-column:1!important;
                    grid-row:1!important;
                    border-right:1px solid #dfe6ef!important;
                    padding:8px 28px 8px 8px!important;
                }
                #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){
                    grid-column:2!important;
                    grid-row:1!important;
                    padding:8px 8px 8px 28px!important;
                }
                #formulario-buscador-publico>.campo-busqueda>div{
                    display:flex!important;
                    flex-direction:column!important;
                    width:100%!important;
                    min-width:0!important;
                    position:static!important;
                    transform:none!important;
                }
                #formulario-buscador-publico label{
                    display:block!important;
                    margin:0 0 8px!important;
                    line-height:1.25!important;
                }
                #formulario-buscador-publico .poblacion-controles{
                    display:block!important;
                    width:100%!important;
                    position:static!important;
                }
                #formulario-buscador-publico #poblacion,
                #formulario-buscador-publico #servicio,
                #formulario-buscador-publico #radio-busqueda{
                    display:block!important;
                    width:100%!important;
                    min-width:0!important;
                    min-height:48px!important;
                    box-sizing:border-box!important;
                    border:1px solid #cfd8e3!important;
                    border-radius:9px!important;
                    background:#fff!important;
                    color:#162033!important;
                    padding:10px 12px!important;
                    font:inherit!important;
                    position:static!important;
                    transform:none!important;
                }
                #formulario-buscador-publico #radio-busqueda{
                    margin:12px 0 0!important;
                }
                #formulario-buscador-publico #usar-mi-ubicacion,
                #formulario-buscador-publico a[href*="registro"],
                #formulario-buscador-publico #boton-buscar{
                    display:flex!important;
                    position:static!important;
                    inset:auto!important;
                    transform:none!important;
                    width:100%!important;
                    max-width:none!important;
                    min-height:48px!important;
                    box-sizing:border-box!important;
                    margin:12px 0 0!important;
                    align-items:center!important;
                    justify-content:center!important;
                    padding:10px 16px!important;
                    border-radius:10px!important;
                    font-weight:800!important;
                    white-space:normal!important;
                    text-align:center!important;
                }
                #formulario-buscador-publico #usar-mi-ubicacion{
                    background:#F59E0B!important;
                    border:1px solid #F59E0B!important;
                    color:#fff!important;
                    box-shadow:none!important;
                }
                #formulario-buscador-publico #usar-mi-ubicacion:hover,
                #formulario-buscador-publico #usar-mi-ubicacion:focus-visible{
                    background:#D97706!important;
                    border-color:#D97706!important;
                }
                #formulario-buscador-publico a[href*="registro"]{
                    background:#1457D9!important;
                    border:1px solid #1457D9!important;
                    color:#fff!important;
                    box-shadow:none!important;
                }
                #formulario-buscador-publico a[href*="registro"]:hover,
                #formulario-buscador-publico a[href*="registro"]:focus-visible{
                    background:#0B43AD!important;
                    border-color:#0B43AD!important;
                }
                #formulario-buscador-publico #boton-buscar{
                    background:#07883F!important;
                    border:1px solid #07883F!important;
                    color:#fff!important;
                    box-shadow:none!important;
                }
                #formulario-buscador-publico #boton-buscar:hover,
                #formulario-buscador-publico #boton-buscar:focus-visible{
                    background:#066D35!important;
                    border-color:#066D35!important;
                }
                @media(max-width:750px){
                    #formulario-buscador-publico{
                        grid-template-columns:1fr!important;
                        gap:10px!important;
                        padding:12px!important;
                    }
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(1),
                    #formulario-buscador-publico>.campo-busqueda:nth-of-type(2){
                        grid-column:1!important;
                        grid-row:auto!important;
                        border-right:0!important;
                        border-bottom:0!important;
                        padding:6px!important;
                    }
                    #formulario-buscador-publico #poblacion,
                    #formulario-buscador-publico #servicio,
                    #formulario-buscador-publico #radio-busqueda{
                        font-size:16px!important;
                    }
                }
            `;
            document.head.appendChild(estilos);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", prepararBuscador, { once: true });
    } else {
        prepararBuscador();
    }
}());
