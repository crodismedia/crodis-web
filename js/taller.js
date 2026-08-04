(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const SITE_URL = "https://www.tallermap.es";

    const parametros = new URLSearchParams(window.location.search);
    const leer = (clave) => String(parametros.get(clave) || "").trim();
    const id = leer("id");
    const slug = leer("slug");

    const cliente = window.supabase?.createClient
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

    function datosLegados() {
        return {
            id,
            slug,
            nombre: leer("nombre") || "Taller publicado en TallerMap",
            direccionCompleta: leer("direccion"),
            direccion: leer("direccion"),
            codigo_postal: leer("codigo_postal"),
            ciudad: leer("ciudad"),
            provincia: leer("provincia"),
            telefono: leer("telefono").replace(/[^\d+]/g, ""),
            web: leer("web"),
            descripcion: leer("descripcion")
                || "Consulta los datos públicos disponibles de este taller.",
            servicios: leer("servicios")
                .split("|")
                .map((valor) => valor.trim())
                .filter(Boolean),
            verificado: ["1", "true", "si", "sí"]
                .includes(leer("verificado").toLowerCase()),
            updated_at: leer("actualizado"),
            fotos: [],
            horarios: null
        };
    }

    function texto(idElemento, valor) {
        const elemento = document.getElementById(idElemento);
        if (elemento) elemento.textContent = valor;
    }

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor == null ? "" : String(valor);
        return elemento.innerHTML;
    }

    function urlSegura(valor) {
        if (!valor) return "";

        try {
            const url = new URL(String(valor));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function fechaLegible(valor) {
        if (!valor) return "";

        const fecha = new Date(valor);

        if (Number.isNaN(fecha.getTime())) {
            return String(valor).slice(0, 40);
        }

        return new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(fecha);
    }

    function direccionCompleta(taller) {
        if (taller.direccionCompleta) return taller.direccionCompleta;

        return [
            taller.direccion,
            taller.codigo_postal,
            taller.ciudad,
            taller.provincia
        ]
            .filter(Boolean)
            .join(", ");
    }

    function normalizarTelefono(valor) {
        const original = String(valor || "").trim();
        const digitos = original.replace(/\D/g, "");

        if (/^34\d{9}$/.test(digitos)) return `+${digitos}`;
        if (/^\d{9}$/.test(digitos)) return `+34${digitos}`;

        return original.replace(/[^\d+]/g, "");
    }

    function telefonoWhatsApp(valor) {
        const digitos = String(valor || "").replace(/\D/g, "");

        if (/^[67]\d{8}$/.test(digitos)) return `34${digitos}`;
        if (/^34[67]\d{8}$/.test(digitos)) return digitos;

        return "";
    }

    function idValido(valor) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(valor);
    }

    function parametrosRpc(taller) {
        return {
            p_id: idValido(String(taller.id || id || ""))
                ? String(taller.id || id)
                : null,
            p_slug: String(taller.slug || slug || "").trim() || null
        };
    }

    function registrarAccion(tipo, taller) {
        const detalle = {
            tipo,
            taller_id: taller.id || id || null,
            taller_slug: taller.slug || slug || null,
            taller_nombre: taller.nombre || "Taller",
            pagina: window.location.pathname
        };

        if (typeof window.gtag === "function") {
            window.gtag("event", "contacto_taller", {
                metodo: tipo,
                taller_id:
                    detalle.taller_id
                    || detalle.taller_slug
                    || detalle.taller_nombre,
                taller_nombre: detalle.taller_nombre
            });
        }

        window.dispatchEvent(
            new CustomEvent("tallermap:contacto", { detail: detalle })
        );
    }

    function crearAccion({
        clase,
        href,
        etiqueta,
        aria,
        tipo,
        taller,
        nuevaPestana = false
    }) {
        const enlace = document.createElement("a");

        enlace.className = clase;
        enlace.href = href;
        enlace.textContent = etiqueta;
        enlace.setAttribute("aria-label", aria || etiqueta);
        enlace.dataset.accion = tipo;

        if (nuevaPestana) {
            enlace.target = "_blank";
            enlace.rel = "noopener noreferrer";
        }

        enlace.addEventListener(
            "click",
            () => registrarAccion(tipo, taller),
            { passive: true }
        );

        return enlace;
    }

    async function obtenerTaller() {
        const legado = datosLegados();

        if (!cliente || (!id && !slug)) return legado;

        const { data, error } = await cliente.rpc(
            "obtener_taller_publico",
            {
                p_id: idValido(id) ? id : null,
                p_slug: slug || null
            }
        );

        if (error || !Array.isArray(data) || !data.length) {
            if (error) {
                console.warn(
                    "La ficha usa temporalmente los datos compatibles del enlace:",
                    error.message
                );
            }
            return legado;
        }

        return { ...legado, ...data[0] };
    }

    async function obtenerContexto(taller) {
        if (!cliente) return null;

        const { data, error } = await cliente.rpc(
            "obtener_contexto_taller",
            parametrosRpc(taller)
        );

        if (error) {
            console.warn("No se pudo obtener el contexto local:", error.message);
            return null;
        }

        return Array.isArray(data) && data.length ? data[0] : null;
    }

    async function obtenerRelacionados(taller) {
        if (!cliente) return [];

        const { data, error } = await cliente.rpc(
            "buscar_talleres_relacionados",
            {
                ...parametrosRpc(taller),
                p_limite: 6
            }
        );

        if (error) {
            console.warn("No se pudieron obtener talleres relacionados:", error.message);
            return [];
        }

        return Array.isArray(data) ? data : [];
    }

    async function urlFoto(taller) {
        const primera = Array.isArray(taller.fotos) ? taller.fotos[0] : "";
        const publica = urlSegura(primera);

        if (publica) return publica;
        if (!primera || !cliente?.storage?.from) return "";

        const { data, error } = await cliente
            .storage
            .from("fotos-talleres")
            .createSignedUrl(primera, 3600);

        return error ? "" : (data?.signedUrl || data?.signedURL || "");
    }

    function actualizarCorreo(idElemento, asunto, cuerpo) {
        const enlace = document.getElementById(idElemento);
        if (!enlace) return;

        enlace.href =
            `mailto:info@tallermap.es`
            + `?subject=${encodeURIComponent(asunto)}`
            + `&body=${encodeURIComponent(cuerpo)}`;
    }

    function obtenerTurnos(valor) {
        if (!valor || valor.cerrado || !Array.isArray(valor.turnos)) return [];

        return valor.turnos.filter((turno) => {
            return turno && turno.apertura && turno.cierre;
        });
    }

    function horarioHTML(horarios) {
        if (!horarios || typeof horarios !== "object") return "";

        const dias = [
            ["lunes", "Lunes"],
            ["martes", "Martes"],
            ["miercoles", "Miércoles"],
            ["jueves", "Jueves"],
            ["viernes", "Viernes"],
            ["sabado", "Sábado"],
            ["domingo", "Domingo"]
        ];

        const filas = dias
            .map(([clave, etiqueta]) => {
                const valor = horarios[clave];
                if (!valor) return "";

                const horario = valor.cerrado
                    ? "Cerrado"
                    : obtenerTurnos(valor)
                        .map((turno) => `${turno.apertura}–${turno.cierre}`)
                        .join(" y ");

                if (!horario) return "";

                return `
                    <div>
                        <dt>${escaparHTML(etiqueta)}</dt>
                        <dd>${escaparHTML(horario)}</dd>
                    </div>
                `;
            })
            .filter(Boolean)
            .join("");

        return filas
            ? `<details class="taller-horario">
                    <summary>Ver horario semanal</summary>
                    <dl>${filas}</dl>
               </details>`
            : "";
    }

    function generarOpeningHoursSpecification(horarios) {
        if (!horarios || typeof horarios !== "object") return [];

        const dias = [
            ["lunes", "Monday"],
            ["martes", "Tuesday"],
            ["miercoles", "Wednesday"],
            ["jueves", "Thursday"],
            ["viernes", "Friday"],
            ["sabado", "Saturday"],
            ["domingo", "Sunday"]
        ];

        const resultado = [];

        dias.forEach(([clave, diaSchema]) => {
            const valor = horarios[clave];
            if (!valor || valor.cerrado) return;

            obtenerTurnos(valor).forEach((turno) => {
                resultado.push({
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: `https://schema.org/${diaSchema}`,
                    opens: turno.apertura,
                    closes: turno.cierre
                });
            });
        });

        return resultado;
    }

    function construirDireccionSchema(taller) {
        const direccion = {
            "@type": "PostalAddress",
            addressCountry: "ES"
        };

        if (taller.direccion) direccion.streetAddress = taller.direccion;
        if (taller.ciudad) direccion.addressLocality = taller.ciudad;
        if (taller.provincia) direccion.addressRegion = taller.provincia;
        if (taller.codigo_postal) direccion.postalCode = taller.codigo_postal;

        return (
            direccion.streetAddress
            || direccion.addressLocality
            || direccion.addressRegion
            || direccion.postalCode
        )
            ? direccion
            : null;
    }

    function construirDatosEstructurados({
        taller,
        nombre,
        descripcion,
        urlFicha,
        telefono,
        web,
        servicios,
        actualizacion,
        foto
    }) {
        const estructurados = {
            "@context": "https://schema.org",
            "@type": "AutoRepair",
            "@id": `${urlFicha}#taller`,
            name: nombre,
            description: descripcion,
            url: urlFicha,
            mainEntityOfPage: urlFicha
        };

        const direccionSchema = construirDireccionSchema(taller);
        if (direccionSchema) estructurados.address = direccionSchema;
        if (telefono) estructurados.telephone = normalizarTelefono(telefono);
        if (web) estructurados.sameAs = [web];
        if (foto) estructurados.image = [foto];
        if (servicios.length) estructurados.knowsAbout = servicios;
        if (actualizacion) {
            estructurados.dateModified = String(actualizacion).slice(0, 10);
        }

        if (taller.ciudad || taller.provincia) {
            estructurados.areaServed = {
                "@type": "AdministrativeArea",
                name: [taller.ciudad, taller.provincia, "España"]
                    .filter(Boolean)
                    .join(", ")
            };
        }

        const horarios = generarOpeningHoursSpecification(taller.horarios);
        if (horarios.length) estructurados.openingHoursSpecification = horarios;

        return estructurados;
    }

    function urlProvincia(provincia, contexto) {
        const slugProvincia =
            contexto?.provincia_slug
            || slugSeguro(provincia);

        return slugProvincia
            ? `${SITE_URL}/provincias/${slugProvincia}.html`
            : `${SITE_URL}/provincias/`;
    }

    function urlMunicipio(taller, contexto) {
        if (contexto?.codigo_municipal && contexto?.municipio) {
            return (
                `${SITE_URL}/municipios/`
                + `${slugSeguro(contexto.municipio)}-`
                + `${contexto.codigo_municipal}.html`
            );
        }

        return (
            `${SITE_URL}/index.html`
            + `?ubicacion=${encodeURIComponent(taller.ciudad || "")}`
            + "#talleres"
        );
    }

    function actualizarMigas(taller, contexto, nombre) {
        const nav = document.getElementById("migas-pan");
        if (!nav) return;

        const elementos = [
            { nombre: "Inicio", url: `${SITE_URL}/` }
        ];

        if (taller.provincia) {
            elementos.push({
                nombre: taller.provincia,
                url: urlProvincia(taller.provincia, contexto)
            });
        }

        if (taller.ciudad) {
            elementos.push({
                nombre: taller.ciudad,
                url: urlMunicipio(taller, contexto)
            });
        }

        elementos.push({ nombre, url: "" });

        nav.replaceChildren();

        elementos.forEach((elemento, indice) => {
            if (indice > 0) {
                const separador = document.createElement("span");
                separador.className = "ficha-migas-separador";
                separador.setAttribute("aria-hidden", "true");
                separador.textContent = "›";
                nav.appendChild(separador);
            }

            if (elemento.url) {
                const enlace = document.createElement("a");
                enlace.href = elemento.url;
                enlace.textContent = elemento.nombre;
                nav.appendChild(enlace);
            } else {
                const actual = document.createElement("span");
                actual.textContent = elemento.nombre;
                actual.setAttribute("aria-current", "page");
                nav.appendChild(actual);
            }
        });

        const breadcrumbSchema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: elementos.map((elemento, indice) => ({
                "@type": "ListItem",
                position: indice + 1,
                name: elemento.nombre,
                item: elemento.url || window.location.href.split("#")[0]
            }))
        };

        const script = document.getElementById("datos-estructurados-migas");
        if (script) script.textContent = JSON.stringify(breadcrumbSchema);
    }

    function mostrarContexto(taller, contexto) {
        const seccion = document.getElementById("contexto-local");
        const titulo = document.getElementById("contexto-titulo");
        const descripcion = document.getElementById("contexto-texto");
        const enlaces = document.getElementById("contexto-enlaces");

        if (!seccion || !titulo || !descripcion || !enlaces) return;
        if (!taller.ciudad && !taller.provincia) return;

        titulo.textContent = taller.ciudad
            ? `Talleres en ${taller.ciudad}`
            : `Talleres en ${taller.provincia}`;

        const total = Number(contexto?.total_municipio || 0);

        descripcion.textContent = total > 0 && taller.ciudad
            ? `TallerMap reúne ${total} talleres activos en ${taller.ciudad}. Consulta el directorio local o explora toda la provincia.`
            : "Consulta otros talleres de la misma localidad y provincia.";

        enlaces.replaceChildren();

        if (taller.ciudad) {
            const municipio = document.createElement("a");
            municipio.className = "boton";
            municipio.href = urlMunicipio(taller, contexto);
            municipio.textContent = `Ver talleres en ${taller.ciudad}`;
            enlaces.appendChild(municipio);
        }

        if (taller.provincia) {
            const provincia = document.createElement("a");
            provincia.className = "boton boton-claro";
            provincia.href = urlProvincia(taller.provincia, contexto);
            provincia.textContent = `Ver talleres en ${taller.provincia}`;
            enlaces.appendChild(provincia);
        }

        seccion.hidden = false;
    }

    function mostrarRelacionados(talleres, tallerActual) {
        const contenedor = document.getElementById("talleres-relacionados");
        const estado = document.getElementById("relacionados-estado");
        const titulo = document.getElementById("relacionados-titulo");

        if (!contenedor || !estado || !titulo) return;

        contenedor.replaceChildren();

        if (!talleres.length) {
            estado.className = "ficha-relacionados-vacio";
            estado.textContent =
                "Todavía no hay otros talleres relacionados disponibles.";
            return;
        }

        const mismaCiudad = talleres.some((taller) => taller.misma_ciudad);
        titulo.textContent = mismaCiudad && tallerActual.ciudad
            ? `Otros talleres en ${tallerActual.ciudad}`
            : "Otros talleres que pueden interesarte";

        talleres.forEach((taller) => {
            const enlace = document.createElement("a");
            enlace.className = "taller-relacionado";
            enlace.href =
                `${SITE_URL}/pages/taller.html`
                + `?slug=${encodeURIComponent(taller.slug)}`;

            const nombre = document.createElement("strong");
            nombre.textContent = taller.nombre || "Taller";

            const ubicacion = document.createElement("small");
            ubicacion.textContent = [
                taller.direccion,
                taller.codigo_postal,
                taller.ciudad
            ]
                .filter(Boolean)
                .join(", ");

            enlace.append(nombre, ubicacion);

            const etiquetas = document.createElement("div");
            etiquetas.className = "taller-relacionado-etiquetas";

            if (taller.verificado) {
                const verificado = document.createElement("span");
                verificado.textContent = "✓ Verificado";
                etiquetas.appendChild(verificado);
            }

            if (Number(taller.coincidencias_servicio) > 0) {
                const coincidencia = document.createElement("span");
                coincidencia.textContent =
                    `${taller.coincidencias_servicio} servicios en común`;
                etiquetas.appendChild(coincidencia);
            }

            if (taller.misma_ciudad) {
                const local = document.createElement("span");
                local.textContent = "Misma localidad";
                etiquetas.appendChild(local);
            }

            if (etiquetas.childElementCount) {
                enlace.appendChild(etiquetas);
            }

            contenedor.appendChild(enlace);
        });

        estado.hidden = true;
    }

    async function mostrarTaller(taller) {
        const nombre = taller.nombre || "Taller publicado en TallerMap";
        const direccion = direccionCompleta(taller);
        const telefono = String(taller.telefono || "").replace(/[^\d+]/g, "");
        const whatsapp = telefonoWhatsApp(telefono);
        const web = urlSegura(taller.web);
        const descripcion = taller.descripcion
            || `Consulta el teléfono, dirección, servicios y datos públicos de ${nombre}.`;
        const servicios = Array.isArray(taller.servicios)
            ? taller.servicios.filter(Boolean)
            : [];
        const verificado = Boolean(taller.verificado);
        const actualizacion = taller.updated_at || "";
        const foto = await urlFoto(taller);
        const fichaCompleta = Boolean(
            nombre && direccion && (telefono || web)
        );

        texto("taller-nombre", nombre);
        texto("taller-direccion", direccion || "Ubicación no indicada");
        texto("taller-descripcion", descripcion);

        const contenedorFoto = document.getElementById("taller-foto");
        const imagen = document.getElementById("taller-foto-imagen");

        if (contenedorFoto && imagen && foto) {
            imagen.src = foto;
            imagen.alt = `Imagen de ${nombre}`;
            imagen.loading = "eager";
            imagen.decoding = "async";
            contenedorFoto.hidden = false;
        }

        const insignia = document.getElementById("taller-verificacion");
        if (insignia) {
            insignia.textContent = verificado
                ? "✓ Taller verificado"
                : "Datos públicos pendientes de verificar";
            insignia.classList.toggle("verificada", verificado);
        }

        texto(
            "taller-actualizacion",
            actualizacion
                ? `Última actualización: ${fechaLegible(actualizacion)}`
                : ""
        );

        const tituloSEO = taller.ciudad && taller.provincia
            ? `${nombre} | Taller mecánico en ${taller.ciudad} (${taller.provincia}) | TallerMap`
            : taller.ciudad
                ? `${nombre} | Taller mecánico en ${taller.ciudad} | TallerMap`
                : `${nombre} | TallerMap`;

        document.title = tituloSEO.slice(0, 68);

        const metaDescripcion =
            document.querySelector('meta[name="description"]');

        if (metaDescripcion) {
            const descripcionSEO = taller.ciudad
                ? `Teléfono, dirección, horario, servicios y cómo llegar a ${nombre} en ${taller.ciudad}${taller.provincia ? `, ${taller.provincia}` : ""}. Consulta su ficha en TallerMap.`
                : `Teléfono, dirección, horario, servicios y cómo llegar a ${nombre}. Consulta su ficha en TallerMap.`;

            metaDescripcion.content = descripcionSEO.slice(0, 158);
        }

        const canonical = document.getElementById("canonical-taller");

        if (canonical) {
            const referencia = taller.slug
                ? `slug=${encodeURIComponent(taller.slug)}`
                : `id=${encodeURIComponent(taller.id || id)}`;

            canonical.href =
                `${SITE_URL}/pages/taller.html?${referencia}`;
        }

        const robots = document.getElementById("robots-taller");
        if (robots) {
            robots.content = fichaCompleta
                ? "index,follow,max-image-preview:large"
                : "noindex,follow";
        }

        const acciones = document.getElementById("taller-acciones");

        if (acciones) {
            acciones.replaceChildren();

            if (telefono) {
                acciones.appendChild(
                    crearAccion({
                        clase: "boton accion-principal",
                        href: `tel:${telefono}`,
                        etiqueta: "☎ Llamar ahora",
                        aria: `Llamar a ${nombre}`,
                        tipo: "llamada",
                        taller
                    })
                );
            }

            if (direccion) {
                const consulta = [nombre, direccion, "España"]
                    .filter(Boolean)
                    .join(", ");

                acciones.appendChild(
                    crearAccion({
                        clase: "boton accion-mapa",
                        href:
                            "https://www.google.com/maps/search/"
                            + `?api=1&query=${encodeURIComponent(consulta)}`,
                        etiqueta: "⌖ Cómo llegar",
                        aria: `Abrir la ubicación de ${nombre} en Google Maps`,
                        tipo: "mapa",
                        taller,
                        nuevaPestana: true
                    })
                );
            }

            if (whatsapp) {
                const mensaje =
                    "Hola, he encontrado vuestro taller en TallerMap "
                    + "y quisiera pedir información.";

                acciones.appendChild(
                    crearAccion({
                        clase: "boton accion-whatsapp",
                        href:
                            `https://wa.me/${whatsapp}`
                            + `?text=${encodeURIComponent(mensaje)}`,
                        etiqueta: "WhatsApp",
                        aria: `Contactar con ${nombre} por WhatsApp`,
                        tipo: "whatsapp",
                        taller,
                        nuevaPestana: true
                    })
                );
            }

            if (web) {
                acciones.appendChild(
                    crearAccion({
                        clase: "boton boton-claro accion-web",
                        href: web,
                        etiqueta: "Página web",
                        aria: `Visitar la página web de ${nombre}`,
                        tipo: "web",
                        taller,
                        nuevaPestana: true
                    })
                );
            }
        }

        const serviciosContenedor =
            document.getElementById("taller-servicios");

        if (serviciosContenedor) {
            serviciosContenedor.replaceChildren();

            servicios.forEach((servicio) => {
                const etiqueta = document.createElement("span");
                etiqueta.textContent = servicio;
                serviciosContenedor.appendChild(etiqueta);
            });
        }

        const datos = document.getElementById("taller-datos");

        if (datos) {
            datos.replaceChildren();

            if (telefono) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    `<p><strong>Teléfono:</strong> `
                    + `<a href="tel:${escaparHTML(telefono)}">`
                    + `${escaparHTML(telefono)}</a></p>`
                );
            }

            if (taller.direccion) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    `<p><strong>Dirección:</strong> `
                    + `${escaparHTML(taller.direccion)}</p>`
                );
            }

            if (taller.codigo_postal) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    `<p><strong>Código postal:</strong> `
                    + `${escaparHTML(taller.codigo_postal)}</p>`
                );
            }

            if (taller.ciudad) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    `<p><strong>Municipio:</strong> `
                    + `${escaparHTML(taller.ciudad)}</p>`
                );
            }

            if (taller.provincia) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    `<p><strong>Provincia:</strong> `
                    + `${escaparHTML(taller.provincia)}</p>`
                );
            }

            datos.insertAdjacentHTML(
                "beforeend",
                horarioHTML(taller.horarios)
            );

            if (!fichaCompleta) {
                datos.insertAdjacentHTML(
                    "beforeend",
                    "<p>Esta ficha no se enviará a los buscadores "
                    + "hasta disponer de dirección y un medio de contacto.</p>"
                );
            }
        }

        const urlFicha =
            canonical?.href || window.location.href.split("#")[0];

        actualizarCorreo(
            "reclamar-ficha",
            `Reclamar ficha: ${nombre}`,
            `Soy el propietario o representante de ${nombre}.\n\n`
            + `Ficha: ${urlFicha}\n\n`
            + "Nombre y cargo:\n"
            + "Teléfono de contacto:\n"
            + "Información que acredita la titularidad:"
        );

        actualizarCorreo(
            "corregir-ficha",
            `Corregir ficha: ${nombre}`,
            "Quiero informar de datos incorrectos en esta ficha.\n\n"
            + `Ficha: ${urlFicha}\n\n`
            + "Dato incorrecto:\n"
            + "Dato correcto:\n"
            + "Fuente o explicación:"
        );

        const estructurados = construirDatosEstructurados({
            taller,
            nombre,
            descripcion,
            urlFicha,
            telefono,
            web,
            servicios,
            actualizacion,
            foto
        });

        const script =
            document.getElementById("datos-estructurados-taller");

        if (script) script.textContent = JSON.stringify(estructurados);

        const [contexto, relacionados] = await Promise.all([
            obtenerContexto(taller),
            obtenerRelacionados(taller)
        ]);

        actualizarMigas(taller, contexto, nombre);
        mostrarContexto(taller, contexto);
        mostrarRelacionados(relacionados, taller);
    }

    obtenerTaller()
        .then(mostrarTaller)
        .catch((error) => {
            console.error(
                "No se pudo mostrar la ficha del taller:",
                error
            );
            return mostrarTaller(datosLegados());
        });
}());
