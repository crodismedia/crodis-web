(function () {
    "use strict";

    const lista = document.getElementById("lista-solicitudes");
    const mensaje = document.getElementById("mensaje-admin");
    const editor = document.getElementById("editor-admin");
    const formulario = document.getElementById("formulario-admin-taller");
    const listaHorarios = document.getElementById("admin-lista-horarios");
    const escaparHtml = window.escaparHTML;
    const TAMANO_PAGINA = 30;
    const MAXIMO_FOTOS = 5;
    const MAXIMO_BYTES_FOTO = 5 * 1024 * 1024;
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
    const DIAS = [
        ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
        ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
        ["domingo", "Domingo"]
    ];
    const localidadesPorCodigo = new Map();
    let pagina = 0;
    let totalFiltrado = 0;
    let talleresPagina = [];
    let ubicacionesActuales = [];
    let candidatosInternet = [];
    let tallerEditado = null;
    let temporizadorSugerencias = null;
let poblacionSeleccionada = null;

    function mostrar(texto, tipo = "error") {
        mensaje.textContent = texto;
        mensaje.className = `mensaje-formulario mensaje-${tipo}`;
        mensaje.hidden = false;
        mensaje.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function ocultarMensaje() {
        mensaje.hidden = true;
        mensaje.textContent = "";
    }

    function valor(id) {
        return document.getElementById(id)?.value.trim() || "";
    }

    function formatoFecha(fecha) {
        if (!fecha) return "Sin fecha";
        const valorFecha = new Date(fecha);
        if (Number.isNaN(valorFecha.getTime())) return "Fecha no válida";
        return new Intl.DateTimeFormat("es-ES", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(valorFecha);
    }

    function normalizarWeb(web) {
        const texto = String(web || "").trim();
        if (!texto) return "";
        return /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
    }

    function terminoSeguro(texto) {
        return String(texto || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 100);
    }

    function opcionesHoras(incluirCerrado = false, incluirVacio = false) {
        const opciones = [
            incluirVacio
                ? '<option value="">Sin segundo turno</option>'
                : '<option value="">Elige…</option>'
        ];
        if (incluirCerrado) opciones.push('<option value="cerrado">Cerrado</option>');
        for (let hora = 0; hora < 24; hora += 1) {
            for (const minutos of ["00", "30"]) {
                const texto = `${String(hora).padStart(2, "0")}:${minutos}`;
                opciones.push(`<option value="${texto}">${texto}</option>`);
            }
        }
        if (!incluirCerrado) opciones.push('<option value="24:00">24:00</option>');
        return opciones.join("");
    }

    function crearHorarios() {
        listaHorarios.innerHTML = DIAS.map(([clave, etiqueta]) => `
            <div class="horario-fila" data-dia="${clave}">
                <strong>${etiqueta}</strong>
                <label><span>Apertura</span><select data-turno="apertura-1" aria-label="Apertura del ${etiqueta}" required>${opcionesHoras(true)}</select></label>
                <label><span>Cierre</span><select data-turno="cierre-1" aria-label="Cierre del ${etiqueta}" disabled>${opcionesHoras()}</select></label>
                <label><span>Segunda apertura</span><select data-turno="apertura-2" aria-label="Segunda apertura del ${etiqueta}" disabled>${opcionesHoras(false, true)}</select></label>
                <label><span>Segundo cierre</span><select data-turno="cierre-2" aria-label="Segundo cierre del ${etiqueta}" disabled>${opcionesHoras(false, true)}</select></label>
            </div>
        `).join("");
    }

    function actualizarFilaHorario(fila) {
        const apertura1 = fila.querySelector('[data-turno="apertura-1"]');
        const cierre1 = fila.querySelector('[data-turno="cierre-1"]');
        const apertura2 = fila.querySelector('[data-turno="apertura-2"]');
        const cierre2 = fila.querySelector('[data-turno="cierre-2"]');
        const cerrado = !apertura1.value || apertura1.value === "cerrado";
        cierre1.disabled = cerrado;
        cierre1.required = !cerrado;
        apertura2.disabled = cerrado;
        if (cerrado) {
            cierre1.value = "";
            apertura2.value = "";
            cierre2.value = "";
            cierre2.disabled = true;
            cierre2.required = false;
            return;
        }
        cierre2.disabled = !apertura2.value;
        cierre2.required = Boolean(apertura2.value);
        if (!apertura2.value) cierre2.value = "";
    }

    function horarioPredeterminado() {
        return Object.fromEntries(DIAS.map(([dia], indice) => [
            dia,
            indice < 5
                ? { cerrado: false, turnos: [{ apertura: "09:00", cierre: "18:00" }] }
                : { cerrado: true, turnos: [] }
        ]));
    }

    function cargarHorarios(horarios) {
        const datos = horarios && typeof horarios === "object"
            ? horarios
            : horarioPredeterminado();
        listaHorarios.querySelectorAll("[data-dia]").forEach((fila) => {
            const horario = datos[fila.dataset.dia] || { cerrado: true, turnos: [] };
            const turnos = horario.turnos || [];
            fila.querySelector('[data-turno="apertura-1"]').value =
                horario.cerrado ? "cerrado" : (turnos[0]?.apertura || "");
            actualizarFilaHorario(fila);
            fila.querySelector('[data-turno="cierre-1"]').value = turnos[0]?.cierre || "";
            fila.querySelector('[data-turno="apertura-2"]').value = turnos[1]?.apertura || "";
            actualizarFilaHorario(fila);
            fila.querySelector('[data-turno="cierre-2"]').value = turnos[1]?.cierre || "";
        });
    }

    function horariosSeleccionados() {
        const horarios = {};
        listaHorarios.querySelectorAll("[data-dia]").forEach((fila) => {
            const apertura1 = fila.querySelector('[data-turno="apertura-1"]').value;
            const cierre1 = fila.querySelector('[data-turno="cierre-1"]').value;
            const apertura2 = fila.querySelector('[data-turno="apertura-2"]').value;
            const cierre2 = fila.querySelector('[data-turno="cierre-2"]').value;
            horarios[fila.dataset.dia] = apertura1 === "cerrado"
                ? { cerrado: true, turnos: [] }
                : {
                    cerrado: false,
                    turnos: [
                        { apertura: apertura1, cierre: cierre1 },
                        ...(apertura2 ? [{ apertura: apertura2, cierre: cierre2 }] : [])
                    ]
                };
        });
        return horarios;
    }

    function validarHorarios(horarios) {
        let abierto = false;
        for (const horario of Object.values(horarios)) {
            if (horario.cerrado) continue;
            abierto = true;
            if (!horario.turnos.length) return false;
            for (let indice = 0; indice < horario.turnos.length; indice += 1) {
                const turno = horario.turnos[indice];
                if (!turno.apertura || !turno.cierre || turno.cierre <= turno.apertura) return false;
                if (indice === 1 && turno.apertura < horario.turnos[0].cierre) return false;
            }
        }
        return abierto;
    }

    function serviciosSeleccionados() {
        return Array.from(
            formulario.querySelectorAll('input[name="servicios"]:checked'),
            (campo) => campo.value
        );
    }

    function cargarServicios(servicios) {
        const elegidos = new Set(Array.isArray(servicios) ? servicios : []);
        formulario.querySelectorAll('input[name="servicios"]').forEach((campo) => {
            campo.checked = elegidos.has(campo.value);
        });
    }

    async function consultarLocalidades(codigoPostal) {
        if (localidadesPorCodigo.has(codigoPostal)) {
            return localidadesPorCodigo.get(codigoPostal);
        }
        const controlador = new AbortController();
        const limite = setTimeout(() => controlador.abort(), 9000);
        try {
            const respuesta = await fetch(
                `https://api.zippopotam.us/ES/${encodeURIComponent(codigoPostal)}`,
                { headers: { Accept: "application/json" }, signal: controlador.signal }
            );
            if (!respuesta.ok) return [];
            const datos = await respuesta.json();
            const localidades = [...new Set((datos.places || [])
                .map((lugar) => String(lugar["place name"] || "").trim())
                .filter(Boolean))];
            localidadesPorCodigo.set(codigoPostal, localidades);
            return localidades;
        } finally {
            clearTimeout(limite);
        }
    }

    async function comprobarPostal(completarCiudad = false) {
        const codigo = valor("admin-codigo-postal");
        const estado = document.getElementById("admin-estado-postal");
        const listaLocalidades = document.getElementById("admin-localidades");
        const provincia = window.TallerMapProvincias?.seleccionarSegunCodigo(
            codigo,
            document.getElementById("admin-provincia")
        );
        if (!provincia) {
            estado.textContent = "El código postal debe contener cinco números válidos.";
            estado.className = "campo-estado campo-estado-error";
            return [];
        }
        estado.textContent = "Comprobando población…";
        estado.className = "campo-estado campo-estado-cargando";
        try {
            const localidades = await consultarLocalidades(codigo);
            listaLocalidades.replaceChildren();
            localidades.forEach((localidad) => {
                const opcion = document.createElement("option");
                opcion.value = localidad;
                listaLocalidades.appendChild(opcion);
            });
            if (completarCiudad && !valor("admin-ciudad") && localidades.length) {
                document.getElementById("admin-ciudad").value = localidades[0];
            }
            estado.textContent = localidades.length
                ? `✓ Provincia: ${provincia.nombre}. Poblaciones: ${localidades.join(", ")}.`
                : `Provincia: ${provincia.nombre}. No se pudo confirmar la población.`;
            estado.className = localidades.length
                ? "campo-estado campo-estado-exito"
                : "campo-estado campo-estado-error";
            return localidades;
        } catch (error) {
            console.error("No se pudo comprobar el código postal:", error);
            estado.textContent = "No se pudo comprobar la población en este momento.";
            estado.className = "campo-estado campo-estado-error";
            return null;
        }
    }

    function construirConsulta({ conRango = true, soloConteo = false } = {}) {
        const columnas = soloConteo
            ? "id"
            : "id,solicitud_id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,horarios,servicios,fotos,descripcion,verificado,activo,created_at,updated_at";
        let consulta = window.supabaseClient
            .from("talleres")
            .select(columnas, { count: "exact", head: soloConteo });

        const estado = valor("filtro-estado");
        const verificacion = valor("filtro-verificacion");
        const busqueda = terminoSeguro(valor("filtro-busqueda"));
        if (estado === "activos") consulta = consulta.eq("activo", true);
        if (estado === "inactivos") consulta = consulta.eq("activo", false);
        if (verificacion === "verificados") consulta = consulta.eq("verificado", true);
        if (verificacion === "no-verificados") consulta = consulta.eq("verificado", false);
        if (busqueda) {
            consulta = consulta.or([
                `nombre.ilike.%${busqueda}%`,
                `ciudad.ilike.%${busqueda}%`,
                `provincia.ilike.%${busqueda}%`,
                `telefono.ilike.%${busqueda}%`
            ].join(","));
        }

        const orden = valor("filtro-orden");
        if (!soloConteo) {
            if (orden === "nombre") consulta = consulta.order("nombre", { ascending: true });
            else if (orden === "poblacion") consulta = consulta.order("ciudad", { ascending: true });
            else if (orden === "actualizados") consulta = consulta.order("updated_at", { ascending: false });
            else consulta = consulta.order("created_at", { ascending: false });
            if (conRango) {
                const desde = pagina * TAMANO_PAGINA;
                consulta = consulta.range(desde, desde + TAMANO_PAGINA - 1);
            } else {
                consulta = consulta.limit(5000);
            }
        }
        return consulta;
    }

    async function adjuntarFotosFirmadas(talleres) {
        const rutas = [...new Set(talleres.flatMap((taller) =>
            Array.isArray(taller.fotos) ? taller.fotos : []
        ))];
        if (!rutas.length) return talleres;
        const { data, error } = await window.supabaseClient.storage
            .from("fotos-talleres")
            .createSignedUrls(rutas, 3600);
        if (error) {
            console.error("No se pudieron cargar las fotografías:", error);
            return talleres;
        }
        const porRuta = new Map(
            (data || []).map((foto) => [foto.path, foto.signedUrl || foto.signedURL || ""])
        );
        return talleres.map((taller) => ({
            ...taller,
            fotosFirmadas: (taller.fotos || []).map((ruta) => porRuta.get(ruta) || "")
        }));
    }

    function tarjeta(taller) {
        const servicios = (taller.servicios || [])
            .map((servicio) => window.TallerMapServicios?.etiquetas?.[servicio] || servicio)
            .slice(0, 8);
        const foto = taller.fotosFirmadas?.find(Boolean);
        return `<article class="solicitud-card admin-taller-card" data-taller-id="${escaparHtml(taller.id)}">
            <div class="solicitud-titulo">
                <div>
                    <span>${taller.activo ? "Activo" : "Inactivo"} · ${taller.verificado ? "Verificado" : "No verificado"}</span>
                    <h2>${escaparHtml(taller.nombre)}</h2>
                    <p>${escaparHtml([taller.ciudad, taller.provincia].filter(Boolean).join(", "))}</p>
                </div>
                <time>Actualizado ${escaparHtml(formatoFecha(taller.updated_at))}</time>
            </div>
            ${foto ? `<img class="admin-taller-miniatura" src="${escaparHtml(foto)}" alt="Fotografía de ${escaparHtml(taller.nombre)}" loading="lazy">` : ""}
            <dl>
                <div><dt>Teléfono</dt><dd>${escaparHtml(taller.telefono || "No indicado")}</dd></div>
                <div><dt>Dirección</dt><dd>${escaparHtml(taller.direccion || "")}<br>${escaparHtml(taller.codigo_postal || "")} ${escaparHtml(taller.ciudad || "")}</dd></div>
                <div><dt>Servicios</dt><dd>${escaparHtml(servicios.join(", ") || "No indicados")}</dd></div>
                <div><dt>Alta</dt><dd>${escaparHtml(formatoFecha(taller.created_at))}</dd></div>
            </dl>
            <div class="solicitud-acciones admin-taller-acciones">
                <button class="boton boton-pequeno" data-accion="editar" type="button">Editar ficha</button>
                <button class="boton boton-secundario boton-pequeno" data-accion="estado" type="button">${taller.activo ? "Desactivar" : "Reactivar"}</button>
                <button class="boton boton-rechazar boton-pequeno" data-accion="eliminar" type="button">Eliminar definitivamente</button>
            </div>
        </article>`;
    }

    async function cargarMetricas() {
        const consultas = [
            window.supabaseClient.from("talleres").select("id", { count: "exact", head: true }),
            window.supabaseClient.from("talleres").select("id", { count: "exact", head: true }).eq("activo", true),
            window.supabaseClient.from("talleres").select("id", { count: "exact", head: true }).eq("activo", false),
            window.supabaseClient.from("talleres").select("id", { count: "exact", head: true }).eq("verificado", true),
            window.supabaseClient.from("talleres").select("id", { count: "exact", head: true }).eq("verificado", false)
        ];
        const resultados = await Promise.all(consultas);
        const ids = [
            "metrica-total", "metrica-activos", "metrica-inactivos",
            "metrica-verificados", "metrica-no-verificados"
        ];
        resultados.forEach((resultado, indice) => {
            document.getElementById(ids[indice]).textContent =
                resultado.error ? "—" : new Intl.NumberFormat("es-ES").format(resultado.count || 0);
        });
    }

    async function cargarUbicaciones() {
        const cuerpo = document.getElementById("tabla-ubicaciones");
        const resumen = document.getElementById("resumen-ubicaciones");
        cuerpo.innerHTML = '<tr><td colspan="7">Cargando distribución territorial…</td></tr>';
        const { data, error } = await window.supabaseClient.rpc(
            "admin_resumen_ubicaciones",
            {
                p_provincia: valor("filtro-ubicacion-provincia") || null,
                p_ciudad: terminoSeguro(valor("filtro-ubicacion-ciudad")) || null
            }
        );
        if (error) {
            ubicacionesActuales = [];
            cuerpo.innerHTML = '<tr><td colspan="7">Falta activar la vista territorial en Supabase.</td></tr>';
            resumen.textContent = "Ejecuta admin_control_total.sql para consultar los talleres por ubicación.";
            return;
        }

        ubicacionesActuales = data || [];
        const totales = ubicacionesActuales.reduce((acumulado, fila) => ({
            total: acumulado.total + Number(fila.total || 0),
            activos: acumulado.activos + Number(fila.activos || 0),
            inactivos: acumulado.inactivos + Number(fila.inactivos || 0)
        }), { total: 0, activos: 0, inactivos: 0 });
        resumen.textContent = `${ubicacionesActuales.length} ubicaciones · ${totales.total} talleres · ${totales.activos} activos · ${totales.inactivos} inactivos`;
        cuerpo.innerHTML = ubicacionesActuales.length
            ? ubicacionesActuales.map((fila) => `
                <tr>
                    <td>${escaparHtml(fila.provincia)}</td>
                    <td><strong>${escaparHtml(fila.ciudad)}</strong></td>
                    <td>${Number(fila.total || 0)}</td>
                    <td>${Number(fila.activos || 0)}</td>
                    <td>${Number(fila.inactivos || 0)}</td>
                    <td>${Number(fila.verificados || 0)}</td>
                    <td><button class="boton-enlace" type="button" data-ver-ubicacion="${escaparHtml(fila.ciudad)}" data-ver-provincia="${escaparHtml(fila.provincia)}">Ver fichas</button></td>
                </tr>
            `).join("")
            : '<tr><td colspan="7">No hay talleres en esta ubicación.</td></tr>';
    }

    function candidatoTieneCoordenadas(candidato) {
        return [candidato.latitud, candidato.longitud].every((valor) =>
            valor !== null
            && valor !== undefined
            && String(valor).trim() !== ""
            && Number.isFinite(Number(valor))
        );
    }

    function contarDatosCandidato(candidato) {
        const ubicacion = [
            candidato.direccion,
            candidato.codigo_postal,
            candidato.ciudad,
            candidato.provincia
        ].filter(Boolean).join(", ");
        const coordenadas = candidatoTieneCoordenadas(candidato);
        const web = normalizarWeb(candidato.web);
        const servicios = Array.isArray(candidato.servicios_externos)
            && candidato.servicios_externos.some(Boolean);

        return [
            ubicacion,
            candidato.telefono,
            candidato.email,
            web,
            candidato.horario_externo,
            candidato.categoria,
            candidato.marca,
            candidato.descripcion_externa,
            servicios,
            coordenadas
        ].filter(Boolean).length;
    }

    function prioridadUbicacionCandidato(candidato, poblacion, codigoPostal) {
        const etiquetas = candidato.etiquetas_osm || {};
        const poblacionFuente = [
            etiquetas["addr:city"],
            etiquetas["addr:town"],
            etiquetas["addr:village"],
            etiquetas["addr:municipality"],
            candidato.poblacion_fuente
        ].find(Boolean);
        const codigoPostalFuente =
            etiquetas["addr:postcode"]
            || candidato.codigo_postal_fuente;

        const tieneUbicacionFuente =
            Boolean(poblacionFuente || codigoPostalFuente);

        if (!tieneUbicacionFuente) return 3;

        const mismaPoblacion =
            normalizar(poblacionFuente) === normalizar(poblacion);
        const mismoCodigoPostal =
            Boolean(codigoPostal)
            && String(codigoPostalFuente || "").trim() === String(codigoPostal);

        if (mismaPoblacion && mismoCodigoPostal) return 0;
        if (mismaPoblacion) return 1;
        if (mismoCodigoPostal) return 2;

        return 4;
    }

    function tarjetaCandidato(candidato) {
        const ubicacion = [
            candidato.direccion,
            candidato.codigo_postal,
            candidato.ciudad,
            candidato.provincia
        ].filter(Boolean).join(", ");
        const coordenadas = candidatoTieneCoordenadas(candidato)
            ? `${Number(candidato.latitud).toFixed(6)}, ${Number(candidato.longitud).toFixed(6)}`
            : "";
        const web = normalizarWeb(candidato.web);
        const servicios = Array.isArray(candidato.servicios_externos)
            ? candidato.servicios_externos.filter(Boolean).join(", ")
            : "";
        const redes = Array.isArray(candidato.redes_sociales)
            ? candidato.redes_sociales.filter((red) => red?.url)
            : [];
        const camposDisponibles = contarDatosCandidato(candidato);
        const dato = (etiqueta, contenido, alternativo = "No disponible") =>
            `<p><strong>${escaparHtml(etiqueta)}:</strong> ${escaparHtml(contenido || alternativo)}</p>`;
    
        return `<article class="admin-candidato${candidato.posible_duplicado ? " admin-candidato-duplicado" : ""}" data-candidato-id="${escaparHtml(candidato.id)}">
            <div>
                <span class="admin-candidato-estado">${candidato.posible_duplicado ? "Posible duplicado" : "Candidato nuevo"} · ${camposDisponibles}/10 datos localizados</span>
                <h3>${escaparHtml(candidato.nombre)}</h3>
                ${dato("Dirección", ubicacion, "Ubicación aproximada")}
                ${dato("Categoría", candidato.categoria)}
                ${dato("Teléfono", candidato.telefono)}
                ${dato("Correo", candidato.email)}
                ${web
                    ? `<p><strong>Web:</strong> <a href="${escaparHtml(web)}" target="_blank" rel="noopener noreferrer">${escaparHtml(web)}</a></p>`
                    : dato("Web", "")}
                ${dato("Horario", candidato.horario_externo)}
                ${candidato.marca ? dato("Marca", candidato.marca) : ""}
                ${candidato.operador ? dato("Operador", candidato.operador) : ""}
                ${candidato.descripcion_externa ? dato("Descripción externa", candidato.descripcion_externa) : ""}
                ${servicios ? dato("Servicios indicados", servicios) : ""}
                ${candidato.accesibilidad ? dato("Accesibilidad", candidato.accesibilidad) : ""}
                ${coordenadas ? dato("Coordenadas", coordenadas) : ""}
                ${redes.length
                    ? `<p><strong>Redes:</strong> ${redes.map((red) => {
                        const url = normalizarWeb(red.url);
                        return `<a href="${escaparHtml(url)}" target="_blank" rel="noopener noreferrer">${escaparHtml(red.nombre)}</a>`;
                    }).join(" · ")}</p>`
                    : ""}
            </div>
            <div class="admin-candidato-acciones">
                <a class="boton-enlace" href="${escaparHtml(candidato.fuente)}" target="_blank" rel="noopener noreferrer">Comprobar fuente</a>
                <button class="boton boton-pequeno" data-accion-candidato="importar" type="button"${candidato.posible_duplicado ? " disabled" : ""}>
                    ${candidato.posible_duplicado ? "Ya puede existir" : "Pasar al editor"}
                </button>
            </div>
        </article>`;
    }
function cerrarSugerenciasPoblaciones() {
    const contenedor = document.getElementById("sugerencias-poblaciones");

    if (!contenedor) return;

    contenedor.hidden = true;
    contenedor.replaceChildren();
}

function seleccionarSugerenciaPoblacion(sugerencia) {
    const campo = document.getElementById("busqueda-internet-ubicacion");
    const estado = document.getElementById("estado-buscador-internet");

    poblacionSeleccionada = sugerencia;

    campo.value = sugerencia.texto
        || [
            sugerencia.nombre,
            sugerencia.codigo_postal,
            sugerencia.provincia
        ].filter(Boolean).join(" — ");

    campo.dataset.poblacion = sugerencia.nombre || "";
    campo.dataset.codigoPostal = sugerencia.codigo_postal || "";
    campo.dataset.provincia = sugerencia.provincia || "";

    estado.textContent = [
        `Población: ${sugerencia.nombre || "No disponible"}`,
        `Código postal: ${sugerencia.codigo_postal || "No disponible"}`,
        `Provincia: ${sugerencia.provincia || "No disponible"}`
    ].join(" · ");

    cerrarSugerenciasPoblaciones();
}

function renderizarSugerenciasPoblaciones(sugerencias) {
    const contenedor = document.getElementById("sugerencias-poblaciones");

    contenedor.replaceChildren();

    if (!Array.isArray(sugerencias) || sugerencias.length === 0) {
        contenedor.innerHTML = `
            <div class="sugerencia-poblacion sugerencia-sin-resultados">
                No se encontraron poblaciones.
            </div>
        `;

        contenedor.hidden = false;
        return;
    }

    sugerencias.forEach((sugerencia) => {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "sugerencia-poblacion";
        boton.setAttribute("role", "option");

        const origen = sugerencia.origen === "base_datos"
            ? "TallerMap"
            : "Fuente externa";

        boton.innerHTML = `
            <strong>${escaparHtml(sugerencia.nombre || "Población")}</strong>
            <span>
                ${escaparHtml(
    sugerencia.codigo_postal
    || sugerencia.codigo_municipal
    || "Sin código"
)}
                ${sugerencia.provincia
                    ? ` · ${escaparHtml(sugerencia.provincia)}`
                    : ""}
            </span>
            <small>${escaparHtml(origen)}</small>
        `;

        boton.addEventListener("click", () => {
            seleccionarSugerenciaPoblacion(sugerencia);
        });

        contenedor.appendChild(boton);
    });

    contenedor.hidden = false;
}

async function solicitarSugerenciasPoblaciones() {
    const campo = document.getElementById("busqueda-internet-ubicacion");
    const estado = document.getElementById("estado-buscador-internet");
    const consulta = campo.value.trim();

    poblacionSeleccionada = null;

    delete campo.dataset.poblacion;
    delete campo.dataset.codigoPostal;
    delete campo.dataset.provincia;

    if (consulta.length < 3) {
        cerrarSugerenciasPoblaciones();
        estado.textContent = "Escribe al menos 3 caracteres.";
        return;
    }

    estado.textContent = "Buscando poblaciones y códigos postales…";

    try {
        const termino = terminoSeguro(consulta);
        let consultaMunicipios = window.supabaseClient
            .from("municipios")
            .select("nombre,codigo_municipal")
            .eq("activo", true)
            .limit(8);

        consultaMunicipios = /^[0-9]+$/.test(termino)
            ? consultaMunicipios.ilike("codigo_municipal", `${termino}%`)
            : consultaMunicipios.ilike("nombre", `%${termino}%`);

        const { data, error } = await consultaMunicipios
            .order("nombre", { ascending: true });

        if (error) {
            console.error("Error obteniendo sugerencias:", error);

            cerrarSugerenciasPoblaciones();
            estado.textContent = "No se pudieron obtener las sugerencias.";
            return;
        }

        const sugerencias = (Array.isArray(data) ? data : []).map((municipio) => {
            const codigo = String(municipio.codigo_municipal || "");
            const provincia = window.TallerMapProvincias?.provincias
                ?.find((elemento) => elemento.codigo === codigo.slice(0, 2));
            return {
                nombre: municipio.nombre,
                codigo_municipal: codigo,
                provincia: provincia?.nombre || "",
                origen: "base_datos"
            };
        });

        renderizarSugerenciasPoblaciones(sugerencias);

        estado.textContent = sugerencias.length
            ? `${sugerencias.length} poblaciones encontradas. Selecciona una.`
            : "No se encontraron poblaciones.";
    } catch (error) {
        console.error("Error en sugerencias:", error);

        cerrarSugerenciasPoblaciones();
        estado.textContent = "No se pudieron cargar las sugerencias.";
    }
}
    async function buscarTalleresInternet(evento) { 
    evento.preventDefault();
    const campo = document.getElementById("busqueda-internet-ubicacion");
    const estado = document.getElementById("estado-buscador-internet");
    const resultados = document.getElementById("resultados-buscador-internet");
    const boton = document.getElementById("boton-buscar-internet");

    const poblacion = campo.dataset.poblacion
        || poblacionSeleccionada?.nombre
        || campo.value.split("—")[0].trim();

    const codigoPostal = campo.dataset.codigoPostal
        || poblacionSeleccionada?.codigo_postal
        || "";

    const provincia = campo.dataset.provincia
        || poblacionSeleccionada?.provincia
        || "";

    if (poblacion.length < 2) {
        estado.textContent = "Selecciona o escribe una población.";
        return;
    }

    cerrarSugerenciasPoblaciones();

    boton.disabled = true;
    boton.textContent = "Buscando…";

    estado.textContent = [
        `Buscando talleres en ${poblacion}`,
        codigoPostal ? `CP ${codigoPostal}` : "",
        provincia
    ].filter(Boolean).join(" · ");

    resultados.replaceChildren();

    const consulta = codigoPostal
        ? `${poblacion}, ${codigoPostal}`
        : poblacion;

    const { data, error } =
        await window.supabaseClient.functions.invoke(
            "buscar-talleres-internet",
            {
                body: {
                    ubicacion: consulta,
                    radio_km: 10
                }
            }
        );

    boton.disabled = false;
    boton.textContent = "Buscar candidatos";

    if (error || data?.error) {
        console.error(
            "Error en búsqueda externa:",
            error || data?.detalle || data?.error
        );

        candidatosInternet = [];

        estado.textContent =
            data?.detalle
            || data?.error
            || "No se pudo completar la búsqueda.";

        return;
    }

    candidatosInternet = Array.isArray(data?.candidatos)
        ? data.candidatos.map((candidato) => ({
            ...candidato,

            id: candidato.id
                || candidato.id_fuente,

            ciudad: candidato.ciudad
                || candidato.poblacion
                || data?.poblacion?.nombre
                || poblacion,

            codigo_postal: candidato.codigo_postal
                || data?.poblacion?.codigo_postal
                || codigoPostal,

            provincia: candidato.provincia
                || data?.poblacion?.provincia
                || provincia,

            horario_externo: candidato.horario_externo
                || candidato.horario
                || "",

            servicios_externos: candidato.servicios_externos
                || candidato.servicios
                || [],

            descripcion_externa: candidato.descripcion_externa
                || candidato.descripcion
                || "",

            fuente: candidato.fuente?.startsWith?.("http")
                ? candidato.fuente
                : candidato.url_fuente
        }))
        : [];

    candidatosInternet.sort((a, b) => {
        const diferenciaUbicacion =
            prioridadUbicacionCandidato(a, poblacion, codigoPostal)
            - prioridadUbicacionCandidato(b, poblacion, codigoPostal);

        if (diferenciaUbicacion) return diferenciaUbicacion;

        const diferenciaDatos =
            contarDatosCandidato(b) - contarDatosCandidato(a);

        if (diferenciaDatos) return diferenciaDatos;

        if (a.posible_duplicado !== b.posible_duplicado) {
            return Number(a.posible_duplicado)
                - Number(b.posible_duplicado);
        }

        const distanciaA = Number(a.distancia_centro_km);
        const distanciaB = Number(b.distancia_centro_km);

        if (Number.isFinite(distanciaA) && Number.isFinite(distanciaB)) {
            const diferenciaDistancia = distanciaA - distanciaB;

            if (diferenciaDistancia) return diferenciaDistancia;
        }

        return String(a.nombre || "").localeCompare(
            String(b.nombre || ""),
            "es"
        );
    });

    const nuevos = candidatosInternet.filter(
        (candidato) => !candidato.posible_duplicado
    ).length;

    const duplicados =
        candidatosInternet.length - nuevos;

    const poblacionResultado =
        data?.poblacion?.nombre || poblacion;

    const codigoResultado =
        data?.poblacion?.codigo_postal || codigoPostal;

    estado.textContent = [
        `${poblacionResultado}${codigoResultado ? ` — ${codigoResultado}` : ""}`,
        `${candidatosInternet.length} resultados`,
        `${nuevos} candidatos nuevos`,
        `${duplicados} posibles duplicados`
    ].join(" · ");

    resultados.innerHTML = candidatosInternet.length
        ? candidatosInternet.map(tarjetaCandidato).join("")
        : "<p>No se encontraron talleres dentro de esta población.</p>";
}
    
    function importarCandidato(candidato) {
        abrirEditor();
        document.getElementById("titulo-editor").textContent =
            `Revisar candidato: ${candidato.nombre}`;
        document.getElementById("admin-nombre").value =
            candidato.nombre === "Taller sin nombre" ? "" : candidato.nombre;
        document.getElementById("admin-telefono").value = candidato.telefono || "";
        document.getElementById("admin-web").value = candidato.web || "";
        document.getElementById("admin-direccion").value = candidato.direccion || "";
        document.getElementById("admin-codigo-postal").value = candidato.codigo_postal || "";
        document.getElementById("admin-ciudad").value = candidato.ciudad || "";
        document.getElementById("admin-descripcion").value =
            candidato.descripcion_externa
            || [
                candidato.categoria,
                candidato.marca ? `Marca: ${candidato.marca}` : "",
                Array.isArray(candidato.servicios_externos) && candidato.servicios_externos.length
                    ? `Servicios indicados: ${candidato.servicios_externos.join(", ")}`
                    : ""
            ].filter(Boolean).join(". ")
            || "Ficha incorporada desde una fuente pública. Datos pendientes de comprobación administrativa.";
        document.getElementById("admin-activo").checked = false;
        document.getElementById("admin-verificado").checked = false;
        cargarServicios(["mecanica-general"]);
        if (candidato.codigo_postal) {
            window.TallerMapProvincias?.seleccionarSegunCodigo(
                candidato.codigo_postal,
                document.getElementById("admin-provincia")
            );
        } else if (candidato.provincia) {
            const provincia = document.getElementById("admin-provincia");
            const opcion = Array.from(provincia.options).find((elemento) =>
                normalizar(elemento.textContent) === normalizar(candidato.provincia)
                || normalizar(elemento.value) === normalizar(candidato.provincia)
            );
            if (opcion) provincia.value = opcion.value;
        }
        mostrar(
            "Candidato cargado como inactivo. Completa teléfono, dirección, horarios y servicios; comprueba la fuente antes de publicarlo.",
            "aviso"
        );
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function actualizarPaginacion() {
        const paginas = Math.max(1, Math.ceil(totalFiltrado / TAMANO_PAGINA));
        if (pagina >= paginas) pagina = paginas - 1;
        document.getElementById("estado-pagina").textContent =
            `Página ${pagina + 1} de ${paginas} · ${totalFiltrado} resultados`;
        document.getElementById("pagina-anterior").disabled = pagina === 0;
        document.getElementById("pagina-siguiente").disabled = pagina + 1 >= paginas;
    }

    async function cargarTalleres() {
        ocultarMensaje();
        lista.innerHTML = '<p class="mensaje-talleres">Cargando talleres…</p>';
        const { data, error, count } = await construirConsulta();
        if (error) {
            lista.innerHTML = "";
            mostrar("No se pudieron cargar los talleres. Comprueba la configuración de Supabase.");
            return;
        }
        totalFiltrado = count || 0;
        talleresPagina = data?.length ? await adjuntarFotosFirmadas(data) : [];
        lista.innerHTML = talleresPagina.length
            ? talleresPagina.map(tarjeta).join("")
            : '<p class="mensaje-talleres">No hay talleres con estos filtros.</p>';
        actualizarPaginacion();
    }

    async function cargarTodo() {
        await Promise.all([cargarMetricas(), cargarTalleres(), cargarUbicaciones()]);
    }

    function limpiarEditor() {
        formulario.reset();
        tallerEditado = null;
        document.getElementById("titulo-editor").textContent = "Crear taller desde cero";
        document.getElementById("admin-activo").checked = true;
        document.getElementById("admin-verificado").checked = false;
        document.getElementById("admin-fotos-actuales").replaceChildren();
        document.getElementById("admin-fotos-nuevas").value = "";
        window.TallerMapProvincias?.rellenarSelect(document.getElementById("admin-provincia"));
        cargarServicios([]);
        cargarHorarios(horarioPredeterminado());
    }

    function renderizarFotosEditor(taller) {
        const contenedor = document.getElementById("admin-fotos-actuales");
        contenedor.replaceChildren();
        (taller.fotos || []).forEach((ruta, indice) => {
            const figura = document.createElement("label");
            figura.className = "admin-foto-existente";
            const url = taller.fotosFirmadas?.[indice] || "";
            figura.innerHTML = `
                ${url ? `<img src="${escaparHtml(url)}" alt="Fotografía actual ${indice + 1}">` : ""}
                <span><input type="checkbox" data-foto-ruta="${escaparHtml(ruta)}" checked> Conservar</span>
            `;
            contenedor.appendChild(figura);
        });
    }

    function abrirEditor(taller = null) {
        limpiarEditor();
        tallerEditado = taller;
        if (taller) {
            document.getElementById("titulo-editor").textContent = `Editar: ${taller.nombre}`;
            document.getElementById("admin-nombre").value = taller.nombre || "";
            document.getElementById("admin-telefono").value = taller.telefono || "";
            document.getElementById("admin-web").value = taller.web || "";
            document.getElementById("admin-direccion").value = taller.direccion || "";
            document.getElementById("admin-codigo-postal").value = taller.codigo_postal || "";
            document.getElementById("admin-ciudad").value = taller.ciudad || "";
            document.getElementById("admin-provincia").value = taller.provincia || "";
            document.getElementById("admin-descripcion").value = taller.descripcion || "";
            document.getElementById("admin-activo").checked = Boolean(taller.activo);
            document.getElementById("admin-verificado").checked = Boolean(taller.verificado);
            cargarServicios(taller.servicios);
            cargarHorarios(taller.horarios);
            renderizarFotosEditor(taller);
        }
        editor.hidden = false;
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function cerrarEditor() {
        editor.hidden = true;
        tallerEditado = null;
        ocultarMensaje();
    }

    function fotosConservadas() {
        return Array.from(
            document.querySelectorAll("#admin-fotos-actuales input[data-foto-ruta]:checked"),
            (campo) => campo.dataset.fotoRuta
        );
    }

    function fotosNuevas() {
        return Array.from(document.getElementById("admin-fotos-nuevas").files || []);
    }

    function validarFotos(archivos, existentes) {
        if (archivos.length + existentes.length > MAXIMO_FOTOS) {
            mostrar(`Solo puedes conservar y añadir un máximo de ${MAXIMO_FOTOS} fotografías.`);
            return false;
        }
        if (archivos.some((archivo) => !TIPOS_FOTO.includes(archivo.type))) {
            mostrar("Las fotografías deben ser JPG, PNG o WebP.");
            return false;
        }
        if (archivos.some((archivo) => archivo.size > MAXIMO_BYTES_FOTO)) {
            mostrar("Cada fotografía puede ocupar como máximo 5 MB.");
            return false;
        }
        return true;
    }

    function extensionFoto(archivo) {
        if (archivo.type === "image/png") return "png";
        if (archivo.type === "image/webp") return "webp";
        return "jpg";
    }

    function parametrosEditor(fotos) {
        return {
            p_taller_id: tallerEditado?.id || null,
            p_nombre: valor("admin-nombre"),
            p_propietario: null,
            p_cif: null,
            p_email: null,
            p_telefono: valor("admin-telefono"),
            p_web: normalizarWeb(valor("admin-web")) || null,
            p_direccion: valor("admin-direccion"),
            p_codigo_postal: valor("admin-codigo-postal"),
            p_ciudad: valor("admin-ciudad"),
            p_provincia: valor("admin-provincia"),
            p_horarios: horariosSeleccionados(),
            p_servicios: serviciosSeleccionados(),
            p_fotos: fotos,
            p_descripcion: valor("admin-descripcion"),
            p_verificado: document.getElementById("admin-verificado").checked,
            p_activo: document.getElementById("admin-activo").checked
        };
    }

    function mensajeError(error) {
        const detalle = String(error?.message || "").toLowerCase();
        if (detalle.includes("no autorizado")) return "Tu sesión no tiene permisos de administración.";
        if (detalle.includes("duplicado")) return "Ya existe un taller con el mismo nombre y dirección.";
        if (detalle.includes("provincia_codigo")) return "La provincia no coincide con el código postal.";
        if (detalle.includes("horarios")) return "Revisa los horarios semanales.";
        if (detalle.includes("servicios")) return "Selecciona al menos un servicio.";
        return "No se pudo guardar la ficha. Revisa todos los datos.";
    }

    async function guardarFicha(evento) {
        evento.preventDefault();
        ocultarMensaje();
        if (!formulario.checkValidity()) {
            formulario.reportValidity();
            return;
        }
        const horarios = horariosSeleccionados();
        if (!validarHorarios(horarios)) {
            mostrar("Los horarios no son válidos o no existe ningún día abierto.");
            return;
        }
        if (!serviciosSeleccionados().length) {
            mostrar("Selecciona al menos un servicio.");
            return;
        }
        if (!window.TallerMapProvincias?.coincide(
            valor("admin-codigo-postal"),
            valor("admin-provincia")
        )) {
            mostrar("La provincia no coincide con el código postal.");
            return;
        }

        const existentes = fotosConservadas();
        const archivos = fotosNuevas();
        if (!validarFotos(archivos, existentes)) return;
        const nuevas = archivos.map((archivo) => ({
            archivo,
            ruta: `admin/${crypto.randomUUID()}.${extensionFoto(archivo)}`
        }));
        const fotosFinales = [...existentes, ...nuevas.map((foto) => foto.ruta)];
        const boton = document.getElementById("boton-guardar-admin");
        boton.disabled = true;
        boton.textContent = "Guardando...";

        const parametros = parametrosEditor(fotosFinales);
        const { data: tallerId, error } = await window.supabaseClient.rpc(
            "admin_guardar_taller",
            parametros
        );
        if (error) {
            boton.disabled = false;
            boton.textContent = "Guardar ficha";
            console.error("No se pudo guardar la ficha:", error);
            mostrar(mensajeError(error));
            return;
        }

        const subidasCorrectas = [];
        for (const foto of nuevas) {
            const { error: errorFoto } = await window.supabaseClient.storage
                .from("fotos-talleres")
                .upload(foto.ruta, foto.archivo, {
                    cacheControl: "3600",
                    contentType: foto.archivo.type,
                    upsert: false
                });
            if (!errorFoto) subidasCorrectas.push(foto.ruta);
            else console.error("No se pudo subir una fotografía:", errorFoto);
        }

        if (subidasCorrectas.length !== nuevas.length) {
            await window.supabaseClient.rpc("admin_guardar_taller", {
                ...parametros,
                p_taller_id: tallerId,
                p_fotos: [...existentes, ...subidasCorrectas]
            });
        }

        const eliminadas = (tallerEditado?.fotos || []).filter(
            (ruta) => !existentes.includes(ruta)
        );
        if (eliminadas.length) {
            const { error: errorBorradoFotos } = await window.supabaseClient.storage
                .from("fotos-talleres")
                .remove(eliminadas);
            if (errorBorradoFotos) {
                console.error("No se pudieron eliminar algunas fotografías:", errorBorradoFotos);
            }
        }

        boton.disabled = false;
        boton.textContent = "Guardar ficha";
        cerrarEditor();
        mostrar(
            subidasCorrectas.length === nuevas.length
                ? "Ficha guardada correctamente."
                : "Ficha guardada, pero alguna fotografía no pudo subirse.",
            subidasCorrectas.length === nuevas.length ? "exito" : "aviso"
        );
        await cargarTodo();
        await cargarHistorial();
    }

    async function cambiarEstado(taller) {
        const accion = taller.activo ? "desactivar" : "reactivar";
        if (!window.confirm(`¿Quieres ${accion} la ficha «${taller.nombre}»?`)) return;
        const { error } = await window.supabaseClient.rpc("admin_cambiar_estado_taller", {
            p_taller_id: taller.id,
            p_activo: !taller.activo
        });
        if (error) {
            mostrar(`No se pudo ${accion} la ficha.`);
            return;
        }
        mostrar(`Ficha ${taller.activo ? "desactivada" : "reactivada"} correctamente.`, "exito");
        await cargarTodo();
        await cargarHistorial();
    }

    async function eliminarTaller(taller) {
        const confirmacion = window.prompt(
            `Esta acción borrará definitivamente «${taller.nombre}» y su solicitud original.\n\nEscribe ELIMINAR para continuar:`
        );
        if (confirmacion !== "ELIMINAR") return;

        const fotos = Array.isArray(taller.fotos) ? taller.fotos : [];
        if (fotos.length) {
            const { error: errorFotos } = await window.supabaseClient.storage
                .from("fotos-talleres")
                .remove(fotos);
            if (errorFotos) {
                mostrar("No se pudieron borrar las fotografías. La ficha no se ha eliminado.");
                return;
            }
        }
        const { error } = await window.supabaseClient.rpc("admin_eliminar_taller", {
            p_taller_id: taller.id,
            p_eliminar_solicitud: true
        });
        if (error) {
            mostrar("No se pudo eliminar la ficha.");
            return;
        }
        mostrar("La ficha se ha eliminado definitivamente.", "exito");
        await cargarTodo();
        await cargarHistorial();
    }

    function csvSeguro(valorCsv) {
        return `"${String(valorCsv ?? "").replace(/"/g, '""')}"`;
    }

    async function exportarCsv() {
        const { data, error } = await construirConsulta({ conRango: false });
        if (error) {
            mostrar("No se pudieron preparar los datos para exportar.");
            return;
        }
        const cabecera = [
            "Nombre", "Teléfono", "Web", "Dirección", "Código postal", "Población", "Provincia",
            "Servicios", "Activo", "Verificado", "Creado", "Actualizado"
        ];
        const filas = (data || []).map((taller) => [
            taller.nombre, taller.telefono, taller.web, taller.direccion, taller.codigo_postal,
            taller.ciudad, taller.provincia, (taller.servicios || []).join(" | "),
            taller.activo ? "Sí" : "No", taller.verificado ? "Sí" : "No",
            taller.created_at, taller.updated_at
        ]);
        const contenido = [cabecera, ...filas]
            .map((fila) => fila.map(csvSeguro).join(";"))
            .join("\r\n");
        const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" });
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(blob);
        enlace.download = `tallermap-talleres-${new Date().toISOString().slice(0, 10)}.csv`;
        enlace.click();
        URL.revokeObjectURL(enlace.href);
    }

    function exportarUbicacionesCsv() {
        if (!ubicacionesActuales.length) {
            mostrar("No hay ubicaciones para exportar.", "aviso");
            return;
        }
        const cabecera = [
            "Provincia", "Población", "Total", "Activos", "Inactivos",
            "Verificados", "No verificados"
        ];
        const filas = ubicacionesActuales.map((fila) => [
            fila.provincia, fila.ciudad, fila.total, fila.activos, fila.inactivos,
            fila.verificados, fila.no_verificados
        ]);
        const contenido = [cabecera, ...filas]
            .map((fila) => fila.map(csvSeguro).join(";"))
            .join("\r\n");
        const blob = new Blob([`\uFEFF${contenido}`], { type: "text/csv;charset=utf-8" });
        const enlace = document.createElement("a");
        enlace.href = URL.createObjectURL(blob);
        enlace.download = `tallermap-ubicaciones-${new Date().toISOString().slice(0, 10)}.csv`;
        enlace.click();
        URL.revokeObjectURL(enlace.href);
    }

    async function cargarHistorial() {
        const contenedor = document.getElementById("lista-historial");
        contenedor.innerHTML = "<p>Cargando actividad…</p>";
        const { data, error } = await window.supabaseClient
            .from("taller_historial")
            .select("id,taller_id,nombre_taller,accion,tipo_actor,created_at")
            .order("created_at", { ascending: false })
            .limit(30);
        if (error) {
            contenedor.innerHTML = "<p>Falta activar el historial administrativo en Supabase.</p>";
            return;
        }
        contenedor.innerHTML = (data || []).length
            ? data.map((registro) => `
                <div class="admin-historial-fila">
                    <strong>${escaparHtml(registro.nombre_taller || "Taller eliminado")}</strong>
                    <span>${escaparHtml(registro.accion)} por ${escaparHtml(registro.tipo_actor)}</span>
                    <time>${escaparHtml(formatoFecha(registro.created_at))}</time>
                </div>
            `).join("")
            : "<p>Todavía no hay acciones registradas.</p>";
    }

    lista.addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;
        const id = boton.closest("[data-taller-id]")?.dataset.tallerId;
        const taller = talleresPagina.find((elemento) => elemento.id === id);
        if (!taller) return;
        if (boton.dataset.accion === "editar") abrirEditor(taller);
        if (boton.dataset.accion === "estado") cambiarEstado(taller);
        if (boton.dataset.accion === "eliminar") eliminarTaller(taller);
    });

    listaHorarios.addEventListener("change", (evento) => {
        const fila = evento.target.closest("[data-dia]");
        if (fila) actualizarFilaHorario(fila);
    });
    document.getElementById("admin-codigo-postal").addEventListener("input", async (evento) => {
        evento.target.value = evento.target.value.replace(/\D/g, "").slice(0, 5);
        if (evento.target.value.length === 5) await comprobarPostal(true);
    });
    document.getElementById("admin-copiar-horario").addEventListener("click", () => {
        const filas = Array.from(listaHorarios.querySelectorAll("[data-dia]"));
        const valores = Array.from(filas[0].querySelectorAll("select"), (select) => select.value);
        filas.slice(1, 5).forEach((fila) => {
            fila.querySelectorAll("select").forEach((select, indice) => {
                select.value = valores[indice] || "";
            });
            actualizarFilaHorario(fila);
            fila.querySelectorAll("select").forEach((select, indice) => {
                select.value = valores[indice] || "";
            });
        });
    });
    document.getElementById("admin-cerrar-fin-semana").addEventListener("click", () => {
        ["sabado", "domingo"].forEach((dia) => {
            const fila = listaHorarios.querySelector(`[data-dia="${dia}"]`);
            fila.querySelector('[data-turno="apertura-1"]').value = "cerrado";
            actualizarFilaHorario(fila);
        });
    });

    formulario.addEventListener("submit", guardarFicha);
    document.getElementById("boton-nuevo-taller").addEventListener("click", () => abrirEditor());
    document.getElementById("boton-cancelar-editor").addEventListener("click", cerrarEditor);
    document.getElementById("boton-cancelar-admin").addEventListener("click", cerrarEditor);
    document.getElementById("boton-recargar").addEventListener("click", cargarTodo);
    document.getElementById("boton-exportar").addEventListener("click", exportarCsv);
    document.getElementById("boton-exportar-ubicaciones").addEventListener("click", exportarUbicacionesCsv);
    document.getElementById("boton-recargar-historial").addEventListener("click", cargarHistorial);
    document.getElementById("boton-limpiar-ubicacion").addEventListener("click", () => {
        document.getElementById("filtro-ubicacion-provincia").value = "";
        document.getElementById("filtro-ubicacion-ciudad").value = "";
        cargarUbicaciones();
    });
    document.getElementById("tabla-ubicaciones").addEventListener("click", (evento) => {
        const boton = evento.target.closest("[data-ver-ubicacion]");
        if (!boton) return;
        document.getElementById("filtro-busqueda").value = boton.dataset.verUbicacion;
        pagina = 0;
        cargarTalleres();
        lista.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const campoBusquedaInternet =
    document.getElementById("busqueda-internet-ubicacion");

campoBusquedaInternet.addEventListener("input", () => {
    clearTimeout(temporizadorSugerencias);

    temporizadorSugerencias = setTimeout(
        solicitarSugerenciasPoblaciones,
        400
    );
});

campoBusquedaInternet.addEventListener("focus", () => {
    if (campoBusquedaInternet.value.trim().length >= 3) {
        solicitarSugerenciasPoblaciones();
    }
});

document.addEventListener("click", (evento) => {
    const dentroDelCampo = evento.target.closest(
        "#busqueda-internet-ubicacion"
    );

    const dentroDeLaLista = evento.target.closest(
        "#sugerencias-poblaciones"
    );

    if (!dentroDelCampo && !dentroDeLaLista) {
        cerrarSugerenciasPoblaciones();
    }
});
    document.getElementById("formulario-buscador-internet").addEventListener(
        "submit",
        buscarTalleresInternet
    );
    document.getElementById("resultados-buscador-internet").addEventListener(
        "click",
        (evento) => {
            const boton = evento.target.closest("[data-accion-candidato='importar']");
            if (!boton) return;
            const id = boton.closest("[data-candidato-id]")?.dataset.candidatoId;
            const candidato = candidatosInternet.find((elemento) => elemento.id === id);
            if (candidato && !candidato.posible_duplicado) importarCandidato(candidato);
        }
    );
    document.getElementById("pagina-anterior").addEventListener("click", () => {
        if (pagina > 0) {
            pagina -= 1;
            cargarTalleres();
        }
    });
    document.getElementById("pagina-siguiente").addEventListener("click", () => {
        if ((pagina + 1) * TAMANO_PAGINA < totalFiltrado) {
            pagina += 1;
            cargarTalleres();
        }
    });

    let temporizadorBusqueda;
    ["filtro-estado", "filtro-verificacion", "filtro-orden"].forEach((id) => {
        document.getElementById(id).addEventListener("change", () => {
            pagina = 0;
            cargarTalleres();
        });
    });
    document.getElementById("filtro-busqueda").addEventListener("input", () => {
        clearTimeout(temporizadorBusqueda);
        temporizadorBusqueda = setTimeout(() => {
            pagina = 0;
            cargarTalleres();
        }, 350);
    });
    document.getElementById("filtro-ubicacion-provincia").addEventListener("change", cargarUbicaciones);
    let temporizadorUbicacion;
    document.getElementById("filtro-ubicacion-ciudad").addEventListener("input", () => {
        clearTimeout(temporizadorUbicacion);
        temporizadorUbicacion = setTimeout(cargarUbicaciones, 300);
    });
    document.getElementById("boton-cerrar-sesion").addEventListener("click", async () => {
        await window.supabaseClient.auth.signOut();
        window.location.replace("admin-login.html");
    });

    crearHorarios();
    window.TallerMapServicios?.rellenarCheckboxes(
        document.getElementById("admin-lista-servicios")
    );
    window.TallerMapProvincias?.rellenarSelect(
        document.getElementById("admin-provincia")
    );
    window.TallerMapProvincias?.rellenarSelect(
        document.getElementById("filtro-ubicacion-provincia")
    );

    (async function iniciar() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            window.location.replace("admin-login.html");
            return;
        }
        const { data: esAdministrador, error } =
            await window.supabaseClient.rpc("es_administrador");
        if (error || !esAdministrador) {
            await window.supabaseClient.auth.signOut();
            window.location.replace("admin-login.html");
            return;
        }
        await cargarTodo();
        await cargarHistorial();
    }());
}());
