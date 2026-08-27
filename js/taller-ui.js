(function () {
    "use strict";

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function webSegura(valor) {
        if (!valor) return "";

        try {
            const url = new URL(String(valor));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function telefonoSeguro(valor) {
        const raw = String(valor || "").trim();
        const digitos = raw.replace(/\D/g, "");

        if (/^0034\d{9}$/.test(digitos)) {
            return `+${digitos.slice(2)}`;
        }

        if (/^34\d{9}$/.test(digitos)) {
            return `+${digitos}`;
        }

        if (raw.startsWith("+") && digitos) {
            return `+${digitos}`.slice(0, 20);
        }

        return digitos.slice(0, 20);
    }

    function etiquetaDesdeSlug(slug) {
        const etiquetaConfigurada =
            window.TallerMapServicios?.etiquetas?.[String(slug || "")];

        if (etiquetaConfigurada) {
            return etiquetaConfigurada;
        }

        const texto = String(slug || "")
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLocaleLowerCase("es");

        return texto
            ? texto[0].toLocaleUpperCase("es") + texto.slice(1)
            : "";
    }

    function slugTaller(taller) {
        if (taller?.slug) {
            return String(taller.slug);
        }

        const base = `${taller?.nombre || "taller"}-${taller?.ciudad || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        return taller?.id
            ? `${base}-${String(taller.id).slice(0, 8)}`
            : base;
    }

    function normalizarServicios(valor) {
        if (Array.isArray(valor)) {
            return valor
                .map(servicio => {
                    if (typeof servicio === "string") {
                        return servicio;
                    }

                    if (servicio && typeof servicio === "object") {
                        return (
                            servicio.slug ||
                            servicio.nombre ||
                            servicio.servicio ||
                            ""
                        );
                    }

                    return "";
                })
                .filter(Boolean);
        }

        if (typeof valor === "string") {
            return valor
                .split(",")
                .map(servicio => servicio.trim())
                .filter(Boolean);
        }

        return [];
    }

    function construirUbicacion(taller) {
        return [
            taller?.direccion,
            taller?.codigo_postal,
            taller?.ciudad,
            taller?.provincia
        ]
            .filter(Boolean)
            .map(valor => String(valor).trim())
            .filter(Boolean)
            .filter(
                (valor, indice, lista) =>
                    lista.indexOf(valor) === indice
            )
            .map(escaparHTML)
            .join(", ");
    }

    function renderizarHorario(horarios) {
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
                const dia = horarios[clave];

                if (!dia || typeof dia !== "object") {
                    return "";
                }

                let texto = "";

                if (dia.cerrado === true) {
                    texto = "Cerrado";
                } else {
                    const turnos = Array.isArray(dia.turnos)
                        ? dia.turnos
                        : [];

                    texto = turnos
                        .map(turno => {
                            const apertura = String(
                                turno?.apertura || ""
                            ).trim();

                            const cierre = String(
                                turno?.cierre || ""
                            ).trim();

                            if (!apertura || !cierre) {
                                return "";
                            }

                            return `${apertura}–${cierre}`;
                        })
                        .filter(Boolean)
                        .join(" y ");
                }

                if (!texto) {
                    return "";
                }

                return `
                    <div>
                        <dt>${escaparHTML(etiqueta)}</dt>
                        <dd>${escaparHTML(texto)}</dd>
                    </div>
                `;
            })
            .filter(Boolean)
            .join("");

        if (!filas) {
            return "";
        }

        return `
            <details class="taller-horario">
                <summary>Ver horario semanal</summary>
                <dl>${filas}</dl>
            </details>
        `;
    }

    function crearTarjeta(taller) {
        const nombreOriginal =
            taller?.nombre || "Taller sin nombre";

        const nombre = escaparHTML(nombreOriginal);
        const ubicacion = construirUbicacion(taller);
        const slug = slugTaller(taller);

        const descripcion = escaparHTML(
            taller?.descripcion ||
            "Consulta la ficha del taller para conocer sus servicios y datos de contacto."
        );

        const telefono =
            telefonoSeguro(taller?.telefono);

        const web =
            webSegura(taller?.web);

        const servicios =
            normalizarServicios(taller?.servicios).slice(0, 4);

        const horario =
            renderizarHorario(taller?.horarios);

        const enlaces = [];

        if (telefono) {
            enlaces.push(
                `<a href="tel:${escaparHTML(telefono)}" aria-label="Llamar a ${nombre}">Llamar</a>`
            );
        }

        if (web) {
            enlaces.push(
                `<a href="${escaparHTML(web)}" target="_blank" rel="noopener noreferrer" aria-label="Visitar la web de ${nombre}">Web</a>`
            );
        }

        if (slug) {
            enlaces.push(
                `<a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}" aria-label="Ver ficha de ${nombre}">Ver ficha</a>`
            );
        }

        const etiquetasServicios =
            (
                servicios.length
                    ? servicios
                    : ["taller-mecanico"]
            )
                .map(
                    servicio =>
                        `<span>${escaparHTML(
                            etiquetaDesdeSlug(servicio)
                        )}</span>`
                )
                .join("");

        const estadoPublicacion =
            taller?.verificado
                ? "✓ Información revisada"
                : "Información publicada";

        return `
            <article
                class="taller-card"
                data-taller-slug="${escaparHTML(slug)}"
            >
                <div class="taller-informacion">
                    <span class="verificado verificado-en-contenido">
                        ${estadoPublicacion}
                    </span>

                    <h3>${nombre}</h3>

                    <p class="ubicacion">
                        ⌖ ${ubicacion || "Ubicación no indicada"}
                    </p>

                    <p class="taller-descripcion">
                        ${descripcion}
                    </p>

                    <div class="especialidades">
                        ${etiquetasServicios}
                    </div>

                    ${horario}

                    <div class="taller-pie">
                        <span class="taller-contactos">
                            ${enlaces.join("")}
                        </span>
                    </div>
                </div>
            </article>
        `;
    }

    window.TallerMapTallerUI = Object.freeze({
        escaparHTML,
        webSegura,
        slugTaller,
        crearTarjeta
    });
}());