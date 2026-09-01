(() => {
    "use strict";

    // ============ CONFIGURACIÓN ============
    const CONFIG = {
        SITE_URL: "https://www.tallermap.es",
        CLEAN_PREFIX: "/talleres/",
        DEBUG: false // Cambiar a true para ver logs
    };

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

    // ============ UTILIDADES ============
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[SEO TallerMap]", ...args);
        }
    }

    function slugSeguro(valor) {
        if (!valor) return "";
        return String(valor)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function urlLimpia(slug) {
        const limpio = slugSeguro(slug);
        return limpio ? ${CONFIG.CLEAN_PREFIX}${limpio} : "";
    }

    // ============ EXTRACCIÓN DE DATOS ============
    function extraerDato(etiqueta) {
        const filas = document.querySelectorAll("#taller-datos p, .taller-datos p");
        for (const fila of filas) {
            const fuerte = fila.querySelector("strong");
            if (!fuerte) continue;
            const textoFuerte = fuerte.textContent.trim().toLowerCase().replace(":", "");
            if (textoFuerte === etiqueta.toLowerCase()) {
                return fila.textContent.replace(fuerte.textContent, "").trim();
            }
        }
        return "";
    }

    function extraerDatosFicha() {
        // Intentar múltiples selectores para ser robusto
        const nombre = document.querySelector("#taller-nombre, .taller-nombre, .ficha-taller h1, .taller-titulo")?.textContent?.trim() || "";
        
        const datos = {
            nombre: nombre,
            direccion: extraerDato("Dirección") || extraerDato("Direccion"),
            ciudad: extraerDato("Municipio") || extraerDato("Ciudad") || extraerDato("Población"),
            provincia: extraerDato("Provincia"),
            codigoPostal: extraerDato("Código postal") || extraerDato("Codigo postal") || extraerDato("CP"),
            telefono: document.querySelector('#taller-datos a[href^="tel:"], .taller-datos a[href^="tel:"]')?.textContent?.trim() || "",
            web: document.querySelector('#taller-acciones a.accion-web, .taller-acciones a[href^="http"]')?.href || "",
            descripcion: document.querySelector("#taller-descripcion, .taller-descripcion, .ficha-descripcion")?.textContent?.trim() || "",
            servicios: [...document.querySelectorAll("#taller-servicios span, .taller-servicios span, .servicios-taller span")].map(el => el.textContent.trim()).filter(Boolean)
        };

        // Si no hay ciudad, intentar extraer de la dirección
        if (!datos.ciudad && datos.direccion) {
            const partes = datos.direccion.split(",").map(p => p.trim());
            if (partes.length > 1) {
                datos.ciudad = partes[partes.length - 1];
            }
        }

        log("Datos extraídos:", datos);
        return datos;
    }

    // ============ SEO Y METADATOS ============
    function asegurarMeta(selector, atributos) {
        let elemento = document.head.querySelector(selector);
        if (!elemento) {
            elemento = document.createElement("meta");
            Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
            document.head.appendChild(elemento);
            log(Meta creado: ${selector});
        }
        return elemento;
    }

    function actualizarRobots(esFichaReal) {
        const robots = document.querySelector('meta[name="robots"]');
        if (robots) {
            const content = esFichaReal ? "index,follow,max-image-preview:large" : "noindex,follow";
            robots.content = content;
            log(Robots actualizado: ${content});
            return;
        }

        // Crear meta robots si no existe
        const meta = document.createElement("meta");
        meta.name = "robots";
        meta.content = esFichaReal ? "index,follow,max-image-preview:large" : "noindex,follow";
        document.head.appendChild(meta);
        log("Meta robots creado");
    }

    function actualizarCanonical() {
        const ruta = window.location.pathname;
        const slug = extraerSlugDeURL();
        
        if (!slug) return;
        
        const limpia = urlLimpia(slug);
        const absoluta = ${CONFIG.SITE_URL}${limpia};

        // Actualizar canonical
        const canonical = document.querySelector('link[rel="canonical"]') || 
                         document.getElementById("canonical-taller");
        
        if (canonical) {
            canonical.href = absoluta;
            log(Canonical actualizado: ${absoluta});
        } else {
            // Crear canonical si no existe
            const link = document.createElement("link");
            link.rel = "canonical";
            link.href = absoluta;
            document.head.appendChild(link);
            log(Canonical creado: ${absoluta});
        }
    }

    function extraerSlugDeURL() {
        const ruta = window.location.pathname;
        const parametros = new URLSearchParams(window.location.search);
        
        // Intentar obtener slug de diferentes fuentes
        let slug = "";
        
        // 1. De la ruta limpia
        if (ruta.startsWith(CONFIG.CLEAN_PREFIX) && ruta !== CONFIG.CLEAN_PREFIX) {
            const posibleSlug = ruta.slice(CONFIG.CLEAN_PREFIX.length).split("/")[0];
            if (posibleSlug) slug = slugSeguro(posibleSlug);
        }
        
        // 2. De parámetros
        if (!slug) {
            slug = slugSeguro(parametros.get("slug") || "");
        }
        
        // 3. De data attribute en la página
        if (!slug) {
            const dataSlug = document.querySelector('[data-taller-slug]')?.getAttribute('data-taller-slug');
            if (dataSlug) slug = slugSeguro(dataSlug);
        }
        
        // 4. Intentar extraer del título o nombre
        if (!slug) {
            const nombre = document.querySelector("#taller-nombre, .taller-nombre, h1")?.textContent?.trim();
            if (nombre) slug = slugSeguro(nombre);
        }
        
        log(Slug extraído: "${slug}" de ruta: ${ruta});
        return slug;
    }

    // ============ DATOS ESTRUCTURADOS (Schema.org) ============
    function actualizarDatosEstructurados() {
        const datos = extraerDatosFicha();
        
        // Determinar si es una ficha real
        const esFichaReal = Boolean(
            datos.nombre && 
            datos.nombre !== "Ficha de taller" &&
            datos.nombre !== "Taller publicado en TallerMap" &&
            datos.nombre.length > 2 &&
            datos.ciudad &&
            datos.provincia
        );

        log("¿Es ficha real?", esFichaReal, datos);

        // 1. Actualizar robots
        actualizarRobots(esFichaReal);

        // 2. Actualizar canonical
        actualizarCanonical();

        // Si no es ficha real, no continuar con el resto
        if (!esFichaReal) {
            log("No es una ficha real, omitiendo datos estructurados");
            return;
        }

        // 3. Actualizar título y descripción
        const titulo = ${datos.nombre} | Taller mecánico en ${datos.ciudad}, ${datos.provincia} | TallerMap;
        const resumen = Consulta teléfono, dirección, servicios y cómo llegar a ${datos.nombre} en ${datos.ciudad}, ${datos.provincia}. Ficha actualizada en TallerMap.;
        
        document.title = titulo;
        
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = resumen;
        } else {
            const meta = document.createElement("meta");
            meta.name = "description";
            meta.content = resumen;
            document.head.appendChild(meta);
        }

        // 4. Actualizar Open Graph
        const ogData = {
            "og:title": titulo,
            "og:description": resumen,
            "og:url": document.querySelector('link[rel="canonical"]')?.href || window.location.href,
            "og:type": "website",
            "og:site_name": "TallerMap"
        };

        Object.entries(ogData).forEach(([prop, content]) => {
            const meta = asegurarMeta(meta[property="${prop}"], { property: prop });
            meta.content = content;
        });

        // 5. Twitter Card
        const twitterData = {
            "twitter:card": "summary",
            "twitter:title": titulo,
            "twitter:description": resumen
        };

        Object.entries(twitterData).forEach(([name, content]) => {
            const meta = asegurarMeta(meta[name="${name}"], { name });
            meta.content = content;
        });

        // 6. Datos estructurados - Negocio
        const schemaNegocio = {
            "@context": "https://schema.org",
            "@type": "AutoRepair",
            "@id": ${document.querySelector('link[rel="canonical"]')?.href || window.location.href}#negocio,
            "name": datos.nombre,
            "url": document.querySelector('link[rel="canonical"]')?.href || window.location.href,
            "description": datos.descripcion || Información pública de ${datos.nombre} en ${datos.ciudad}.,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": datos.direccion || undefined,
                "postalCode": datos.codigoPostal || undefined,
                "addressLocality": datos.ciudad,
                "addressRegion": datos.provincia,
                "addressCountry": "ES"
            },
            "telephone": datos.telefono || undefined,
            "sameAs": datos.web ? [datos.web] : undefined,
            "areaServed": {
                "@type": "City",
                "name": datos.ciudad
            }
        };

        // Añadir servicios si existen
        if (datos.servicios && datos.servicios.length > 0) {
            schemaNegocio.serviceType = datos.servicios;
        }

        // Limpiar undefined
        const limpiarSchema = (obj) => {
            Object.keys(obj).forEach(key => {
                if (obj[key] === undefined || obj[key] === null || obj[key] === "") {
                    delete obj[key];
                } else if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
                    limpiarSchema(obj[key]);
                }
            });
            return obj;
        };

        const schemaLimpio = limpiarSchema(schemaNegocio);

        // Actualizar script de negocio
        let scriptNegocio = document.getElementById("datos-estructurados-taller");
        if (!scriptNegocio) {
            scriptNegocio = document.createElement("script");
            scriptNegocio.id = "datos-estructurados-taller";
            scriptNegocio.type = "application/ld+json";
            document.head.appendChild(scriptNegocio);
        }
        scriptNegocio.textContent = JSON.stringify(schemaLimpio);
        log("Schema negocio actualizado");

        // 7. Migas de pan
        const migasItems = [
            { name: "Inicio", item: CONFIG.SITE_URL },
            { name: "Talleres", item: ${CONFIG.SITE_URL}${CONFIG.CLEAN_PREFIX} },
            { name: datos.nombre, item: document.querySelector('link[rel="canonical"]')?.href || window.location.href }
        ];

        const schemaMigas = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": migasItems.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "item": item.item
            }))
        };

        let scriptMigas = document.getElementById("datos-estructurados-migas");
        if (!scriptMigas) {
            scriptMigas = document.createElement("script");
            scriptMigas.id = "datos-estructurados-migas";
            scriptMigas.type = "application/ld+json";
            document.head.appendChild(scriptMigas);
        }
        scriptMigas.textContent = JSON.stringify(schemaMigas);
        log("Schema migas actualizado");
    }

    // ============ LIMPIEZA DE ENLACES ============
    function slugDesdeEnlace(enlace) {
        try {
            const url = new URL(enlace.href, window.location.origin);
            const slug = url.searchParams.get("slug") || 
                        url.pathname.split(CONFIG.CLEAN_PREFIX).pop() || 
                        "";
            return slugSeguro(slug);
        } catch (_error) {
            return "";
        }
    }

    function limpiarEnlacesTarjeta(tarjeta) {
        if (!(tarjeta instanceof Element)) return;
        
        const enlaces = [...tarjeta.querySelectorAll("a")].filter(enlace => {
            try {
                const url = new URL(enlace.href, window.location.origin);
                return url.pathname.includes(CONFIG.CLEAN_PREFIX) || 
                       enlace.classList.contains("enlace-ficha-taller");
            } catch (_error) {
                return false;
            }
        });

        if (!enlaces.length) return;

        const slug = enlaces.map(slugDesdeEnlace).find(Boolean);
        if (!slug) return;

        const principal = enlaces.find(el => el.classList.contains("enlace-ficha-taller")) || enlaces[0];
        const destino = urlLimpia(slug);
        
        if (principal.getAttribute("href") !== destino) {
            principal.href = destino;
            log(Enlace actualizado: ${destino});
        }

        principal.classList.add("enlace-ficha-taller");
        principal.setAttribute("data-slug", slug);

        if (!principal.getAttribute("aria-label")) {
            const nombre = principal.textContent.trim() || 
                          tarjeta.querySelector(".taller-titulo, h3")?.textContent?.trim() || 
                          "taller";
            principal.setAttribute("aria-label", Ver ficha de ${nombre});
        }

        // Eliminar enlaces duplicados
        enlaces.forEach(enlace => {
            if (enlace !== principal && enlace.isConnected) {
                enlace.remove();
            }
        });
    }

    // ============ INICIALIZACIÓN ============
    function inicializar() {
        log("Iniciando SEO TallerMap...");

        // Limpiar enlaces de tarjetas existentes
        document.querySelectorAll(".taller-card, .taller-item, .card-taller").forEach(limpiarEnlacesTarjeta);

        // Actualizar enlaces relacionados
        document.querySelectorAll("a.taller-relacionado, a.taller-enlace").forEach(enlace => {
            const slug = slugDesdeEnlace(enlace);
            if (slug) {
                enlace.href = urlLimpia(slug);
                enlace.setAttribute("data-slug", slug);
            }
        });

        // Actualizar datos SEO
        setTimeout(() => {
            actualizarDatosEstructurados();
        }, 100);

        // Observar cambios dinámicos
        const observer = new MutationObserver((mutations) => {
            let necesitaActualizar = false;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        if (node.matches(".taller-card, .taller-item, .card-taller")) {
                            limpiarEnlacesTarjeta(node);
                            necesitaActualizar = true;
                        }
                        node.querySelectorAll?.(".taller-card, .taller-item, .card-taller").forEach(limpiarEnlacesTarjeta);
                    }
                });
            });

            if (necesitaActualizar) {
                setTimeout(actualizarDatosEstructurados, 200);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        log("SEO TallerMap inicializado correctamente");
    }

    // ============ EJECUCIÓN ============
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar, { once: true });
    } else {
        inicializar();
    }
})();
