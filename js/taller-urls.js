(function () {
    "use strict";

    const SITE_URL = "https://www.tallermap.es";
    const CLEAN_PREFIX = "/talleres/";
    const LEGACY_PATH = "/pages/taller.html";

    const NOMBRES_SERVICIOS = {
        "mecanica-general": "Mecánica general",
        "mantenimiento-programado": "Mantenimiento programado",
        "cambio-aceite-filtros": "Cambio de aceite y filtros",
        "pre-itv": "Pre-ITV",
        "frenos": "Frenos",
        "embrague": "Embrague",
        "correa-distribucion": "Correa de distribución",
        "sistema-refrigeracion": "Sistema de refrigeración",
        "escape-catalizador": "Escape y catalizador",
        "caja-cambios": "Caja de cambios",
        "neumaticos": "Neumáticos",
        "alineacion-direccion": "Alineación y dirección",
        "equilibrado-ruedas": "Equilibrado de ruedas",
        "suspension-amortiguadores": "Suspensión y amortiguadores",
        "direccion": "Dirección",
        "diagnosis-electronica": "Diagnosis electrónica",
        "electricidad-automovil": "Electricidad del automóvil",
        "baterias": "Baterías",
        "alternador-motor-arranque": "Alternador y motor de arranque",
        "centralitas-electronica": "Centralitas y electrónica",
        "sistemas-adas": "Sistemas ADAS",
        "tapiceria": "Tapicería",
        "chapa-pintura": "Chapa y pintura",
        "aire-acondicionado": "Aire acondicionado",
        "hibridos-electricos": "Híbridos y eléctricos"
    };

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function slugDesdeEnlace(enlace) {
        try {
            const url = new URL(enlace.href, window.location.origin);
            const parametro = url.searchParams.get("slug");
            if (parametro) return slugSeguro(parametro);
            if (url.pathname.startsWith(CLEAN_PREFIX)) {
                return slugSeguro(url.pathname.slice(CLEAN_PREFIX.length));
            }
        } catch (_error) {
            return "";
        }
        return "";
    }

    function urlLimpia(slug) {
        const limpio = slugSeguro(slug);
        return limpio ? `${CLEAN_PREFIX}${limpio}` : "";
    }

    function enlacesDeFicha(tarjeta) {
        return [...tarjeta.querySelectorAll("a")].filter((enlace) => {
            try {
                const url = new URL(enlace.href, window.location.origin);
                return url.pathname === LEGACY_PATH
                    || url.pathname.startsWith(CLEAN_PREFIX)
                    || enlace.classList.contains("enlace-ficha-taller");
            } catch (_error) {
                return false;
            }
        });
    }

    function limpiarEnlacesTarjeta(tarjeta) {
        if (!(tarjeta instanceof Element)) return;
        const enlaces = enlacesDeFicha(tarjeta);
        if (!enlaces.length) return;

        const slug = enlaces.map(slugDesdeEnlace).find(Boolean);
        if (!slug) return;

        const principal = enlaces.find((enlace) =>
            enlace.classList.contains("enlace-ficha-taller")
        ) || enlaces[0];
        const destino = urlLimpia(slug);

        if (principal.getAttribute("href") !== destino) principal.href = destino;
        principal.classList.add("enlace-ficha-taller");
        if (principal.textContent.trim() !== "Ver ficha") principal.textContent = "Ver ficha";

        enlaces.forEach((enlace) => {
            if (enlace !== principal && enlace.isConnected) enlace.remove();
        });
    }

    function procesarNodo(nodo) {
        if (!(nodo instanceof Element)) return;
        if (nodo.matches(".taller-card")) limpiarEnlacesTarjeta(nodo);
        nodo.querySelectorAll?.(".taller-card").forEach(limpiarEnlacesTarjeta);

        if (nodo.matches("a.taller-relacionado")) {
            const slug = slugDesdeEnlace(nodo);
            if (slug) nodo.href = urlLimpia(slug);
        }
        nodo.querySelectorAll?.("a.taller-relacionado").forEach((enlace) => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) enlace.href = urlLimpia(slug);
        });
    }

    function actualizarFichaUnaVez() {
        const ruta = window.location.pathname;
        const parametros = new URLSearchParams(window.location.search);
        const slug = ruta.startsWith(CLEAN_PREFIX)
            ? slugSeguro(ruta.slice(CLEAN_PREFIX.length))
            : slugSeguro(parametros.get("slug") || "");

        if (!slug) return;
        const limpia = urlLimpia(slug);
        const absoluta = `${SITE_URL}${limpia}`;

        if (ruta === LEGACY_PATH) {
            window.history.replaceState({}, "", limpia);
        }

        const canonical = document.getElementById("canonical-taller")
            || document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = absoluta;
    }

    function asegurarMeta(selector, atributos) {
        let elemento = document.head.querySelector(selector);
        if (!elemento) {
            elemento = document.createElement("meta");
            Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
            document.head.appendChild(elemento);
        }
        return elemento;
    }

    function valorDato(etiqueta) {
        const filas = document.querySelectorAll("#taller-datos p");
        for (const fila of filas) {
            const fuerte = fila.querySelector("strong");
            if (!fuerte) continue;
            if (fuerte.textContent.trim().toLowerCase() === `${etiqueta.toLowerCase()}:`) {
                return fila.textContent.replace(fuerte.textContent, "").trim();
            }
        }
        return "";
    }

    function nombreServicio(valor) {
        const original = String(valor || "").trim();
        if (!original) return "";
        const clave = slugSeguro(original);
        if (NOMBRES_SERVICIOS[clave]) return NOMBRES_SERVICIOS[clave];
        return original
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^./, (letra) => letra.toUpperCase());
    }

    function corregirPresentacionFicha() {
        const direccion = valorDato("Dirección");
        const codigoPostal = valorDato("Código postal");
        const ciudad = valorDato("Municipio");
        const provincia = valorDato("Provincia");
        const direccionVisible = [direccion, codigoPostal, ciudad, provincia]
            .map((valor) => String(valor || "").trim())
            .filter(Boolean)
            .filter((valor, indice, lista) => lista.findIndex((otro) => otro.toLowerCase() === valor.toLowerCase()) === indice)
            .join(", ");

        const elementoDireccion = document.getElementById("taller-direccion");
        if (elementoDireccion && direccionVisible && elementoDireccion.textContent.trim() !== direccionVisible) {
            elementoDireccion.textContent = direccionVisible;
        }

        document.querySelectorAll("#taller-servicios span").forEach((elemento) => {
            const legible = nombreServicio(elemento.textContent);
            if (legible && elemento.textContent.trim() !== legible) elemento.textContent = legible;
        });

        const botonWeb = document.querySelector("#taller-acciones a.accion-web");
        if (botonWeb) {
            botonWeb.classList.add("boton");
            botonWeb.classList.remove("boton-claro");
            if (botonWeb.textContent.trim() !== "Página web") botonWeb.textContent = "Página web";
        }
    }

    function actualizarDatosEstructurados() {
        corregirPresentacionFicha();

        const nombre = document.getElementById("taller-nombre")?.textContent.trim() || "";
        const descripcion = document.getElementById("taller-descripcion")?.textContent.trim() || "";
        const ciudad = valorDato("Municipio");
        const provincia = valorDato("Provincia");
        const codigoPostal = valorDato("Código postal");
        const direccion = valorDato("Dirección");
        const telefono = document.querySelector('#taller-datos a[href^="tel:"]')?.textContent.trim() || "";
        const web = document.querySelector('#taller-acciones a.accion-web')?.href || "";
        const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
        const servicios = [...document.querySelectorAll("#taller-servicios span")]
            .map((elemento) => elemento.textContent.trim())
            .filter(Boolean);

        const esFichaReal = Boolean(
            nombre
            && nombre !== "Ficha de taller"
            && nombre !== "Taller publicado en TallerMap"
            && ciudad
            && provincia
        );

        const robots = document.getElementById("robots-taller")
            || document.querySelector('meta[name="robots"]');
        if (robots) {
            robots.content = esFichaReal
                ? "index,follow,max-image-preview:large"
                : "noindex,follow";
        }

        if (!esFichaReal) return;

        const datos = {
            "@context": "https://schema.org",
            "@type": "AutoRepair",
            "@id": `${canonical}#negocio`,
            name: nombre,
            url: canonical,
            description: descripcion || `Información pública de ${nombre} en ${ciudad}.`,
            address: {
                "@type": "PostalAddress",
                streetAddress: direccion || undefined,
                postalCode: codigoPostal || undefined,
                addressLocality: ciudad,
                addressRegion: provincia,
                addressCountry: "ES"
            },
            telephone: telefono || undefined,
            sameAs: web ? [web] : undefined,
            areaServed: {
                "@type": "City",
                name: ciudad
            },
            serviceType: servicios.length ? servicios : undefined
        };

        const limpiar = (objeto) => {
            Object.keys(objeto).forEach((clave) => {
                const valor = objeto[clave];
                if (valor && typeof valor === "object" && !Array.isArray(valor)) limpiar(valor);
                if (valor === undefined || valor === "" || (Array.isArray(valor) && !valor.length)) {
                    delete objeto[clave];
                }
            });
            return objeto;
        };

        const scriptNegocio = document.getElementById("datos-estructurados-taller");
        if (scriptNegocio) scriptNegocio.textContent = JSON.stringify(limpiar(datos));

        const migas = [...document.querySelectorAll("#migas-pan a, #migas-pan span:not(.ficha-migas-separador)")]
            .map((elemento, indice) => ({
                "@type": "ListItem",
                position: indice + 1,
                name: elemento.textContent.trim(),
                item: elemento.tagName === "A" ? elemento.href : canonical
            }))
            .filter((elemento) => elemento.name);

        const scriptMigas = document.getElementById("datos-estructurados-migas");
        if (scriptMigas) {
            scriptMigas.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: migas
            });
        }

        const titulo = `${nombre} | Taller mecánico en ${ciudad}, ${provincia} | TallerMap`.slice(0, 68);
        const resumen = `Consulta teléfono, dirección, servicios y cómo llegar a ${nombre} en ${ciudad}, ${provincia}. Ficha actualizada en TallerMap.`.slice(0, 158);
        document.title = titulo;

        const metaDescripcion = document.querySelector('meta[name="description"]');
        if (metaDescripcion) metaDescripcion.content = resumen;

        const ogTitle = asegurarMeta('meta[property="og:title"]', { property: "og:title" });
        const ogDescription = asegurarMeta('meta[property="og:description"]', { property: "og:description" });
        const ogUrl = asegurarMeta('meta[property="og:url"]', { property: "og:url" });
        const ogType = asegurarMeta('meta[property="og:type"]', { property: "og:type" });
        const ogSite = asegurarMeta('meta[property="og:site_name"]', { property: "og:site_name" });
        const twitterCard = asegurarMeta('meta[name="twitter:card"]', { name: "twitter:card" });
        const twitterTitle = asegurarMeta('meta[name="twitter:title"]', { name: "twitter:title" });
        const twitterDescription = asegurarMeta('meta[name="twitter:description"]', { name: "twitter:description" });

        ogTitle.content = titulo;
        ogDescription.content = resumen;
        ogUrl.content = canonical;
        ogType.content = "website";
        ogSite.content = "TallerMap";
        twitterCard.content = "summary";
        twitterTitle.content = titulo;
        twitterDescription.content = resumen;
    }

    function programarSEO() {
        window.clearTimeout(programarSEO.temporizador);
        programarSEO.temporizador = window.setTimeout(actualizarDatosEstructurados, 120);
    }

    function iniciar() {
        document.querySelectorAll(".taller-card").forEach(limpiarEnlacesTarjeta);
        document.querySelectorAll("a.taller-relacionado").forEach((enlace) => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) enlace.href = urlLimpia(slug);
        });
        actualizarFichaUnaVez();
        programarSEO();

        const raiz = document.body;
        if (!raiz) return;
        new MutationObserver((cambios) => {
            cambios.forEach((cambio) => {
                cambio.addedNodes.forEach(procesarNodo);
            });
            programarSEO();
        }).observe(raiz, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["href", "content"]
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());