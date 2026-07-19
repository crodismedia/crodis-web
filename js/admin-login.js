(function () {
    "use strict";
    const formulario = document.getElementById("formulario-admin-login");
    const mensaje = document.getElementById("mensaje-login");
    const boton = document.getElementById("boton-login");

    function mostrar(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = `mensaje-formulario mensaje-${tipo}`;
        mensaje.hidden = false;
    }

    async function comprobarSesion() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;
        const { data: esAdministrador } = await window.supabaseClient.rpc("es_administrador");
        if (esAdministrador) {
            window.location.replace("admin.html");
        } else {
            await window.supabaseClient.auth.signOut();
        }
    }

    formulario?.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!formulario.checkValidity()) {
            formulario.reportValidity();
            return;
        }
        boton.disabled = true;
        boton.textContent = "Comprobando acceso...";
        const { error } = await window.supabaseClient.auth.signInWithPassword({
            email: document.getElementById("email-admin").value.trim(),
            password: document.getElementById("password-admin").value
        });
        boton.disabled = false;
        boton.textContent = "Iniciar sesión";
        if (error) {
            mostrar("No se ha podido iniciar sesión. Comprueba tus credenciales.", "error");
            return;
        }
        const { data: esAdministrador, error: errorAdministrador } = await window.supabaseClient.rpc("es_administrador");
        if (errorAdministrador || !esAdministrador) {
            await window.supabaseClient.auth.signOut();
            mostrar("Esta cuenta no tiene permisos de administración.", "error");
            return;
        }
        window.location.replace("admin.html");
    });

    comprobarSesion();
}());
