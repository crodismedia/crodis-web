(async function () {
    "use strict";

    const FUENTE_ORIGINAL = "https://raw.githubusercontent.com/crodismedia/crodis-web/e95ec4e885da1a2db526a67127ff69cc8288c1fe/js/admin.js";

    const REEMPLAZOS = new Map([
        ["Ă¡", "á"], ["Ă©", "é"], ["Ă­", "í"], ["Ăł", "ó"], ["Ăş", "ú"],
        ["Ă", "Á"], ["Ă‰", "É"], ["Ă", "Í"], ["Ă“", "Ó"], ["Ăš", "Ú"],
        ["Ă±", "ñ"], ["Ă‘", "Ñ"], ["ĂĽ", "ü"], ["Ăś", "ö"], ["Ă§", "ç"],
        ["âŚ", "…"], ["â", "—"], ["â", "–"], ["â", "“"], ["â", "”"],
        ["â", "‘"], ["â", "’"], ["â", "✓"], ["Âˇ", "·"], ["Âª", "ª"],
        ["Âº", "º"], ["Â©", "©"], ["Â®", "®"], ["Â", ""]
    ]);

    function repararTexto(codigo) {
        let resultado = codigo;
        for (const [incorrecto, correcto] of REEMPLAZOS) {
            resultado = resultado.split(incorrecto).join(correcto);
        }
        return resultado;
    }

    function mostrarError(error) {
        console.error("No se pudo cargar el panel de administración:", error);
        const mensaje = document.getElementById("mensaje-admin");
        if (mensaje) {
            mensaje.textContent = "No se pudo cargar el panel de administración. Recarga la página.";
            mensaje.className = "mensaje-formulario mensaje-error";
            mensaje.hidden = false;
        }
    }

    try {
        const respuesta = await fetch(FUENTE_ORIGINAL, { cache: "no-store" });
        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }

        const codigoOriginal = await respuesta.text();
        const codigoReparado = repararTexto(codigoOriginal);

        if (/Ă|Â|â|â/.test(codigoReparado)) {
            console.warn("Quedan secuencias sospechosas de codificación en admin.js.");
        }

        (0, eval)(`${codigoReparado}\n//# sourceURL=admin-reparado.js`);
    } catch (error) {
        mostrarError(error);
    }
}());
