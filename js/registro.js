(() => {
    "use strict";

    const formulario = document.getElementById("formulario-registro");
    const botonEnviar = document.getElementById("boton-enviar");
    const mensajeFormulario = document.getElementById("mensaje-formulario");
    const campoFotos = document.getElementById("fotos");
    const vistaPreviaFotos = document.getElementById("vista-previa-fotos");
    const campoCondicionesFotos = document.getElementById("acepta_condiciones_fotos");
    const listaHorarios = document.getElementById("lista-horarios");
    const campoCodigoPostal = document.getElementById("codigo_postal");
    const campoCiudad = document.getElementById("ciudad");
    const campoProvincia = document.getElementById("provincia");
    const estadoLocalidad = document.getElementById("estado-localidad");
    const listaLocalidades = document.getElementById("localidades-codigo-postal");
    const campoWeb = document.getElementById("web");
    const pasosFormulario = Array.from(formulario?.querySelectorAll("[data-paso]") || []);
    const indicadoresPaso = Array.from(formulario?.querySelectorAll("[data-indicador-paso]") || []);
    const resumenAlta = document.getElementById("resumen-alta");
    const DIAS_SEMANA = [
        ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
        ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
        ["domingo", "Domingo"]
    ];
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
    const MAXIMO_FOTOS = 5;
    const MAXIMO_BYTES_FOTO = 5 * 1024 * 1024;
    let urlsVistaPrevia = [];
    let temporizadorCodigoPostal = null;
    let pasoActual = 1;
    const localidadesPorCodigo = new Map();

    if (!formulario || !botonEnviar || !mensajeFormulario) {
        console.error("El formulario de registro no está completo en la página.");
        return;
    }

    function valor(idCampo) {
        return document.getElementById(idCampo)?.value.trim() || "";
    }

    function normalizarTexto(valorTexto) {
        return String(valorTexto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("es")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\b(el|la|los|las)\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizarWeb(web) {
        const valorWeb = String(web || "").trim();
        if (!valorWeb) return "";
        return /^https?:\/\//i.test(valorWeb) ? valorWeb : `https://${valorWeb}`;
    }

    function webValida(web) {
        if (!web) return true;
        try {
            const url = new URL(web);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_error) {
            return false;
        }
    }

    function serviciosSeleccionados() {
        return Array.from(
            formulario.querySelectorAll('input[name="servicios"]:checked'),
            (campo) => campo.value
        );
    }

    function opcionesHoras(incluirCerrado = false, incluirVacio = false) {
        const opciones = [];
        if (incluirVacio) opciones.push('<option value="">Sin segundo turno</option>');
        else opciones.push('<option value="">Elige…</option>');
        if (incluirCerrado) opciones.push('<option value="cerrado">Cerrado</option>');
        for (let hora = 0; hora < 24; hora += 1) {
            for (const minutos of ["00", "30"]) {
                const valorHora = `${String(hora).padStart(2, "0")}:${minutos}`;
                opciones.push(`<option value="${valorHora}">${valorHora}</option>`);
            }
        }
        if (!incluirCerrado) opciones.push('<option value="24:00">24:00</option>');
        return opciones.join("");
    }

    function crearCamposHorarios() {
        if (!listaHorarios) return;
        listaHorarios.innerHTML = DIAS_SEMANA.map(([clave, etiqueta]) => `
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

    function copiarHorarioFila(origen, destino) {
        const turnos = ["apertura-1", "cierre-1", "apertura-2", "cierre-2"];
        turnos.forEach((turno) => {
            const campoOrigen = origen?.querySelector(`[data-turno="${turno}"]`);
            const campoDestino = destino?.querySelector(`[data-turno="${turno}"]`);
            if (campoOrigen && campoDestino) campoDestino.value = campoOrigen.value;
        });
        if (destino) actualizarFilaHorario(destino);
    }

    function copiarLunesALaborables() {
        const lunes = listaHorarios?.querySelector('[data-dia="lunes"]');
        const apertura = lunes?.querySelector('[data-turno="apertura-1"]')?.value;
        if (!apertura) {
            mostrarMensaje("Selecciona primero el horario del lunes.", "error");
            lunes?.querySelector('[data-turno="apertura-1"]')?.focus();
            return;
        }
        ["martes", "miercoles", "jueves", "viernes"].forEach((dia) => {
            copiarHorarioFila(lunes, listaHorarios?.querySelector(`[data-dia="${dia}"]`));
        });
        ocultarMensaje();
    }

    function cerrarFinDeSemana() {
        ["sabado", "domingo"].forEach((dia) => {
            const fila = listaHorarios?.querySelector(`[data-dia="${dia}"]`);
            const apertura = fila?.querySelector('[data-turno="apertura-1"]');
            if (apertura) apertura.value = "cerrado";
            if (fila) actualizarFilaHorario(fila);
        });
        ocultarMensaje();
    }

    function horariosSeleccionados() {
        const horarios = {};
        listaHorarios?.querySelectorAll("[data-dia]").forEach((fila) => {
            const dia = fila.dataset.dia;
            const apertura1 = fila.querySelector('[data-turno="apertura-1"]').value;
            const cierre1 = fila.querySelector('[data-turno="cierre-1"]').value;
            const apertura2 = fila.querySelector('[data-turno="apertura-2"]').value;
            const cierre2 = fila.querySelector('[data-turno="cierre-2"]').value;
            horarios[dia] = apertura1 === "cerrado"
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
        const dias = Object.entries(horarios);
        if (dias.length !== 7 || dias.some(([, horario]) => !horario.cerrado
            && (!horario.turnos[0]?.apertura || !horario.turnos[0]?.cierre))) {
            mostrarMensaje("Selecciona un horario o «Cerrado» para todos los días.", "error");
            document.getElementById("horarios-semanales")?.scrollIntoView({ behavior: "smooth", block: "center" });
            return false;
        }
        if (!dias.some(([, horario]) => !horario.cerrado)) {
            mostrarMensaje("El taller debe tener al menos un día abierto.", "error");
            return false;
        }
        for (const [, horario] of dias) {
            for (let indice = 0; indice < horario.turnos.length; indice += 1) {
                const turno = horario.turnos[indice];
                if (turno.cierre <= turno.apertura) {
                    mostrarMensaje("La hora de cierre debe ser posterior a la hora de apertura.", "error");
                    return false;
                }
                if (indice === 1 && turno.apertura < horario.turnos[0].cierre) {
                    mostrarMensaje("El segundo turno debe empezar después de terminar el primero.", "error");
                    return false;
                }
            }
        }
        return true;
    }

    function mostrarMensaje(texto, tipo) {
        mensajeFormulario.textContent = texto;
        mensajeFormulario.className = `mensaje-formulario mensaje-${tipo}`;
        mensajeFormulario.hidden = false;
        mensajeFormulario.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function ocultarMensaje() {
        mensajeFormulario.textContent = "";
        mensajeFormulario.className = "mensaje-formulario";
        mensajeFormulario.hidden = true;
    }

    function enfocar(idCampo) {
        document.getElementById(idCampo)?.focus();
    }

    function mostrarPaso(numero, enfocarTitulo = true) {
        pasoActual = Math.min(3, Math.max(1, Number(numero) || 1));
        formulario.dataset.pasoActual = String(pasoActual);

        pasosFormulario.forEach((paso) => {
            paso.hidden = Number(paso.dataset.paso) !== pasoActual;
        });

        indicadoresPaso.forEach((indicador) => {
            const numeroIndicador = Number(indicador.dataset.indicadorPaso);
            indicador.classList.toggle("completado", numeroIndicador < pasoActual);
            indicador.classList.toggle("activo", numeroIndicador === pasoActual);
            if (numeroIndicador === pasoActual) indicador.setAttribute("aria-current", "step");
            else indicador.removeAttribute("aria-current");
        });

        ocultarMensaje();
        if (enfocarTitulo) {
            const titulo = formulario.querySelector(`[data-paso="${pasoActual}"] h2`);
            if (titulo) {
                titulo.tabIndex = -1;
                titulo.focus({ preventScroll: true });
                formulario.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    }

    function validarCamposNativos(numeroPaso) {
        const paso = formulario.querySelector(`[data-paso="${numeroPaso}"]`);
        const invalido = Array.from(
            paso?.querySelectorAll("input, select, textarea") || []
        ).find((campo) => !campo.disabled && !campo.checkValidity());

        if (!invalido) return true;
        invalido.reportValidity();
        invalido.focus();
        return false;
    }

    async function validarPaso(numeroPaso) {
        ocultarMensaje();

        if (numeroPaso === 1) {
            if (campoWeb) campoWeb.value = normalizarWeb(campoWeb.value);
            if (!validarCamposNativos(1)) return false;

            const codigoPostal = valor("codigo_postal");
            const provinciaEsperada = window.TallerMapProvincias?.provinciaPorCodigoPostal(codigoPostal);
            if (!provinciaEsperada || provinciaEsperada.nombre !== valor("provincia")) {
                mostrarMensaje(
                    provinciaEsperada
                        ? `El código postal ${codigoPostal} pertenece a ${provinciaEsperada.nombre}. Selecciona esa provincia.`
                        : "El código postal no pertenece a una provincia española válida.",
                    "error"
                );
                campoProvincia?.focus();
                return false;
            }

            return validarLocalidadCodigoPostal(codigoPostal, valor("ciudad"));
        }

        if (numeroPaso === 2) {
            if (!validarCamposNativos(2)) return false;
            if (!serviciosSeleccionados().length) {
                mostrarMensaje("Selecciona al menos un servicio ofrecido por el taller.", "error");
                document.getElementById("lista-servicios-registro")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                return false;
            }
            if (!validarHorarios(horariosSeleccionados())) return false;
            return validarFotos(fotosSeleccionadas());
        }

        return validarCamposNativos(3);
    }

    function agregarDatoResumen(lista, etiqueta, contenido) {
        const grupo = document.createElement("div");
        const termino = document.createElement("dt");
        const dato = document.createElement("dd");
        termino.textContent = etiqueta;
        dato.textContent = contenido || "No indicado";
        grupo.append(termino, dato);
        lista.appendChild(grupo);
    }

    function actualizarResumen() {
        if (!resumenAlta) return;
        const horarios = horariosSeleccionados();
        const diasAbiertos = Object.values(horarios).filter((horario) => !horario.cerrado).length;
        const servicios = serviciosSeleccionados();
        const fotos = fotosSeleccionadas();
        const lista = document.createElement("dl");

        agregarDatoResumen(lista, "Taller", valor("nombre_taller"));
        agregarDatoResumen(lista, "Teléfono", valor("telefono"));
        agregarDatoResumen(
            lista,
            "Ubicación",
            [valor("direccion"), valor("codigo_postal"), valor("ciudad"), valor("provincia")]
                .filter(Boolean)
                .join(", ")
        );
        agregarDatoResumen(
            lista,
            "Servicios",
            `${servicios.length} ${servicios.length === 1 ? "seleccionado" : "seleccionados"}`
        );
        agregarDatoResumen(
            lista,
            "Horario",
            `${diasAbiertos} ${diasAbiertos === 1 ? "día abierto" : "días abiertos"} por semana`
        );
        agregarDatoResumen(
            lista,
            "Fotografías",
            fotos.length ? `${fotos.length} adjuntas` : "Sin fotografías"
        );

        resumenAlta.replaceChildren(lista);
    }

    function cambiarEstadoBoton(enviando, texto = "Enviando...") {
        botonEnviar.disabled = enviando;
        botonEnviar.textContent = enviando ? texto : "Enviar solicitud gratuita";
    }

    function mostrarEstadoCampo(elemento, texto, tipo = "") {
        if (!elemento) return;
        elemento.textContent = texto;
        elemento.className = `campo-estado${tipo ? ` campo-estado-${tipo}` : ""}`;
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
            if (respuesta.status === 404) {
                localidadesPorCodigo.set(codigoPostal, []);
                return [];
            }
            if (!respuesta.ok) throw new Error(`postal-${respuesta.status}`);
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

    function rellenarLocalidades(localidades) {
        if (!listaLocalidades) return;
        listaLocalidades.replaceChildren();
        localidades.forEach((localidad) => {
            const opcion = document.createElement("option");
            opcion.value = localidad;
            listaLocalidades.appendChild(opcion);
        });
    }

    async function comprobarCodigoPostal(completarCiudad = true) {
        const codigoPostal = campoCodigoPostal?.value.trim() || "";
        if (!/^[0-9]{5}$/.test(codigoPostal)) {
            rellenarLocalidades([]);
            mostrarEstadoCampo(
                estadoLocalidad,
                "El código postal debe tener exactamente cinco números.",
                codigoPostal ? "error" : ""
            );
            return null;
        }

        mostrarEstadoCampo(estadoLocalidad, "Comprobando código postal y población…", "cargando");
        try {
            const localidades = await consultarLocalidades(codigoPostal);
            rellenarLocalidades(localidades);
            if (!localidades.length) {
                mostrarEstadoCampo(
                    estadoLocalidad,
                    "No encontramos ese código postal en España.",
                    "error"
                );
                return [];
            }
            if (completarCiudad && campoCiudad && !campoCiudad.value.trim()) {
                campoCiudad.value = localidades[0];
            }
            mostrarEstadoCampo(
                estadoLocalidad,
                localidades.length === 1
                    ? `✓ Código postal correspondiente a ${localidades[0]}.`
                    : `✓ Poblaciones admitidas: ${localidades.join(", ")}.`,
                "exito"
            );
            return localidades;
        } catch (error) {
            console.error("No se pudo comprobar el código postal:", error);
            mostrarEstadoCampo(
                estadoLocalidad,
                "No se pudo comprobar ahora la población. Revisa tu conexión e inténtalo de nuevo.",
                "error"
            );
            return null;
        }
    }

    async function validarLocalidadCodigoPostal(codigoPostal, ciudad) {
        const localidades = await comprobarCodigoPostal(false);
        if (!localidades?.length) {
            mostrarMensaje(
                "No podemos confirmar la población para ese código postal. Revísalo o inténtalo de nuevo.",
                "error"
            );
            campoCodigoPostal?.focus();
            return false;
        }
        const ciudadNormalizada = normalizarTexto(ciudad);
        const coincide = localidades.some((localidad) => {
            const localidadNormalizada = normalizarTexto(localidad);
            return ciudadNormalizada === localidadNormalizada
                || ciudadNormalizada.includes(localidadNormalizada)
                || localidadNormalizada.includes(ciudadNormalizada);
        });
        if (!coincide) {
            mostrarMensaje(
                `La población «${ciudad}» no coincide con el código postal ${codigoPostal}. Selecciona una de las poblaciones sugeridas.`,
                "error"
            );
            campoCiudad?.focus();
            return false;
        }
        return true;
    }

    function fotosSeleccionadas() {
        return Array.from(campoFotos?.files || []);
    }

    function validarFotos(archivos, comprobarCondiciones = true) {
        if (archivos.length > MAXIMO_FOTOS) {
            mostrarMensaje(`Puedes añadir un máximo de ${MAXIMO_FOTOS} fotografías.`, "error");
            campoFotos?.focus();
            return false;
        }
        if (archivos.some((archivo) => !TIPOS_FOTO.includes(archivo.type))) {
            mostrarMensaje("Las fotografías deben estar en formato JPG, PNG o WebP.", "error");
            campoFotos?.focus();
            return false;
        }
        const demasiadoGrande = archivos.find((archivo) => archivo.size > MAXIMO_BYTES_FOTO);
        if (demasiadoGrande) {
            mostrarMensaje(`La fotografía «${demasiadoGrande.name}» supera el límite de 5 MB.`, "error");
            campoFotos?.focus();
            return false;
        }
        if (comprobarCondiciones && archivos.length && !campoCondicionesFotos?.checked) {
            mostrarMensaje("Para añadir fotografías debes aceptar sus condiciones adicionales.", "error");
            campoCondicionesFotos?.focus();
            return false;
        }
        return true;
    }

    function limpiarVistaPrevia() {
        urlsVistaPrevia.forEach((url) => URL.revokeObjectURL(url));
        urlsVistaPrevia = [];
        vistaPreviaFotos?.replaceChildren();
    }

    function mostrarVistaPrevia(archivos) {
        limpiarVistaPrevia();
        if (!vistaPreviaFotos) return;
        archivos.forEach((archivo) => {
            const url = URL.createObjectURL(archivo);
            urlsVistaPrevia.push(url);
            const figura = document.createElement("figure");
            figura.className = "foto-previa";
            const imagen = document.createElement("img");
            imagen.src = url;
            imagen.alt = "Vista previa de fotografía seleccionada";
            const nombre = document.createElement("figcaption");
            nombre.textContent = archivo.name;
            figura.append(imagen, nombre);
            vistaPreviaFotos.appendChild(figura);
        });
    }

    function identificadorAleatorio() {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (caracter) => {
            const numero = Math.floor(Math.random() * 16);
            const valor = caracter === "x" ? numero : (numero & 0x3) | 0x8;
            return valor.toString(16);
        });
    }

    function extensionFoto(archivo) {
        return archivo.type === "image/png"
            ? "png"
            : archivo.type === "image/webp" ? "webp" : "jpg";
    }

    function prepararSubidas(archivos) {
        const carpeta = identificadorAleatorio();
        return archivos.map((archivo, indice) => ({
            archivo,
            ruta: `solicitudes/${carpeta}/${String(indice + 1).padStart(2, "0")}-${identificadorAleatorio()}.${extensionFoto(archivo)}`
        }));
    }

    async function subirFotos(subidas) {
        const fallidas = [];
        const correctas = [];
        for (const subida of subidas) {
            const { error } = await window.supabaseClient.storage
                .from("fotos-talleres")
                .upload(subida.ruta, subida.archivo, {
                    cacheControl: "3600",
                    contentType: subida.archivo.type,
                    upsert: false
                });
            if (error) {
                console.error("No se pudo subir una fotografía:", error);
                fallidas.push(subida.ruta);
            } else {
                correctas.push(subida.ruta);
            }
        }
        return { correctas, fallidas };
    }

    function validar(datos) {
        if (datos.nombre_taller.length < 2) {
            mostrarMensaje("Escribe el nombre del taller.", "error");
            enfocar("nombre_taller");
            return false;
        }
        if (datos.telefono.replace(/\D/g, "").length < 9) {
            mostrarMensaje("Escribe un teléfono válido de al menos 9 cifras.", "error");
            enfocar("telefono");
            return false;
        }
        if (!webValida(datos.web)) {
            mostrarMensaje("Escribe una página web válida o deja el campo vacío.", "error");
            enfocar("web");
            return false;
        }
        if (datos.direccion.length < 5) {
            mostrarMensaje("Escribe la dirección completa del taller.", "error");
            enfocar("direccion");
            return false;
        }
        if (!/^[0-9]{5}$/.test(datos.codigo_postal)) {
            mostrarMensaje("El código postal debe contener exactamente 5 números.", "error");
            enfocar("codigo_postal");
            return false;
        }
        if (datos.ciudad.length < 2 || datos.provincia.length < 2) {
            mostrarMensaje("Completa correctamente la ciudad y la provincia.", "error");
            enfocar(datos.ciudad.length < 2 ? "ciudad" : "provincia");
            return false;
        }
        const provinciaEsperada = window.TallerMapProvincias?.provinciaPorCodigoPostal(
            datos.codigo_postal
        );
        if (!provinciaEsperada || provinciaEsperada.nombre !== datos.provincia) {
            const detalle = provinciaEsperada
                ? `El código postal ${datos.codigo_postal} pertenece a ${provinciaEsperada.nombre}.`
                : "El código postal no pertenece a una provincia española válida.";
            mostrarMensaje(`${detalle} Selecciona la provincia correcta.`, "error");
            enfocar("provincia");
            return false;
        }
        if (!datos.servicios.length) {
            mostrarMensaje("Selecciona al menos un servicio ofrecido por el taller.", "error");
            document.getElementById("lista-servicios-registro")?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            return false;
        }
        if (!validarHorarios(datos.horarios)) return false;
        if (datos.descripcion.length < 10) {
            mostrarMensaje("La descripción debe contener al menos 10 caracteres.", "error");
            enfocar("descripcion");
            return false;
        }
        if (!datos.acepta_privacidad) {
            mostrarMensaje("Debes leer y aceptar la política de privacidad.", "error");
            enfocar("acepta_privacidad");
            return false;
        }
        if (!datos.acepta_responsabilidad) {
            mostrarMensaje("Debes aceptar las condiciones de publicación.", "error");
            enfocar("acepta_responsabilidad");
            return false;
        }
        return true;
    }

    function mensajeErrorSupabase(error) {
        const detalle = String(error?.message || "").toLowerCase();

        if (error?.code === "42501" || detalle.includes("permission denied")) {
            return "Supabase todavía no tiene aplicada la configuración del formulario sin correo.";
        }
        if (detalle.includes("row-level security")) {
            return "La solicitud ha sido bloqueada por la política de seguridad de Supabase.";
        }
        if (error?.code === "23505" || detalle.includes("duplicate")) {
            return "Ya existe una solicitud con esos datos.";
        }
        if (detalle.includes("limite_altas") || detalle.includes("demasiadas altas")) {
            return "Has alcanzado el límite de tres altas en 24 horas. Si gestionas más talleres, contacta con TallerMap.";
        }
        if (detalle.includes("localidad_no_verificada")) {
            return "La población no coincide con el código postal indicado.";
        }
        if (detalle.includes("provincia_codigo_postal")) {
            return "La provincia seleccionada no coincide con el código postal.";
        }
        if (detalle.includes("web_url_valida")) {
            return "La página web indicada no tiene una dirección válida.";
        }
        if (detalle.includes("fotos")) {
            return "Falta activar la configuración de fotografías en Supabase.";
        }
        if (detalle.includes("horarios")) {
            return "Falta activar la configuración de horarios obligatorios en Supabase.";
        }
        if (error?.code === "23514" || detalle.includes("check constraint")) {
            return "Uno de los datos no cumple los requisitos. Revisa el teléfono, la dirección y el código postal.";
        }
        return "No se pudo enviar la solicitud. Inténtalo de nuevo dentro de unos minutos.";
    }

    function columnaOpcionalAusente(error) {
        const detalle = String(error?.message || "").toLowerCase();
        const opcionales = [
            "servicios",
            "web",
            "acepta_responsabilidad",
            "acepta_terminos_at",
            "version_terminos"
        ];
        return opcionales.find((columna) => detalle.includes(columna)) || null;
    }

    async function insertarSolicitud(datos) {
        const datosCompatibles = { ...datos };
        let resultado;

        // Compatibilidad temporal: elimina únicamente una columna opcional que
        // aún no exista, manteniendo la aceptación de condiciones si ya está creada.
        for (let intento = 0; intento < 5; intento += 1) {
            resultado = await window.supabaseClient
                .from("solicitudes_alta_taller")
                .insert([datosCompatibles]);

            if (!resultado.error) return resultado;

            const columnaAusente = columnaOpcionalAusente(resultado.error);
            if (!columnaAusente || !(columnaAusente in datosCompatibles)) {
                return resultado;
            }
            delete datosCompatibles[columnaAusente];
        }

        return resultado;
    }

    crearCamposHorarios();
    listaHorarios?.addEventListener("change", (evento) => {
        const fila = evento.target.closest("[data-dia]");
        if (fila) actualizarFilaHorario(fila);
    });

    campoCodigoPostal?.addEventListener("input", () => {
        clearTimeout(temporizadorCodigoPostal);
        localidadesPorCodigo.delete(campoCodigoPostal.value);
        rellenarLocalidades([]);
        if (/^[0-9]{5}$/.test(campoCodigoPostal.value)) {
            window.TallerMapProvincias?.seleccionarSegunCodigo(
                campoCodigoPostal.value,
                campoProvincia
            );
            temporizadorCodigoPostal = setTimeout(() => comprobarCodigoPostal(true), 350);
        } else {
            mostrarEstadoCampo(
                estadoLocalidad,
                "Escribe primero el código postal para comprobar las poblaciones correspondientes."
            );
        }
    });

    campoCiudad?.addEventListener("blur", () => {
        if (/^[0-9]{5}$/.test(campoCodigoPostal?.value || "")) {
            comprobarCodigoPostal(false);
        }
    });

    campoWeb?.addEventListener("blur", () => {
        campoWeb.value = normalizarWeb(campoWeb.value);
    });

    document.getElementById("copiar-horario-laborables")?.addEventListener("click", copiarLunesALaborables);
    document.getElementById("cerrar-fin-semana")?.addEventListener("click", cerrarFinDeSemana);

    formulario.querySelectorAll("[data-siguiente-paso]").forEach((boton) => {
        boton.addEventListener("click", async () => {
            boton.disabled = true;
            try {
                if (!await validarPaso(pasoActual)) return;
                const destino = Number(boton.dataset.siguientePaso);
                if (destino === 3) actualizarResumen();
                mostrarPaso(destino);
            } finally {
                boton.disabled = false;
            }
        });
    });

    formulario.querySelectorAll("[data-anterior-paso]").forEach((boton) => {
        boton.addEventListener("click", () => mostrarPaso(Number(boton.dataset.anteriorPaso)));
    });

    campoFotos?.addEventListener("change", () => {
        ocultarMensaje();
        const archivos = fotosSeleccionadas();
        if (campoCondicionesFotos) {
            campoCondicionesFotos.disabled = archivos.length === 0;
            campoCondicionesFotos.required = archivos.length > 0;
            if (!archivos.length) campoCondicionesFotos.checked = false;
        }
        if (!validarFotos(archivos, false)) {
            campoFotos.value = "";
            if (campoCondicionesFotos) {
                campoCondicionesFotos.checked = false;
                campoCondicionesFotos.disabled = true;
                campoCondicionesFotos.required = false;
            }
            limpiarVistaPrevia();
            return;
        }
        mostrarVistaPrevia(archivos);
    });

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarMensaje();

        if (valor("empresa_url")) {
            mostrarMensaje("Alta recibida correctamente.", "exito");
            return;
        }

        if (campoWeb) campoWeb.value = normalizarWeb(campoWeb.value);

        if (pasoActual < 3) {
            if (!await validarPaso(pasoActual)) return;
            const destino = pasoActual + 1;
            if (destino === 3) actualizarResumen();
            mostrarPaso(destino);
            return;
        }

        if (!formulario.checkValidity()) {
            const campoInvalido = formulario.querySelector(":invalid");
            const pasoInvalido = Number(campoInvalido?.closest("[data-paso]")?.dataset.paso || 3);
            mostrarPaso(pasoInvalido, false);
            campoInvalido?.reportValidity();
            campoInvalido?.focus();
            return;
        }

        const archivos = fotosSeleccionadas();
        if (!validarFotos(archivos)) return;
        const subidas = prepararSubidas(archivos);
        const datos = {
            nombre_taller: valor("nombre_taller"),
            telefono: valor("telefono"),
            web: normalizarWeb(valor("web")),
            direccion: valor("direccion"),
            codigo_postal: valor("codigo_postal"),
            ciudad: valor("ciudad"),
            provincia: valor("provincia"),
            horarios: horariosSeleccionados(),
            servicios: serviciosSeleccionados(),
            fotos: subidas.map((subida) => subida.ruta),
            acepta_condiciones_fotos: subidas.length > 0 && campoCondicionesFotos.checked,
            acepta_condiciones_fotos_at: subidas.length ? new Date().toISOString() : null,
            version_condiciones_fotos: subidas.length ? "1.0" : null,
            descripcion: valor("descripcion"),
            estado: "pendiente",
            localidad_verificada: true,
            acepta_privacidad: document.getElementById("acepta_privacidad").checked,
            acepta_privacidad_at: new Date().toISOString(),
            version_privacidad: "1.2",
            acepta_responsabilidad: document.getElementById("acepta_responsabilidad").checked,
            acepta_terminos_at: new Date().toISOString(),
            version_terminos: "1.1"
        };

        if (!validar(datos)) return;
        if (!await validarLocalidadCodigoPostal(datos.codigo_postal, datos.ciudad)) return;

        if (!window.supabaseClient?.from) {
            mostrarMensaje("No se ha podido conectar con la base de datos.", "error");
            return;
        }

        cambiarEstadoBoton(true);
        try {
            const { error } = await insertarSolicitud(datos);
            if (error) {
                console.error("Error al registrar la solicitud:", error);
                mostrarMensaje(mensajeErrorSupabase(error), "error");
                return;
            }

            let fotosFallidas = [];
            if (subidas.length) {
                cambiarEstadoBoton(true, "Subiendo fotos...");
                const resultadoFotos = await subirFotos(subidas);
                fotosFallidas = resultadoFotos.fallidas;
            }

            formulario.reset();
            mostrarPaso(1, false);
            listaHorarios?.querySelectorAll("[data-dia]").forEach(actualizarFilaHorario);
            if (campoCondicionesFotos) {
                campoCondicionesFotos.disabled = true;
                campoCondicionesFotos.required = false;
            }
            limpiarVistaPrevia();
            if (fotosFallidas.length) {
                mostrarMensaje(
                    "La solicitud se ha guardado, pero algunas fotografías no pudieron subirse. La revisaremos con las imágenes disponibles.",
                    "aviso"
                );
            } else {
                mostrarMensaje(
                    "Solicitud recibida. Revisaremos los datos antes de publicar la ficha del taller.",
                    "exito"
                );
            }
        } catch (error) {
            console.error("Error inesperado al registrar la solicitud:", error);
            mostrarMensaje("No se pudo conectar con la base de datos. Revisa tu conexión e inténtalo de nuevo.", "error");
        } finally {
            cambiarEstadoBoton(false);
        }
    });

    mostrarPaso(1, false);

})();
