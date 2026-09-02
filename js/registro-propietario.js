(() => {
    "use strict";

    const formulario = document.getElementById("formulario-registro");
    const email = document.getElementById("email_propietario");
    const mensaje = document.getElementById("mensaje-formulario");
    if (!formulario || !email || !mensaje || !window.supabaseClient) return;

    let emailEnviado = "";
    let enlaceSolicitado = false;

    function emailValido(valor) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || "").trim());
    }

    // La solicitud pública sigue usando el mismo insert existente, pero añade el
    // correo verificado como criterio único de propiedad de la futura ficha.
    const cliente = window.supabaseClient;
    const fromOriginal = cliente.from.bind(cliente);
    cliente.from = function (tabla) {
        const builder = fromOriginal(tabla);
        if (tabla !== "solicitudes_alta_taller" || !builder?.insert) return builder;

        const insertOriginal = builder.insert.bind(builder);
        builder.insert = function (valores, opciones) {
            const correo = String(email.value || emailEnviado || "").trim().toLowerCase();
            const filas = Array.isArray(valores)
                ? valores.map((fila) => ({ ...fila, email: correo }))
                : { ...valores, email: correo };
            return insertOriginal(filas, opciones);
        };
        return builder;
    };

    formulario.addEventListener("submit", () => {
        const correo = String(email.value || "").trim().toLowerCase();
        if (emailValido(correo)) emailEnviado = correo;
    }, true);

    async function enviarAccesoPropietario() {
        if (enlaceSolicitado || !emailValido(emailEnviado)) return;
        enlaceSolicitado = true;

        const redirectTo = `${window.location.origin}/pages/mi-taller.html`;
        const { error } = await cliente.auth.signInWithOtp({
            email: emailEnviado,
            options: {
                emailRedirectTo: redirectTo,
                shouldCreateUser: true
            }
        });

        if (error) {
            console.error("No se pudo enviar el acceso del propietario:", error);
            mensaje.textContent = "Solicitud guardada correctamente. No pudimos enviar ahora el enlace de acceso; podrás solicitarlo más tarde desde «Mi taller» con este mismo correo.";
            mensaje.className = "mensaje-formulario mensaje-aviso";
            mensaje.hidden = false;
            return;
        }

        mensaje.textContent = "Solicitud recibida. Te hemos enviado un enlace al correo indicado. Tras verificarlo, ese correo quedará como acceso del propietario a esta ficha cuando sea publicada.";
        mensaje.className = "mensaje-formulario mensaje-exito";
        mensaje.hidden = false;
    }

    const observador = new MutationObserver(() => {
        if (mensaje.hidden) return;
        const texto = String(mensaje.textContent || "");
        if (texto.startsWith("Solicitud recibida") || texto.startsWith("La solicitud se ha guardado")) {
            enviarAccesoPropietario();
        }
    });
    observador.observe(mensaje, { childList: true, characterData: true, subtree: true, attributes: true });
})();
