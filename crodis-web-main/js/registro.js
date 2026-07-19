const formulario = document.getElementById("formulario-registro");
const mensaje = document.getElementById("mensaje-formulario");
const botonEnviar = document.getElementById("boton-enviar");

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = "mensaje-formulario";

    if (tipo === "correcto") {
        mensaje.classList.add("mensaje-correcto");
    } else {
        mensaje.classList.add("mensaje-error");
    }
}

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    if (!formulario.checkValidity()) {
        formulario.reportValidity();
        return;
    }

    botonEnviar.disabled = true;
    botonEnviar.textContent = "Enviando...";

    const datos = {
        nombre_taller: document.getElementById("nombre_taller").value.trim(),
        propietario: document.getElementById("propietario").value.trim(),
        cif: document.getElementById("cif").value.trim(),
        email: document.getElementById("email").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        direccion: document.getElementById("direccion").value.trim(),
        codigo_postal: document.getElementById("codigo_postal").value.trim(),
        ciudad: document.getElementById("ciudad").value.trim(),
        provincia: document.getElementById("provincia").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        estado: "pendiente"
    };

    try {
        const { error } = await supabaseClient
            .from("solicitudes_alta_taller")
            .insert([datos]);

        if (error) {
            throw error;
        }

        mostrarMensaje(
            "Solicitud enviada correctamente. Hemos recibido los datos del taller.",
            "correcto"
        );

        formulario.reset();

    } catch (error) {
        console.error(error);

        mostrarMensaje(
            "No se pudo enviar la solicitud. Revisa los datos e inténtalo de nuevo.",
            "error"
        );
    } finally {
        botonEnviar.disabled = false;
        botonEnviar.textContent = "Enviar solicitud";
    }
});
