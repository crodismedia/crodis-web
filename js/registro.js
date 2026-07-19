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

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        mostrarMensaje("", "");

        if (!formulario.checkValidity()) {
            formulario.reportValidity();
            return;
        }

        const emailCampo = document.getElementById("email");
        const aceptaCampo = document.getElementById(
            "acepta_responsabilidad"
        );

        const datosSolicitud = {
            nombre_taller: obtenerValor("nombre_taller"),
            propietario: obtenerValor("propietario"),
            cif: obtenerValor("cif").toUpperCase(),
            email: emailCampo
                ? emailCampo.value.trim().toLowerCase()
                : "",
            telefono: obtenerValor("telefono"),
            direccion: obtenerValor("direccion"),
            codigo_postal: obtenerValor("codigo_postal"),
            ciudad: obtenerValor("ciudad"),
            provincia: obtenerValor("provincia"),
            descripcion: obtenerValor("descripcion"),
            estado: "pendiente"
        };

        if (!validarDatosFormulario(datosSolicitud, aceptaCampo)) {
            return;
        }

        const enviado = await enviarSolicitud(datosSolicitud);

        if (enviado) {
            formulario.reset();
        }
    });

    function validarDatosFormulario(datos, aceptaCampo) {
        if (datos.nombre_taller.length < 2) {
            mostrarMensaje(
                "Escribe el nombre del taller.",
                "error"
            );
            enfocarCampo("nombre_taller");
            return false;
        }

        if (datos.propietario.length < 2) {
            mostrarMensaje(
                "Escribe el nombre del propietario o responsable.",
                "error"
            );
            enfocarCampo("propietario");
            return false;
        }

        if (datos.cif.length < 7) {
            mostrarMensaje(
                "Escribe un CIF o NIF válido.",
                "error"
            );
            enfocarCampo("cif");
            return false;
        }

        if (!validarEmail(datos.email)) {
            mostrarMensaje(
                "El correo electrónico no es válido. Ejemplo: nombre@correo.com",
                "error"
            );
            enfocarCampo("email");
            return false;
        }

        if (datos.telefono.length < 9) {
            mostrarMensaje(
                "Escribe un número de teléfono válido.",
                "error"
            );
            enfocarCampo("telefono");
            return false;
        }

        if (datos.direccion.length < 5) {
            mostrarMensaje(
                "Escribe la dirección completa del taller.",
                "error"
            );
            enfocarCampo("direccion");
            return false;
        }

        if (!/^[0-9]{5}$/.test(datos.codigo_postal)) {
            mostrarMensaje(
                "El código postal debe contener exactamente 5 números.",
                "error"
            );
            enfocarCampo("codigo_postal");
            return false;
        }

        if (datos.ciudad.length < 2) {
            mostrarMensaje(
                "Escribe la ciudad.",
                "error"
            );
            enfocarCampo("ciudad");
            return false;
        }

        if (datos.provincia.length < 2) {
            mostrarMensaje(
                "Escribe la provincia.",
                "error"
            );
            enfocarCampo("provincia");
            return false;
        }

        if (datos.descripcion.length < 10) {
            mostrarMensaje(
                "La descripción debe tener al menos 10 caracteres.",
                "error"
            );
            enfocarCampo("descripcion");
            return false;
        }

        if (aceptaCampo && !aceptaCampo.checked) {
            mostrarMensaje(
                "Debes aceptar las condiciones de publicación.",
                "error"
            );
            aceptaCampo.focus();
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
                "No se ha podido conectar con la base de datos.",
                "error"
            );

            return false;
        }

        try {
            cambiarEstadoBoton(true);

            const { error } = await window.supabaseClient
                .from("solicitudes_alta_taller")
                .insert([datosSolicitud]);

            if (error) {
                console.error("Error de Supabase:", error);

                const mensajeError = String(
                    error.message || ""
                ).toLowerCase();

                if (
                    error.code === "42501" ||
                    mensajeError.includes("permission denied")
                ) {
                    mostrarMensaje(
                        "Supabase no permite guardar la solicitud. Revisa los permisos INSERT y la política RLS.",
                        "error"
                    );
                    return false;
                }

                if (
                    mensajeError.includes("row-level security") ||
                    mensajeError.includes("violates row-level security")
                ) {
                    mostrarMensaje(
                        "La solicitud no cumple la política de seguridad de Supabase.",
                        "error"
                    );
                    return false;
                }

                if (
                    error.code === "23505" ||
                    mensajeError.includes("duplicate")
                ) {
                    mostrarMensaje(
                        "Ya existe una solicitud con esos datos.",
                        "error"
                    );
                    return false;
                }

                if (
                    error.code === "23514" ||
                    mensajeError.includes("check constraint")
                ) {
                    mostrarMensaje(
                        "Uno de los campos no cumple los requisitos de la base de datos.",
                        "error"
                    );
                    return false;
                }

                mostrarMensaje(
                    "No se pudo enviar el registro: " +
                    error.message,
                    "error"
                );

                return false;
            }

            console.log("Solicitud registrada correctamente.");

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

    function obtenerValor(idCampo) {
        const campo = document.getElementById(idCampo);

        if (!campo) {
            return "";
        }

        return campo.value.trim();
    }

    function validarEmail(email) {
        const expresionEmail =
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
            mensajeFormulario.classList.add(
                "mensaje-error"
            );
        }

        if (tipo === "exito") {
            mensajeFormulario.classList.add(
                "mensaje-exito"
            );
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
