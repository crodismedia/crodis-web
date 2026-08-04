(function () {
    "use strict";

    const grupos = [
        { nombre: "Mecánica y mantenimiento", servicios: [["mecanica-general","Mecánica general"],["mantenimiento-programado","Revisión y mantenimiento programado"],["cambio-aceite-filtros","Cambio de aceite y filtros"],["pre-itv","Revisión Pre-ITV"],["frenos","Frenos"],["embrague","Embrague"],["correa-distribucion","Correa de distribución"],["cadena-distribucion","Cadena de distribución"],["reparacion-motor","Reparación de motor"],["sistema-refrigeracion","Sistema de refrigeración"],["escape-catalizador","Escape y catalizador"],["caja-cambios","Caja de cambios"]] },
        { nombre: "Neumáticos, dirección y suspensión", servicios: [["neumaticos","Neumáticos"],["alineacion-direccion","Alineación y dirección"],["equilibrado-ruedas","Equilibrado de ruedas"],["suspension-amortiguadores","Suspensión y amortiguadores"],["direccion","Sistema de dirección"]] },
        { nombre: "Electricidad y diagnosis", servicios: [["diagnosis-electronica","Diagnosis electrónica"],["electricidad-automovil","Electricidad del automóvil"],["baterias","Baterías"],["alternador-motor-arranque","Alternador y motor de arranque"],["centralitas-electronica","Centralitas y electrónica"],["sistemas-adas","Sistemas ADAS y ayudas a la conducción"],["llaves-codificacion","Llaves y codificación"]] },
        { nombre: "Carrocería y cristales", servicios: [["chapa-pintura","Chapa y pintura"],["carroceria","Reparación de carrocería"],["lunas-cristales","Lunas y cristales"],["desabollado-sin-pintura","Desabollado sin pintura"],["tapiceria","Tapicería"]] },
        { nombre: "Climatización", servicios: [["aire-acondicionado","Aire acondicionado"],["calefaccion-climatizacion","Calefacción y climatización"]] },
        { nombre: "Híbridos y eléctricos", servicios: [["hibridos-electricos","Vehículos híbridos y eléctricos"],["baterias-alta-tension","Baterías de alta tensión"],["cargadores-vehiculo-electrico","Cargadores para vehículo eléctrico"]] },
        { nombre: "Vehículos especiales", servicios: [["furgonetas","Furgonetas"],["vehiculos-industriales","Vehículos industriales"],["autocaravanas","Autocaravanas"],["vehiculos-4x4","Vehículos 4x4"]] },
        { nombre: "Personalización y multimedia", servicios: [["equipos-sonido","Equipos de sonido y audio para automóvil"],["multimedia-navegacion","Pantallas, multimedia y navegación"],["vinilos-rotulacion","Vinilos y rotulación"],["wrapping","Wrapping integral y cambio de color"],["tuning-personalizacion","Tuning y personalización"],["iluminacion-automovil","Iluminación y sistemas LED"]] },
        { nombre: "Otros servicios", servicios: [["grua-asistencia","Grúa y asistencia en carretera"],["lavado-detailing","Lavado y detailing"],["montaje-accesorios","Montaje de accesorios"],["homologaciones","Homologaciones"],["instalacion-glp","Instalación y mantenimiento GLP"]] }
    ];

    const etiquetas = Object.fromEntries(grupos.flatMap((grupo) => grupo.servicios));
    const iconos = {"Mecánica y mantenimiento":"⚙","Neumáticos, dirección y suspensión":"◉","Electricidad y diagnosis":"⚡","Carrocería y cristales":"✦","Climatización":"❄","Híbridos y eléctricos":"▣","Vehículos especiales":"▤","Personalización y multimedia":"♫","Otros servicios":"+"};

    function rutaDesdeRaiz(ruta) {
        return ruta.startsWith("/") ? ruta : `/${ruta}`;
    }

    function serviciosAlfabeticos() {
        return grupos.flatMap((grupo) => grupo.servicios.map(([valor, etiqueta]) => ({ valor, etiqueta, grupo: grupo.nombre })))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" }));
    }

    function rellenarSelect(select) {
        if (!select) return;
        select.replaceChildren();
        select.appendChild(new Option("Todos los servicios", ""));
        grupos.forEach((grupo) => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = grupo.nombre;
            grupo.servicios.forEach(([valor, etiqueta]) => optgroup.appendChild(new Option(etiqueta, valor)));
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
        if (!document.getElementById("formulario-buscador-internet") || document.querySelector("script[data-tallermap-admin-recuperacion]")) return;
        const script = document.createElement("script");
        script.src = rutaDesdeRaiz("js/admin-recuperacion.js");
        script.dataset.tallermapAdminRecuperacion = "true";
        document.head.appendChild(script);
    }

    function mejorarPortadaInicial() {
        document.querySelector(".franja-reloj")?.remove();
        document.getElementById("usar-mi-ubicacion")?.remove();
        document.getElementById("estado-ubicacion")?.remove();
        const titulo = document.querySelector(".hero-texto h1");
        if (titulo) titulo.innerHTML = "Encuentra talleres mecánicos <span>cerca de ti</span>";
        const ayuda = document.querySelector(".tarjeta-flotante span");
        if (ayuda) ayuda.textContent = "Busca por dirección, población o código postal";
        const mensaje = document.querySelector("#lista-talleres .mensaje-talleres");
        if (mensaje && /cargando/i.test(mensaje.textContent || "")) {
            mensaje.textContent = "Consulta talleres publicados por población, código postal o servicio. Los resultados se actualizan automáticamente.";
        }
    }

    function cargarEstilosAccionesTaller() {
        if (document.querySelector('link[data-tallermap-acciones]')) return;
        const enlace = document.createElement("link");
        enlace.rel = "stylesheet";
        enlace.href = rutaDesdeRaiz("css/taller-acciones.css");
        enlace.dataset.tallermapAcciones = "true";
        document.head.appendChild(enlace);
    }

    function cargarUrlsLimpiasTaller() {
        if (document.querySelector('script[data-tallermap-urls-taller]')) return;
        const script = document.createElement("script");
        script.src = rutaDesdeRaiz("js/taller-urls.js");
        script.defer = true;
        script.dataset.tallermapUrlsTaller = "true";
        document.head.appendChild(script);
    }

    function textoLimpio(elemento) {
        return String(elemento?.textContent || "").replace(/^⌖\s*/, "").replace(/\s+/g, " ").trim();
    }

    function esEnlaceFicha(enlace) {
        if (!(enlace instanceof HTMLAnchorElement)) return false;
        try {
            const url = new URL(enlace.href, window.location.origin);
            return url.pathname === "/pages/taller.html" || url.pathname.startsWith("/talleres/") || enlace.classList.contains("enlace-ficha-taller");
        } catch (_error) {
            return false;
        }
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

            const enlacesFicha = [...pie.querySelectorAll("a")].filter(esEnlaceFicha);
            if (enlacesFicha.length) {
                const principal = enlacesFicha.find((enlace) => enlace.classList.contains("enlace-ficha-taller")) || enlacesFicha[0];
                principal.classList.add("enlace-ficha-taller");
                principal.textContent = "Ver ficha";
                principal.setAttribute("aria-label", `Ver ficha pública de ${nombre}`);
                enlacesFicha.forEach((enlace) => {
                    if (enlace !== principal) enlace.remove();
                });
            }

            const yaTieneMaps = [...pie.querySelectorAll("a")].some((enlace) => {
                try {
                    return new URL(enlace.href).hostname.includes("google.com");
                } catch (_error) {
                    return false;
                }
            });

            if (!yaTieneMaps && ubicacion && ubicacion !== "Ubicación no indicada") {
                const maps = document.createElement("a");
                maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nombre}, ${ubicacion}, España`)}`;
                maps.target = "_blank";
                maps.rel = "noopener noreferrer";
                maps.className = "enlace-google-maps";
                maps.textContent = "Abrir en Google Maps";
                pie.appendChild(maps);
            }

            tarjeta.dataset.enlacesPreparados = "true";
        });
    }

    function observarTarjetas() {
        const lista = document.getElementById("lista-talleres");
        if (!lista) return;
        prepararTarjetasPublicas();
        const observer = new MutationObserver((mutaciones) => {
            const hayNuevasTarjetas = mutaciones.some((mutacion) => [...mutacion.addedNodes].some((nodo) =>
                nodo.nodeType === Node.ELEMENT_NODE && (nodo.matches?.(".taller-card") || nodo.querySelector?.(".taller-card"))
            ));
            if (hayNuevasTarjetas) prepararTarjetasPublicas();
        });
        observer.observe(lista, { childList: true, subtree: true });
    }

    function inicializar() {
        cargarRecuperacionAdministrativa();
        rellenarSelect(document.getElementById("servicio"));
        rellenarCheckboxes(document.getElementById("lista-servicios-registro"));
        rellenarTarjetas(document.getElementById("lista-servicios-publicos"));
        mejorarPortadaInicial();
        cargarEstilosAccionesTaller();
        cargarUrlsLimpiasTaller();
        observarTarjetas();
    }

    window.TallerMapServicios = { grupos, etiquetas, serviciosAlfabeticos, rellenarSelect, rellenarCheckboxes, rellenarTarjetas };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar, { once: true });
    } else {
        inicializar();
    }
}());
