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

        if (/^34\d{9}$/.test(digitos)) {
            return `+${digitos}`;
        }

        if (/^\d{9}$/.test(digitos)) {
            return `+34${digitos}`;
        }

        return original.replace(/[^\d+]/g, "");
    }

    function telefonoWhatsApp(valor) {
        const digitos = String(valor || "").replace(/\D/g, "");

        if (/^[67]\d{8}$/.test(digitos)) {
            return `34${digitos}`;
        }

        if (/^34[67]\d{8}$/.test(digitos)) {
            return digitos;
        }

        return "";
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
            new CustomEvent("tallermap:contacto", {
                detail: detalle
            })
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

        if (!cliente || (!id && !slug)) {
            return legado;
        }

        const idValido =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                .test(id);

        const { data, error } = await cliente.rpc(
            "obtener_taller_publico",
            {
                p_id: idValido ? id : null,
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

        return {
            ...legado,
            ...data[0]
        };
    }

    async function urlFoto(taller) {
        const primera = Array.isArray(taller.fotos)
            ? taller.fotos[0]
            : "";

        const publica = urlSegura(primera);

        if (publica) return publica;

        if (!primera || !cliente?.storage?.from) {
            return "";
        }

        const { data, error } = await cliente
            .storage
            .from("fotos-talleres")
            .createSignedUrl(primera, 3600);

        if (error) return "";

        return data?.signedUrl || data?.signedURL || "";
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
        if (!valor || valor.cerrado) return [];

        if (!Array.isArray(valor.turnos)) return [];

        return valor.turnos.filter((turno) => {
            return turno
                && turno.apertura
                && turno.cierre;
        });
    }

    function horarioHTML(horarios) {
        if (!horarios || typeof horarios !== "object") {
            return "";
        }

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

                const turnos = obtenerTurnos(valor);

                const horario = valor.cerrado
                    ? "Cerrado"
                    : turnos
                        .map((turno) => {
                            return `${turno.apertura}–${turno.cierre}`;
                        })
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

        if (!filas) return "";

        return `
            <details class="taller-horario">
                <summary>Ver horario semanal</summary>
                <dl>${filas}</dl>
            </details>
        `;
    }

    function generarOpeningHoursSpecification(horarios) {
        if (!horarios || typeof horarios !== "object") {
            return [];
        }

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

            const turnos = obtenerTurnos(valor);

            turnos.forEach((turno) => {
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

        if (taller.direccion) {
            direccion.streetAddress = taller.direccion;
        }

        if (taller.ciudad) {
            direccion.addressLocality = taller.ciudad;
        }

        if (taller.provincia) {
            direccion.addressRegion = taller.provincia;
        }

        if (taller.codigo_postal) {
            direccion.postalCode = taller.codigo_postal;
        }

        const tieneDatos =
            direccion.streetAddress
            || direccion.addressLocality
            || direccion.addressRegion
            || direccion.postalCode;

        return tieneDatos ? direccion : null;
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
            mainEntityOfPage: urlFicha,
            areaServed: {
                "@type": "AdministrativeArea",
                name: [
                    taller.ciudad,
                    taller.provincia,
                    "España"
                ]
                    .filter(Boolean)
                    .join(", ")
            }
        };

        const direccionSchema = construirDireccionSchema(taller);

        if (direccionSchema) {
            estructurados.address = direccionSchema;
        }

        if (telefono) {
            estructurados.telephone = normalizarTelefono(telefono);
        }

        if (web) {
            estructurados.sameAs = [web];
        }

        if (foto) {
            estructurados.image = [foto];
        }

        if (servicios.length) {
            estructurados.knowsAbout = servicios;
        }

        if (actualizacion) {
            estructurados.dateModified =
                String(actualizacion).slice(0, 10);
        }

        if (taller.verificado) {
            estructurados.additionalProperty = {
                "@type": "PropertyValue",
                name: "Verificado en TallerMap",
                value: "Sí"
            };
        }

        const horariosSchema =
            generarOpeningHoursSpecification(taller.horarios);

        if (horariosSchema.length) {
            estructurados.openingHoursSpecification =
                horariosSchema;
        }

        return estructurados;
    }

    async function mostrarTaller(taller) {
        const nombre =
            taller.nombre || "Taller publicado en TallerMap";

        const direccion = direccionCompleta(taller);

        const telefono = String(taller.telefono || "")
            .replace(/[^\d+]/g, "");

        const whatsapp = telefonoWhatsApp(telefono);
        const web = urlSegura(taller.web);

        const descripcion =
            taller.descripcion
            || `Consulta el teléfono, dirección, servicios y datos públicos de ${nombre}.`;

        const servicios = Array.isArray(taller.servicios)
            ? taller.servicios.filter(Boolean)
            : [];

        const verificado = Boolean(taller.verificado);
        const actualizacion = taller.updated_at || "";
        const foto = await urlFoto(taller);

        const fichaCompleta = Boolean(
            nombre
            && direccion
            && (telefono || web)
        );

        texto("taller-nombre", nombre);
        texto(
            "taller-direccion",
            direccion || "Ubicación no indicada"
        );
        texto("taller-descripcion", descripcion);

        const contenedorFoto =
            document.getElementById("taller-foto");

        const imagen =
            document.getElementById("taller-foto-imagen");

        if (contenedorFoto && imagen && foto) {
            imagen.src = foto;
            imagen.alt = `Imagen de ${nombre}`;
            imagen.loading = "eager";
            imagen.decoding = "async";
            contenedorFoto.hidden = false;
        }

        const insignia =
            document.getElementById("taller-verificacion");

        if (insignia) {
            insignia.textContent = verificado
                ? "✓ Taller verificado"
                : "Datos públicos pendientes de verificar";

            insignia.classList.toggle(
                "verificada",
                verificado
            );
        }

        texto(
            "taller-actualizacion",
            actualizacion
                ? `Última actualización: ${fechaLegible(actualizacion)}`
                : ""
        );

        const localidadSEO = [
            taller.ciudad,
            taller.provincia
        ]
            .filter(Boolean)
            .join(" (")
            .replace(/\($/, "");

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

            metaDescripcion.content =
                descripcionSEO.slice(0, 158);
        }

        const canonical =
            document.getElementById("canonical-taller");

        if (canonical) {
            const referencia = taller.slug
                ? `slug=${encodeURIComponent(taller.slug)}`
                : `id=${encodeURIComponent(taller.id || id)}`;

            canonical.href =
                `${SITE_URL}/pages/taller.html?${referencia}`;
        }

        const robots =
            document.getElementById("robots-taller");

        if (robots) {
            robots.content = fichaCompleta
                ? "index,follow,max-image-preview:large"
                : "noindex,follow";
        }

        const acciones =
            document.getElementById("taller-acciones");

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
                const consulta = [
                    nombre,
                    direccion,
                    "España"
                ]
                    .filter(Boolean)
                    .join(", ");

                acciones.appendChild(
                    crearAccion({
                        clase: "boton accion-mapa",
                        href:
                            "https://www.google.com/maps/search/"
                            + `?api=1&query=${encodeURIComponent(consulta)}`,
                        etiqueta: "⌖ Cómo llegar",
                        aria:
                            `Abrir la ubicación de ${nombre} `
                            + "en Google Maps",
                        tipo: "mapa",
                        taller,
                        nuevaPestana: true
                    })
                );
            }

            if (whatsapp) {
                const mensaje =
                    "Hola, he encontrado vuestro taller "
                    + "en TallerMap y quisiera pedir información.";

                acciones.appendChild(
                    crearAccion({
                        clase: "boton accion-whatsapp",
                        href:
                            `https://wa.me/${whatsapp}`
                            + `?text=${encodeURIComponent(mensaje)}`,
                        etiqueta: "WhatsApp",
                        aria:
                            `Contactar con ${nombre} por WhatsApp`,
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
                        aria:
                            `Visitar la página web de ${nombre}`,
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
                const etiqueta =
                    document.createElement("span");

                etiqueta.textContent = servicio;
                serviciosContenedor.appendChild(etiqueta);
            });
        }

        const datos =
            document.getElementById("taller-datos");

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
            canonical?.href
            || window.location.href.split("#")[0];

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

        const estructurados =
            construirDatosEstructurados({
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
            document.getElementById(
                "datos-estructurados-taller"
            );

        if (script) {
            script.textContent =
                JSON.stringify(estructurados);
        }
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
