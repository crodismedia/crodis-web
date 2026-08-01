(function () {
    "use strict";

    const grupos = [
        { nombre: "Mecánica y mantenimiento", servicios: [
            ["mecanica-general", "Mecánica general"], ["mantenimiento-programado", "Revisión y mantenimiento programado"],
            ["cambio-aceite-filtros", "Cambio de aceite y filtros"], ["pre-itv", "Revisión Pre-ITV"],
            ["frenos", "Frenos"], ["embrague", "Embrague"], ["correa-distribucion", "Correa de distribución"],
            ["cadena-distribucion", "Cadena de distribución"], ["reparacion-motor", "Reparación de motor"],
            ["sistema-refrigeracion", "Sistema de refrigeración"], ["escape-catalizador", "Escape y catalizador"],
            ["caja-cambios", "Caja de cambios"]
        ]},
        { nombre: "Neumáticos, dirección y suspensión", servicios: [
            ["neumaticos", "Neumáticos"], ["alineacion-direccion", "Alineación y dirección"],
            ["equilibrado-ruedas", "Equilibrado de ruedas"], ["suspension-amortiguadores", "Suspensión y amortiguadores"],
            ["direccion", "Sistema de dirección"]
        ]},
        { nombre: "Electricidad y diagnosis", servicios: [
            ["diagnosis-electronica", "Diagnosis electrónica"], ["electricidad-automovil", "Electricidad del automóvil"],
            ["baterias", "Baterías"], ["alternador-motor-arranque", "Alternador y motor de arranque"],
            ["centralitas-electronica", "Centralitas y electrónica"], ["sistemas-adas", "Sistemas ADAS y ayudas a la conducción"],
            ["llaves-codificacion", "Llaves y codificación"]
        ]},
        { nombre: "Carrocería y cristales", servicios: [
            ["chapa-pintura", "Chapa y pintura"], ["carroceria", "Reparación de carrocería"],
            ["lunas-cristales", "Lunas y cristales"], ["desabollado-sin-pintura", "Desabollado sin pintura"],
            ["tapiceria", "Tapicería"]
        ]},
        { nombre: "Climatización", servicios: [
            ["aire-acondicionado", "Aire acondicionado"], ["calefaccion-climatizacion", "Calefacción y climatización"]
        ]},
        { nombre: "Híbridos y eléctricos", servicios: [
            ["hibridos-electricos", "Vehículos híbridos y eléctricos"], ["baterias-alta-tension", "Baterías de alta tensión"],
            ["cargadores-vehiculo-electrico", "Cargadores para vehículo eléctrico"]
        ]},
        { nombre: "Vehículos especiales", servicios: [
            ["furgonetas", "Furgonetas"], ["vehiculos-industriales", "Vehículos industriales"],
            ["autocaravanas", "Autocaravanas"], ["vehiculos-4x4", "Vehículos 4x4"]
        ]},
        { nombre: "Personalización y multimedia", servicios: [
            ["equipos-sonido", "Equipos de sonido y audio para automóvil"], ["multimedia-navegacion", "Pantallas, multimedia y navegación"],
            ["vinilos-rotulacion", "Vinilos y rotulación"], ["wrapping", "Wrapping integral y cambio de color"],
            ["tuning-personalizacion", "Tuning y personalización"], ["iluminacion-automovil", "Iluminación y sistemas LED"]
        ]},
        { nombre: "Otros servicios", servicios: [
            ["grua-asistencia", "Grúa y asistencia en carretera"], ["lavado-detailing", "Lavado y detailing"],
            ["montaje-accesorios", "Montaje de accesorios"], ["homologaciones", "Homologaciones"],
            ["instalacion-glp", "Instalación y mantenimiento GLP"]
        ]}
    ];

    const etiquetas = Object.fromEntries(grupos.flatMap((grupo) => grupo.servicios));
    const iconos = {
        "Mecánica y mantenimiento": "⚙", "Neumáticos, dirección y suspensión": "◉",
        "Electricidad y diagnosis": "⚡", "Carrocería y cristales": "✦", "Climatización": "❄",
        "Híbridos y eléctricos": "▣", "Vehículos especiales": "▤",
        "Personalización y multimedia": "♫", "Otros servicios": "+"
    };

    function serviciosAlfabeticos() {
        return grupos.flatMap((grupo) => grupo.servicios.map(([valor, etiqueta]) => ({ valor, etiqueta, grupo: grupo.nombre })))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" }));
    }

    function rellenarSelect(select) {
        if (!select) return;
        select.replaceChildren();
        const todos = document.createElement("option");
        todos.value = "";
        todos.textContent = "Todos los servicios";
        select.appendChild(todos);
        grupos.forEach((grupo) => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = grupo.nombre;
            grupo.servicios.forEach(([valor, etiqueta]) => {
                const opcion = document.createElement("option");
                opcion.value = valor;
                opcion.textContent = etiqueta;
                optgroup.appendChild(opcion);
            });
            select.appendChild(optgroup);
        });
    }

    function rellenarCheckboxes(contenedor) {
        if (!contenedor) return;
        contenedor.replaceChildren();
        grupos.forEach((grupo) => {
            const seccion = document.createElement("section");
            seccion.className = "servicios-grupo";
            const titulo = document.createElement("h3");
            titulo.textContent = grupo.nombre;
            seccion.appendChild(titulo);
            grupo.servicios.forEach(([valor, etiqueta]) => {
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.name = "servicios";
                input.value = valor;
                label.append(input, document.createTextNode(` ${etiqueta}`));
                seccion.appendChild(label);
            });
            contenedor.appendChild(seccion);
        });
    }

    function rellenarTarjetas(contenedor) {
        if (!contenedor) return;
        contenedor.replaceChildren();
        serviciosAlfabeticos().forEach(({ valor, etiqueta, grupo }) => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "servicio-card";
            const icono = document.createElement("div");
            icono.className = "servicio-icono";
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = iconos[grupo] || "+";
            const titulo = document.createElement("h3");
            titulo.textContent = etiqueta;
            const categoria = document.createElement("p");
            categoria.textContent = grupo;
            const enlace = document.createElement("a");
            enlace.href = "#talleres";
            enlace.dataset.servicio = valor;
            enlace.textContent = "Buscar talleres →";
            tarjeta.append(icono, titulo, categoria, enlace);
            contenedor.appendChild(tarjeta);
        });
    }

    function cargarRecuperacionAdministrativa() {
        if (!document.getElementById("formulario-buscador-internet")) return;
        if (document.querySelector("script[data-tallermap-admin-recuperacion]")) return;
        const script = document.createElement("script");
        script.src = "../js/admin-recuperacion.js";
        script.dataset.tallermapAdminRecuperacion = "true";
        script.addEventListener("error", () => console.error("No se pudo cargar la recuperación administrativa."), { once: true });
        document.head.appendChild(script);
    }

    function retirarGeolocalizacionPublica() {
        const boton = document.getElementById("usar-mi-ubicacion");
        const estado = document.getElementById("estado-ubicacion");
        boton?.remove();
        estado?.remove();
        const ayuda = document.querySelector(".tarjeta-flotante span");
        if (ayuda) ayuda.textContent = "Busca por dirección, población o código postal";
    }

    function textoLimpio(elemento) {
        return String(elemento?.textContent || "").replace(/^⌖\s*/, "").replace(/\s+/g, " ").trim();
    }

    function anadirEnlacesGoogleMaps() {
        document.querySelectorAll(".taller-card").forEach((tarjeta) => {
            if (tarjeta.dataset.mapsPreparado === "true") return;
            const nombre = textoLimpio(tarjeta.querySelector("h3"));
            const ubicacion = textoLimpio(tarjeta.querySelector("p.ubicacion"));
            if (!nombre || !ubicacion || ubicacion === "Ubicación no indicada") return;
            const consulta = [nombre, ubicacion, "España"].filter(Boolean).join(", ");
            const enlace = document.createElement("a");
            enlace.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
            enlace.target = "_blank";
            enlace.rel = "noopener noreferrer";
            enlace.className = "enlace-google-maps";
            enlace.textContent = "Abrir en Google Maps";
            enlace.setAttribute("aria-label", `Abrir ${nombre} en Google Maps mediante su dirección`);
            const contactos = tarjeta.querySelector(".taller-contactos");
            if (contactos) contactos.appendChild(enlace);
            else tarjeta.querySelector(".taller-pie")?.appendChild(enlace);
            tarjeta.dataset.mapsPreparado = "true";
        });
    }

    function observarTarjetas() {
        const lista = document.getElementById("lista-talleres");
        if (!lista) return;
        anadirEnlacesGoogleMaps();
        new MutationObserver(anadirEnlacesGoogleMaps).observe(lista, { childList: true, subtree: true });
    }

    function inicializar() {
        cargarRecuperacionAdministrativa();
        rellenarSelect(document.getElementById("servicio"));
        rellenarCheckboxes(document.getElementById("lista-servicios-registro"));
        rellenarTarjetas(document.getElementById("lista-servicios-publicos"));
        retirarGeolocalizacionPublica();
        observarTarjetas();
    }

    window.TallerMapServicios = { grupos, etiquetas, serviciosAlfabeticos, rellenarSelect, rellenarCheckboxes, rellenarTarjetas };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializar);
    else inicializar();
}());
