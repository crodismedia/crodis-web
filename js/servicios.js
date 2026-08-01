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
        document.getElementById("usar-mi-ubicacion")?.remove();
        document.getElementById("estado-ubicacion")?.remove();
        const ayuda = document.querySelector(".tarjeta-flotante span");
        if (ayuda) ayuda.textContent = "Busca por dirección, población o código postal";
    }

    function aplicarEstilosBotonesMoviles() {
        if (document.getElementById("estilos-botones-taller-movil")) return;
        const estilo = document.createElement("style");
        estilo.id = "estilos-botones-taller-movil";
        estilo.textContent = `
            .taller-contactos {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
            }
            .taller-contactos a,
            .enlace-ficha-taller,
            .enlace-google-maps {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 38px;
                padding: 9px 12px;
                border: 1px solid #c8dcfa;
                border-radius: 9px;
                color: #0d57b7;
                background: #edf5ff;
                font-size: 12px;
                font-weight: 800;
                line-height: 1.2;
                text-align: center;
            }
            .enlace-google-maps {
                color: #ffffff;
                background: #1457d9;
                border-color: #1457d9;
            }
            @media (max-width: 720px) {
                .taller-card,
                .taller-informacion {
                    min-width: 0;
                    overflow: visible;
                }
                .taller-pie {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 12px !important;
                    width: 100% !important;
                }
                .taller-contactos {
                    display: grid !important;
                    grid-template-columns: 1fr !important;
                    width: 100% !important;
                    gap: 9px !important;
                }
                .taller-contactos a,
                .enlace-ficha-taller,
                .enlace-google-maps {
                    display: flex !important;
                    width: 100% !important;
                    min-height: 46px !important;
                    padding: 12px 14px !important;
                    white-space: normal !important;
                    overflow-wrap: anywhere;
                    font-size: 14px !important;
                }
            }
        `;
        document.head.appendChild(estilo);
    }

    function textoLimpio(elemento) {
        return String(elemento?.textContent || "").replace(/^⌖\s*/, "").replace(/\s+/g, " ").trim();
    }

    function crearParametrosFicha(tarjeta, nombre, ubicacion) {
        const parametros = new URLSearchParams();
        parametros.set("nombre", nombre);
        parametros.set("direccion", ubicacion);
        const telefono = tarjeta.querySelector('a[href^="tel:"]')?.getAttribute("href")?.replace(/^tel:/, "") || "";
        const web = [...tarjeta.querySelectorAll('a[href^="http"]')]
            .find((enlace) => !enlace.href.includes("google.com/maps"))?.href || "";
        const descripcion = textoLimpio(tarjeta.querySelector(".taller-descripcion"));
        const servicios = [...tarjeta.querySelectorAll(".especialidades span")]
            .map((elemento) => textoLimpio(elemento)).filter(Boolean).join("|");
        if (telefono) parametros.set("telefono", telefono);
        if (web) parametros.set("web", web);
        if (descripcion) parametros.set("descripcion", descripcion);
        if (servicios) parametros.set("servicios", servicios);
        return parametros;
    }

    function prepararTarjetasPublicas() {
        document.querySelectorAll(".taller-card").forEach((tarjeta) => {
            if (tarjeta.dataset.enlacesPreparados === "true") return;
            const nombre = textoLimpio(tarjeta.querySelector("h3"));
            const ubicacion = textoLimpio(tarjeta.querySelector("p.ubicacion"));
            if (!nombre) return;

            let pie = tarjeta.querySelector(".taller-contactos");
            if (!pie) {
                pie = document.createElement("span");
                pie.className = "taller-contactos";
                tarjeta.querySelector(".taller-pie")?.appendChild(pie);
            }
            if (!pie) return;

            const ficha = document.createElement("a");
            ficha.href = `pages/taller.html?${crearParametrosFicha(tarjeta, nombre, ubicacion).toString()}`;
            ficha.className = "enlace-ficha-taller";
            ficha.textContent = "Ver ficha";
            ficha.setAttribute("aria-label", `Ver ficha pública de ${nombre}`);
            pie.appendChild(ficha);

            if (ubicacion && ubicacion !== "Ubicación no indicada") {
                const consulta = [nombre, ubicacion, "España"].join(", ");
                const maps = document.createElement("a");
                maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
                maps.target = "_blank";
                maps.rel = "noopener noreferrer";
                maps.className = "enlace-google-maps";
                maps.textContent = "Abrir en Google Maps";
                maps.setAttribute("aria-label", `Abrir ${nombre} en Google Maps mediante su dirección`);
                pie.appendChild(maps);
            }
            tarjeta.dataset.enlacesPreparados = "true";
        });
    }

    function observarTarjetas() {
        const lista = document.getElementById("lista-talleres");
        if (!lista) return;
        prepararTarjetasPublicas();
        new MutationObserver(prepararTarjetasPublicas).observe(lista, { childList: true, subtree: true });
    }

    function inicializar() {
        cargarRecuperacionAdministrativa();
        rellenarSelect(document.getElementById("servicio"));
        rellenarCheckboxes(document.getElementById("lista-servicios-registro"));
        rellenarTarjetas(document.getElementById("lista-servicios-publicos"));
        retirarGeolocalizacionPublica();
        aplicarEstilosBotonesMoviles();
        observarTarjetas();
    }

    window.TallerMapServicios = { grupos, etiquetas, serviciosAlfabeticos, rellenarSelect, rellenarCheckboxes, rellenarTarjetas };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializar);
    else inicializar();
}());