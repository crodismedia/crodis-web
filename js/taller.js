(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const SITE_URL = "https://www.tallermap.es";
    const TIMEOUT_MS = 8000;

    const parametros = new URLSearchParams(window.location.search);
    const leer = (clave) => String(parametros.get(clave) || "").trim();

    function slugDesdeRuta() {
        const prefijo = "/talleres/";
        if (!window.location.pathname.startsWith(prefijo)) return "";
        return decodeURIComponent(
            window.location.pathname.slice(prefijo.length).split("/")[0] || ""
        ).trim();
    }

    const id = leer("id");
    const slug = slugDesdeRuta() || leer("slug");

    const cliente = window.supabase?.createClient
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

    function conTiempoLimite(promesa, valorAlternativo) {
        return Promise.race([
            promesa,
            new Promise((resolve) => {
                window.setTimeout(() => resolve(valorAlternativo), TIMEOUT_MS);
            })
        ]);
    }

    function texto(idElemento, valor) {
        const elemento = document.getElementById(idElemento);
        if (elemento) elemento.textContent = valor || "";
    }

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor == null ? "" : String(valor);
        return elemento.innerHTML;
    }

    function slugSeguro(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
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

    function idValido(valor) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
    }

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
            descripcion: leer("descripcion") || "Consulta los datos públicos disponibles de este taller.",
            servicios: leer("servicios").split("|").map((valor) => valor.trim()).filter(Boolean),
            verificado: ["1", "true", "si", "sí"].includes(leer("verificado").toLowerCase()),
            updated_at: leer("actualizado"),
            fotos: [],
            horarios: null
        };
    }

    function direccionCompleta(taller) {
        if (taller.direccionCompleta) return taller.direccionCompleta;
        return [taller.direccion, taller.codigo_postal, taller.ciudad, taller.provincia]
            .filter(Boolean)
            .join(", ");
    }

    function telefonoWhatsApp(valor) {
        const digitos = String(valor || "").replace(/\D/g, "");
        if (/^[67]\d{8}$/.test(digitos)) return `34${digitos}`;
        if (/^34[67]\d{8}$/.test(digitos)) return digitos;
        return "";
    }

    function fechaLegible(valor) {
        if (!valor) return "";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return String(valor).slice(0, 40);
        return new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(fecha);
    }

    async function obtenerTaller() {
        const legado = datosLegados();
        if (!cliente || (!id && !slug)) return legado;

        const respuesta = await conTiempoLimite(
            cliente.rpc("obtener_taller_publico", {
                p_id: idValido(id) ? id : null,
                p_slug: slug || null
            }),
            { data: null, error: new Error("Tiempo de espera agotado") }
        );

        if (respuesta?.error || !Array.isArray(respuesta?.data) || !respuesta.data.length) {
            console.warn("No se encontró la ficha por id o slug.", respuesta?.error || "Sin resultados");
            return legado;
        }

        return { ...legado, ...respuesta.data[0] };
    }

    async function obtenerContexto(taller) {
        if (!cliente) return null;
        const respuesta = await conTiempoLimite(
            cliente.rpc("obtener_contexto_taller", {
                p_id: idValido(String(taller.id || id || "")) ? String(taller.id || id) : null,
                p_slug: String(taller.slug || slug || "").trim() || null
            }),
            { data: null, error: new Error("Tiempo de espera agotado") }
        );
        if (respuesta?.error) return null;
        return Array.isArray(respuesta?.data) && respuesta.data.length ? respuesta.data[0] : null;
    }

    async function obtenerRelacionados(taller) {
        if (!cliente) return [];
        const respuesta = await conTiempoLimite(
            cliente.rpc("buscar_talleres_relacionados", {
                p_id: idValido(String(taller.id || id || "")) ? String(taller.id || id) : null,
                p_slug: String(taller.slug || slug || "").trim() || null,
                p_limite: 6
            }),
            { data: [], error: new Error("Tiempo de espera agotado") }
        );
        return respuesta?.error || !Array.isArray(respuesta?.data) ? [] : respuesta.data;
    }

    async function urlFoto(taller) {
        const primera = Array.isArray(taller.fotos) ? taller.fotos[0] : "";
        const publica = urlSegura(primera);
        if (publica) return publica;
        if (!primera || !cliente?.storage?.from) return "";

        const respuesta = await conTiempoLimite(
            cliente.storage.from("fotos-talleres").createSignedUrl(primera, 3600),
            { data: null, error: new Error("Tiempo de espera agotado") }
        );

        return respuesta?.error ? "" : (respuesta?.data?.signedUrl || respuesta?.data?.signedURL || "");
    }

    function crearAccion(clase, href, etiqueta, nuevaPestana) {
        const enlace = document.createElement("a");
        enlace.className = clase;
        enlace.href = href;
        enlace.textContent = etiqueta;
        if (nuevaPestana) {
            enlace.target = "_blank";
            enlace.rel = "noopener noreferrer";
        }
        return enlace;
    }

    function horarioHTML(horarios) {
        if (!horarios || typeof horarios !== "object") return "";
        const dias = [
            ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
            ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
            ["domingo", "Domingo"]
        ];
        const filas = dias.map(([clave, etiqueta]) => {
            const valor = horarios[clave];
            if (!valor) return "";
            const horario = valor.cerrado
                ? "Cerrado"
                : (valor.turnos || []).map((turno) => `${turno.apertura}–${turno.cierre}`).join(" y ");
            return horario ? `<div><dt>${etiqueta}</dt><dd>${escaparHTML(horario)}</dd></div>` : "";
        }).filter(Boolean).join("");
        return filas ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${filas}</dl></details>` : "";
    }

    function urlMunicipio(taller, contexto) {
        if (contexto?.codigo_municipal && contexto?.municipio) {
            return `${SITE_URL}/municipios/${slugSeguro(contexto.municipio)}-${contexto.codigo_municipal}.html`;
        }
        return `${SITE_URL}/?ubicacion=${encodeURIComponent(taller.ciudad || "")}#talleres`;
    }

    function urlProvincia(provincia, contexto) {
        const slugProvincia = contexto?.provincia_slug || slugSeguro(provincia);
        return slugProvincia ? `${SITE_URL}/provincias/${slugProvincia}.html` : `${SITE_URL}/provincias/`;
    }

    function actualizarMigas(taller, contexto, nombre) {
        const nav = document.getElementById("migas-pan");
        if (!nav) return;
        nav.replaceChildren();

        const elementos = [{ nombre: "Inicio", url: `${SITE_URL}/` }];
        if (taller.provincia) elementos.push({ nombre: taller.provincia, url: urlProvincia(taller.provincia, contexto) });
        if (taller.ciudad) elementos.push({ nombre: taller.ciudad, url: urlMunicipio(taller, contexto) });
        elementos.push({ nombre, url: "" });

        elementos.forEach((elemento, indice) => {
            if (indice) {
                const separador = document.createElement("span");
                separador.textContent = "›";
                separador.className = "ficha-migas-separador";
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
                nav.appendChild(actual);
            }
        });
    }

    function mostrarContexto(taller, contexto) {
        const seccion = document.getElementById("contexto-local");
        const titulo = document.getElementById("contexto-titulo");
        const descripcion = document.getElementById("contexto-texto");
        const enlaces = document.getElementById("contexto-enlaces");
        if (!seccion || !titulo || !descripcion || !enlaces || (!taller.ciudad && !taller.provincia)) return;

        titulo.textContent = taller.ciudad ? `Talleres en ${taller.ciudad}` : `Talleres en ${taller.provincia}`;
        descripcion.textContent = taller.ciudad
            ? `Consulta otros talleres publicados en ${taller.ciudad} y en la provincia.`
            : "Consulta otros talleres publicados en la provincia.";
        enlaces.replaceChildren();

        if (taller.ciudad) enlaces.appendChild(crearAccion("boton", urlMunicipio(taller, contexto), `Ver talleres en ${taller.ciudad}`, false));
        if (taller.provincia) enlaces.appendChild(crearAccion("boton boton-claro", urlProvincia(taller.provincia, contexto), `Ver talleres en ${taller.provincia}`, false));
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
            estado.textContent = "Todavía no hay otros talleres relacionados disponibles.";
            return;
        }

        titulo.textContent = tallerActual.ciudad ? `Otros talleres en ${tallerActual.ciudad}` : "Otros talleres que pueden interesarte";
        talleres.forEach((taller) => {
            if (!taller.slug) return;
            const enlace = document.createElement("a");
            enlace.className = "taller-relacionado";
            enlace.href = `${SITE_URL}/talleres/${encodeURIComponent(taller.slug)}`;
            enlace.innerHTML = `<strong>${escaparHTML(taller.nombre || "Taller")}</strong><small>${escaparHTML([taller.direccion, taller.codigo_postal, taller.ciudad].filter(Boolean).join(", "))}</small>`;
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
        const descripcion = taller.descripcion || `Consulta los datos públicos de ${nombre}.`;
        const servicios = Array.isArray(taller.servicios) ? taller.servicios.filter(Boolean) : [];
        const foto = await urlFoto(taller);

        texto("taller-nombre", nombre);
        texto("taller-direccion", direccion || "Ubicación no indicada");
        texto("taller-descripcion", descripcion);
        texto("taller-actualizacion", taller.updated_at ? `Última actualización: ${fechaLegible(taller.updated_at)}` : "");

        const insignia = document.getElementById("taller-verificacion");
        if (insignia) {
            insignia.textContent = taller.verificado ? "✓ Taller verificado" : "Datos públicos pendientes de verificar";
            insignia.classList.toggle("verificada", Boolean(taller.verificado));
        }

        const contenedorFoto = document.getElementById("taller-foto");
        const imagen = document.getElementById("taller-foto-imagen");
        if (contenedorFoto && imagen && foto) {
            imagen.src = foto;
            imagen.alt = `Imagen de ${nombre}`;
            contenedorFoto.hidden = false;
        }

        const acciones = document.getElementById("taller-acciones");
        if (acciones) {
            acciones.replaceChildren();
            if (telefono) acciones.appendChild(crearAccion("boton accion-principal", `tel:${telefono}`, "☎ Llamar ahora", false));
            if (direccion) acciones.appendChild(crearAccion("boton accion-mapa", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nombre}, ${direccion}, España`)}`, "⌖ Cómo llegar", true));
            if (whatsapp) acciones.appendChild(crearAccion("boton accion-whatsapp", `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, he encontrado vuestro taller en TallerMap y quisiera pedir información.")}`, "WhatsApp", true));
            if (web) acciones.appendChild(crearAccion("boton boton-claro accion-web", web, "Página web", true));
        }

        const serviciosContenedor = document.getElementById("taller-servicios");
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
            if (telefono) datos.insertAdjacentHTML("beforeend", `<p><strong>Teléfono:</strong> <a href="tel:${escaparHTML(telefono)}">${escaparHTML(telefono)}</a></p>`);
            if (taller.direccion) datos.insertAdjacentHTML("beforeend", `<p><strong>Dirección:</strong> ${escaparHTML(taller.direccion)}</p>`);
            if (taller.codigo_postal) datos.insertAdjacentHTML("beforeend", `<p><strong>Código postal:</strong> ${escaparHTML(taller.codigo_postal)}</p>`);
            if (taller.ciudad) datos.insertAdjacentHTML("beforeend", `<p><strong>Municipio:</strong> ${escaparHTML(taller.ciudad)}</p>`);
            if (taller.provincia) datos.insertAdjacentHTML("beforeend", `<p><strong>Provincia:</strong> ${escaparHTML(taller.provincia)}</p>`);
            datos.insertAdjacentHTML("beforeend", horarioHTML(taller.horarios));
        }

        document.title = taller.ciudad && taller.provincia
            ? `${nombre} | Taller mecánico en ${taller.ciudad} (${taller.provincia}) | TallerMap`.slice(0, 68)
            : `${nombre} | TallerMap`;

        const slugFinal = taller.slug || slug || slugSeguro(`${nombre}-${taller.ciudad || ""}`);
        const urlFicha = `${SITE_URL}/talleres/${slugFinal}`;
        const canonical = document.getElementById("canonical-taller");
        if (canonical) canonical.href = urlFicha;

        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.content = `Teléfono, dirección, servicios y cómo llegar a ${nombre}${taller.ciudad ? ` en ${taller.ciudad}` : ""}. Consulta su ficha en TallerMap.`.slice(0, 158);

        const robots = document.getElementById("robots-taller");
        if (robots) robots.content = nombre && direccion && (telefono || web) ? "index,follow,max-image-preview:large" : "noindex,follow";

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
            console.error("No se pudo mostrar la ficha del taller:", error);
            return mostrarTaller(datosLegados());
        });
}());
