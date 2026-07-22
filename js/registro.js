(function () {
    "use strict";

    const formulario = document.getElementById("formulario-registro");
    const botonEnviar = document.getElementById("boton-enviar");
    const mensajeFormulario = document.getElementById("mensaje-formulario");
    const campoFotos = document.getElementById("fotos");
    const vistaPreviaFotos = document.getElementById("vista-previa-fotos");
    const campoCondicionesFotos = document.getElementById("acepta_condiciones_fotos");
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
    const MAXIMO_FOTOS = 5;
    const MAXIMO_BYTES_FOTO = 5 * 1024 * 1024;
    let urlsVistaPrevia = [];

    if (!formulario || !botonEnviar || !mensajeFormulario) {
        console.error("El formulario de registro no está completo en la página.");
        return;
    }

    function valor(idCampo) {
        return document.getElementById(idCampo)?.value.trim() || "";
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

    function cambiarEstadoBoton(enviando, texto = "Enviando...") {
        botonEnviar.disabled = enviando;
        botonEnviar.textContent = enviando ? texto : "Enviar alta gratuita";
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
            }
        }
        return fallidas;
    }

    function validar(datos) {
        if (datos.nombre_taller.length < 2) {
            mostrarMensaje("Escribe el nombre del taller.", "error");
            enfocar("nombre_taller");
            return false;
        }
        if (datos.propietario.length < 2) {
            mostrarMensaje("Escribe el nombre del propietario o responsable.", "error");
            enfocar("propietario");
            return false;
        }
        if (datos.cif.length < 7) {
            mostrarMensaje("Escribe un CIF o NIF válido.", "error");
            enfocar("cif");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email)) {
            mostrarMensaje("Escribe un correo válido, por ejemplo nombre@correo.com.", "error");
            enfocar("email");
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
        if (datos.descripcion.length < 10) {
            mostrarMensaje("La descripción debe contener al menos 10 caracteres.", "error");
            enfocar("descripcion");
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
            return "La base de datos no permite guardar la solicitud. Hay que aplicar la configuración RLS de TallerMap en Supabase.";
        }
        if (detalle.includes("row-level security")) {
            return "La solicitud ha sido bloqueada por la política de seguridad de Supabase.";
        }
        if (error?.code === "23505" || detalle.includes("duplicate")) {
            return "Ya existe una solicitud con esos datos.";
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
        if (error?.code === "23514" || detalle.includes("check constraint")) {
            return "Uno de los datos no cumple los requisitos. Revisa el CIF, teléfono y código postal.";
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

    const campoCodigoPostal = document.getElementById("codigo_postal");
    const campoProvincia = document.getElementById("provincia");
    const campoWeb = document.getElementById("web");

    campoCodigoPostal?.addEventListener("input", () => {
        if (/^[0-9]{5}$/.test(campoCodigoPostal.value)) {
            window.TallerMapProvincias?.seleccionarSegunCodigo(
                campoCodigoPostal.value,
                campoProvincia
            );
        }
    });

    campoWeb?.addEventListener("blur", () => {
        campoWeb.value = normalizarWeb(campoWeb.value);
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

        if (campoWeb) campoWeb.value = normalizarWeb(campoWeb.value);

        if (!formulario.checkValidity()) {
            formulario.reportValidity();
            return;
        }

        const archivos = fotosSeleccionadas();
        if (!validarFotos(archivos)) return;
        const subidas = prepararSubidas(archivos);
        const datos = {
            nombre_taller: valor("nombre_taller"),
            propietario: valor("propietario"),
            cif: valor("cif").toUpperCase(),
            email: valor("email").toLowerCase(),
            telefono: valor("telefono"),
            web: normalizarWeb(valor("web")),
            direccion: valor("direccion"),
            codigo_postal: valor("codigo_postal"),
            ciudad: valor("ciudad"),
            provincia: valor("provincia"),
            servicios: serviciosSeleccionados(),
            fotos: subidas.map((subida) => subida.ruta),
            acepta_condiciones_fotos: subidas.length > 0 && campoCondicionesFotos.checked,
            acepta_condiciones_fotos_at: subidas.length ? new Date().toISOString() : null,
            version_condiciones_fotos: subidas.length ? "1.0" : null,
            descripcion: valor("descripcion"),
            estado: "pendiente",
            acepta_responsabilidad: document.getElementById("acepta_responsabilidad").checked,
            acepta_terminos_at: new Date().toISOString(),
            version_terminos: "1.0"
        };

        if (!validar(datos)) return;

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
                fotosFallidas = await subirFotos(subidas);
            }

            formulario.reset();
            if (campoCondicionesFotos) {
                campoCondicionesFotos.disabled = true;
                campoCondicionesFotos.required = false;
            }
            limpiarVistaPrevia();
            const publicacionAutomatica = window.TallerMapProvincias
                ?.esComunitatValenciana(datos.codigo_postal);
            if (fotosFallidas.length) {
                mostrarMensaje(
                    "El alta se ha guardado, pero algunas fotografías no pudieron subirse. La ficha continuará sin esas imágenes.",
                    "aviso"
                );
            } else {
                mostrarMensaje(publicacionAutomatica
                    ? "Alta enviada y publicada automáticamente. El taller ya aparece en TallerMap como ficha no verificada."
                    : "Solicitud enviada correctamente. El taller queda pendiente de revisión.",
                "exito");
            }
        } catch (error) {
            console.error("Error inesperado al registrar la solicitud:", error);
            mostrarMensaje("No se pudo conectar con la base de datos. Revisa tu conexión e inténtalo de nuevo.", "error");
        } finally {
            cambiarEstadoBoton(false);
        }
    });
}());
