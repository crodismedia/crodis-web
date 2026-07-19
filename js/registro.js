document.addEventListener("DOMContentLoaded", function () {
    const formulario = document.getElementById("formulario-registro");
    const botonEnviar = document.getElementById("boton-enviar");
    const mensajeFormulario = document.getElementById("mensaje-formulario");

    if (!formulario) {
        console.error(
            'No se encontró el formulario con id="formulario-registro".'
        );
        return;
    }

    function validarDatosFormulario(datos, emailCampo) {
        if (!datos.nombre_taller) {
            mostrarMensaje("Escribe el nombre del taller.", "error");
            enfocarCampo("nombre_taller");
            return false;
        }

        if (!datos.propietario) {
            mostrarMensaje("Escribe el nombre del propietario o responsable.", "error");
            enfocarCampo("propietario");
            return false;
        }

        if (!datos.email) {
            mostrarMensaje("Escribe el correo electrónico.", "error");
            if (emailCampo) emailCampo.focus();
            return false;
        }

        if (!validarEmail(datos.email)) {
            mostrarMensaje("El correo electrónico no es válido. Ejemplo: nombre@correo.com", "error");
            if (emailCampo) emailCampo.focus();
            return false;
        }

        if (!datos.telefono) {
            mostrarMensaje("Escribe un número de teléfono.", "error");
            enfocarCampo("telefono");
            return false;
        }

        if (!datos.direccion) {
            mostrarMensaje("Escribe la dirección del taller.", "error");
            enfocarCampo("direccion");
            return false;
        }

        if (!datos.codigo_postal) {
            mostrarMensaje("Escribe el código postal.", "error");
            enfocarCampo("codigo_postal");
            return false;
        }

        if (!datos.ciudad) {
            mostrarMensaje("Escribe la ciudad.", "error");
            enfocarCampo("ciudad");
            return false;
        }

        return true;
    }

    async function enviarSolicitud(datosSolicitud) {
        if (
            typeof window.supabaseClient === "undefined" ||
            typeof window.supabaseClient.from !== "function"
        ) {
            console.error("El cliente de Supabase no está disponible.");
            mostrarMensaje(
                "No se ha podido conectar con la base de datos. Revisa el archivo supabase.js.",
                "error"
            );
            return false;
        }

        try {
            cambiarEstadoBoton(true);

            const { data, error } = await window.supabaseClient
                .from("solicitudes_alta_taller")
                .insert([datosSolicitud])
                .select();

            if (error) {
                console.error("Error de Supabase:", error);

                if (
                    error.code === "23505" ||
                    String(error.message).toLowerCase().includes("duplicate")
                ) {
                    mostrarMensaje(
                        "Ya existe una solicitud registrada con ese correo electrónico.",
                        "error"
                    );
                    return false;
                }

                if (
                    String(error.message).toLowerCase().includes("email")
                ) {
                    mostrarMensaje(
                        "La base de datos ha rechazado el correo electrónico. Comprueba que sea correcto.",
                        "error"
                    );
                    return false;
                }

                mostrarMensaje(
                    "No se pudo enviar el registro: " + error.message,
                    "error"
                );
                return false;
            }

            console.log("Solicitud registrada:", data);
            mostrarMensaje(
                "Solicitud enviada correctamente. El taller queda pendiente de revisión.",
                "exito"
            );
            return true;
        } catch (error) {
            console.error("Error inesperado:", error);
            mostrarMensaje(
                "Ha ocurrido un error inesperado al enviar el formulario.",
                "error"
            );
            return false;
        } finally {
            cambiarEstadoBoton(false);
        }
    }

    formulario.addEventListener("submit", async function (event) {
        event.preventDefault();

        const emailCampo = document.getElementById("email");
        const datosSolicitud = {
            nombre_taller: obtenerValor("nombre_taller"),
            propietario: obtenerValor("propietario"),
            cif: obtenerValor("cif") || null,
            email: emailCampo ? emailCampo.value.trim().toLowerCase() : "",
            telefono: obtenerValor("telefono"),
            direccion: obtenerValor("direccion"),
            codigo_postal: obtenerValor("codigo_postal"),
            ciudad: obtenerValor("ciudad"),
            provincia: obtenerValor("provincia") || "Valencia",
            descripcion: obtenerValor("descripcion") || null,
            estado: "pendiente"
        };

        mostrarMensaje("", "");

        if (!validarDatosFormulario(datosSolicitud, emailCampo)) {
            return;
        }

        const exito = await enviarSolicitud(datosSolicitud);
        if (exito) {
            formulario.reset();
        }
    });

    function obtenerValor(idCampo) {
        const campo = document.getElementById(idCampo);

        if (!campo) {
            return "";
        }

        return campo.value.trim();
    }

    function validarEmail(email) {
        const expresionEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        return expresionEmail.test(email);
    }

    function enfocarCampo(idCampo) {
        const campo = document.getElementById(idCampo);

        if (campo) {
            campo.focus();
        }
    }

    function mostrarMensaje(texto, tipo) {
        if (!mensajeFormulario) {
            if (texto) {
                alert(texto);
            }

            return;
        }

        mensajeFormulario.textContent = texto;
        mensajeFormulario.classList.remove(
            "mensaje-error",
            "mensaje-exito"
        );

        if (tipo === "error") {
            mensajeFormulario.classList.add("mensaje-error");
        }

        if (tipo === "exito") {
            mensajeFormulario.classList.add("mensaje-exito");
        }
    }

    function cambiarEstadoBoton(enviando) {
        if (!botonEnviar) {
            return;
        }

        botonEnviar.disabled = enviando;
        botonEnviar.textContent = enviando
            ? "Enviando..."
            : "Enviar solicitud";
    }
});
