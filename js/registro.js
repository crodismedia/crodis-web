(function () {
    "use strict";

    const formulario = document.getElementById("formulario-registro");
    const botonEnviar = document.getElementById("boton-enviar");
    const mensajeFormulario = document.getElementById("mensaje-formulario");

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

    function cambiarEstadoBoton(enviando) {
        botonEnviar.disabled = enviando;
        botonEnviar.textContent = enviando ? "Enviando..." : "Enviar solicitud";
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

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        ocultarMensaje();

        if (campoWeb) campoWeb.value = normalizarWeb(campoWeb.value);

        if (!formulario.checkValidity()) {
            formulario.reportValidity();
            return;
        }

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

            formulario.reset();
            const publicacionAutomatica = window.TallerMapProvincias
                ?.esComunitatValenciana(datos.codigo_postal);
            mostrarMensaje(publicacionAutomatica
                ? "Alta enviada y publicada automáticamente. El taller ya aparece en TallerMap como ficha no verificada."
                : "Solicitud enviada correctamente. El taller queda pendiente de revisión.",
            "exito");
        } catch (error) {
            console.error("Error inesperado al registrar la solicitud:", error);
            mostrarMensaje("No se pudo conectar con la base de datos. Revisa tu conexión e inténtalo de nuevo.", "error");
        } finally {
            cambiarEstadoBoton(false);
        }
    });
}());
