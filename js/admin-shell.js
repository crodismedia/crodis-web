(function () {
    "use strict";

    const botonCerrarSesion = document.getElementById("boton-cerrar-sesion");
    const estadoAcceso = document.getElementById("estado-acceso-admin");

    function mostrarEstado(texto, tipo) {
        if (!estadoAcceso) return;
        estadoAcceso.textContent = texto;
        estadoAcceso.className = `admin-shell-estado admin-shell-estado-${tipo}`;
    }

    async function protegerPanel() {
        if (!window.supabaseClient) {
            mostrarEstado("No se ha podido iniciar la conexión segura.", "error");
            return;
        }

        try {
            const { data: { session }, error: errorSesion } = await window.supabaseClient.auth.getSession();

            if (errorSesion || !session) {
                window.location.replace("admin-login.html");
                return;
            }

            const { data: esAdministrador, error: errorAdministrador } = await window.supabaseClient.rpc("es_administrador");

            if (errorAdministrador || !esAdministrador) {
                await window.supabaseClient.auth.signOut();
                window.location.replace("admin-login.html");
                return;
            }

            mostrarEstado("Acceso administrativo verificado", "correcto");
        } catch (error) {
            console.error("Error al verificar el acceso administrativo:", error);
            mostrarEstado("No se ha podido verificar la sesión.", "error");
        }
    }

    botonCerrarSesion?.addEventListener("click", async () => {
        botonCerrarSesion.disabled = true;
        botonCerrarSesion.textContent = "Cerrando sesión...";

        try {
            await window.supabaseClient.auth.signOut();
        } finally {
            window.location.replace("admin-login.html");
        }
    });

    protegerPanel();
}());
