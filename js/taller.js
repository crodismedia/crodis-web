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
    const verificado = ["1", "true", "si", "sí"].includes(leer("verificado").toLowerCase());
    const fechaActualizacion = leer("actualizado");

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

    function fechaLegible(valor) {
        if (!valor) return "";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return valor.slice(0, 40);
        return new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(fecha);
    }

    function actualizarCorreo(id, asunto, cuerpo) {
        const enlace = document.getElementById(id);
        if (!enlace) return;
        enlace.href = `mailto:info@tallermap.es?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    }

    const webValida = urlSegura(web);
    const consultaMaps = [nombre, direccion, "España"].filter(Boolean).join(", ");
    const urlMaps = direccion
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMaps)}`
        : "";
    const tieneContacto = Boolean(telefono || webValida);
    const fichaCompleta = Boolean(nombre && direccion && tieneContacto);

    texto("taller-nombre", nombre);
    texto("taller-direccion", direccion || "Ubicación no indicada");
    texto("taller-descripcion", descripcion);

    const insignia = document.getElementById("taller-verificacion");
    if (insignia) {
        insignia.textContent = verificado
            ? "Verificado por el propietario"
            : "Datos públicos pendientes de verificar";
        insignia.classList.toggle("verificada", verificado);
    }
    texto(
        "taller-actualizacion",
        fechaActualizacion ? `Última actualización: ${fechaLegible(fechaActualizacion)}` : ""
    );

    document.title = `${nombre}${direccion ? ` · ${direccion}` : ""} | TallerMap`;
    const metaDescripcion = document.querySelector('meta[name="description"]');
    if (metaDescripcion) {
        metaDescripcion.content = `${nombre}${direccion ? ` en ${direccion}` : ""}. Teléfono, servicios y datos públicos disponibles en TallerMap.`.slice(0, 158);
    }

    const canonical = document.getElementById("canonical-taller");
    if (canonical) canonical.href = window.location.href.split("#")[0];

    const robots = document.getElementById("robots-taller");
    if (robots) {
        robots.content = fichaCompleta
            ? "index,follow,max-image-preview:large"
            : "noindex,follow";
    }

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
        if (!fichaCompleta) {
            const avisoIndexacion = document.createElement("p");
            avisoIndexacion.textContent = "Esta ficha no se enviará a los buscadores hasta disponer de dirección y un medio de contacto.";
            datos.appendChild(avisoIndexacion);
        }
    }

    const urlFicha = window.location.href.split("#")[0];
    actualizarCorreo(
        "reclamar-ficha",
        `Reclamar ficha: ${nombre}`,
        `Soy el propietario o representante de ${nombre}.\n\nFicha: ${urlFicha}\n\nNombre y cargo:\nTeléfono de contacto:\nInformación que acredita la titularidad:`
    );
    actualizarCorreo(
        "corregir-ficha",
        `Corregir ficha: ${nombre}`,
        `Quiero informar de datos incorrectos en esta ficha.\n\nFicha: ${urlFicha}\n\nDato incorrecto:\nDato correcto:\nFuente o explicación:`
    );

    const datosEstructurados = {
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        name: nombre,
        description: descripcion,
        url: urlFicha
    };
    if (direccion) datosEstructurados.address = direccion;
    if (telefono) datosEstructurados.telephone = telefono;
    if (webValida) datosEstructurados.sameAs = [webValida];
    if (servicios.length) datosEstructurados.knowsAbout = servicios;
    if (fechaActualizacion) datosEstructurados.dateModified = fechaActualizacion;

    const script = document.getElementById("datos-estructurados-taller");
    if (script) script.textContent = JSON.stringify(datosEstructurados);
}());