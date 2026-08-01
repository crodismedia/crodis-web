(function () {
    "use strict";

    const parametros = new URLSearchParams(window.location.search);
    const leer = (clave) => String(parametros.get(clave) || "").trim();
    const nombre = leer("nombre") || "Taller publicado en TallerMap";
    const direccion = leer("direccion");
    const telefono = leer("telefono").replace(/[^\d+]/g, "");
    const web = leer("web");
    const descripcion = leer("descripcion") || "Consulta los datos públicos disponibles de este taller.";
    const servicios = leer("servicios").split("|").map((valor) => valor.trim()).filter(Boolean);

    function texto(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    }

    function urlSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(valor);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    const webValida = urlSegura(web);
    const consultaMaps = [nombre, direccion, "España"].filter(Boolean).join(", ");
    const urlMaps = direccion
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMaps)}`
        : "";

    texto("taller-nombre", nombre);
    texto("taller-direccion", direccion || "Ubicación no indicada");
    texto("taller-descripcion", descripcion);

    document.title = `${nombre}${direccion ? ` · ${direccion}` : ""} | TallerMap`;
    const metaDescripcion = document.querySelector('meta[name="description"]');
    if (metaDescripcion) {
        metaDescripcion.content = `${nombre}${direccion ? ` en ${direccion}` : ""}. Teléfono, servicios y datos públicos disponibles en TallerMap.`.slice(0, 158);
    }

    const canonical = document.getElementById("canonical-taller");
    if (canonical) canonical.href = window.location.href.split("#")[0];

    const acciones = document.getElementById("taller-acciones");
    if (acciones) {
        if (telefono) {
            const llamar = document.createElement("a");
            llamar.className = "boton";
            llamar.href = `tel:${telefono}`;
            llamar.textContent = "Llamar";
            acciones.appendChild(llamar);
        }
        if (urlMaps) {
            const maps = document.createElement("a");
            maps.className = "boton";
            maps.href = urlMaps;
            maps.target = "_blank";
            maps.rel = "noopener noreferrer";
            maps.textContent = "Abrir en Google Maps";
            acciones.appendChild(maps);
        }
        if (webValida) {
            const sitio = document.createElement("a");
            sitio.className = "boton boton-claro";
            sitio.href = webValida;
            sitio.target = "_blank";
            sitio.rel = "noopener noreferrer";
            sitio.textContent = "Página web";
            acciones.appendChild(sitio);
        }
    }

    const serviciosContenedor = document.getElementById("taller-servicios");
    if (serviciosContenedor && servicios.length) {
        servicios.forEach((servicio) => {
            const etiqueta = document.createElement("span");
            etiqueta.textContent = servicio;
            serviciosContenedor.appendChild(etiqueta);
        });
    }

    const datos = document.getElementById("taller-datos");
    if (datos) {
        if (telefono) {
            const filaTelefono = document.createElement("p");
            filaTelefono.textContent = `Teléfono: ${telefono}`;
            datos.appendChild(filaTelefono);
        }
        const aviso = document.createElement("p");
        aviso.textContent = "La información procede de la ficha publicada en TallerMap y puede ser revisada o actualizada.";
        datos.appendChild(aviso);
    }

    const datosEstructurados = {
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        name: nombre,
        description: descripcion,
        url: window.location.href.split("#")[0]
    };
    if (direccion) datosEstructurados.address = direccion;
    if (telefono) datosEstructurados.telephone = telefono;
    if (webValida) datosEstructurados.sameAs = [webValida];
    if (servicios.length) datosEstructurados.knowsAbout = servicios;

    const script = document.getElementById("datos-estructurados-taller");
    if (script) script.textContent = JSON.stringify(datosEstructurados);
}());