(function () {
    "use strict";

    const reemplazos = new Map([
        ["Ă¡", "á"], ["ĂĄ", "á"],
        ["Ă©", "é"], ["ĂŠ", "é"],
        ["Ă­", "í"],
        ["Ăł", "ó"],
        ["Ăş", "ú"],
        ["Ă±", "ñ"],
        ["Ă", "Á"], ["Ă‰", "É"], ["Ă", "Í"],
        ["Ă“", "Ó"], ["Ăš", "Ú"], ["Ă‘", "Ñ"],
        ["âŚ", "…"], ["â", "–"], ["â", "—"],
        ["â", "←"], ["â", "→"], ["â", "✓"],
        ["â¬", "€"], ["Â·", "·"], ["Âº", "º"],
        ["Âª", "ª"], ["Â©", "©"], ["Â", ""]
    ]);

    const patron = /Ă|â|â|â|â|Â/;
    const atributosTexto = ["placeholder", "title", "aria-label"];

    function corregir(texto) {
        let resultado = String(texto || "");
        if (!patron.test(resultado)) return resultado;

        for (const [incorrecto, correcto] of reemplazos) {
            resultado = resultado.split(incorrecto).join(correcto);
        }
        return resultado;
    }

    function corregirNodo(nodo) {
        if (!nodo) return;

        if (nodo.nodeType === Node.TEXT_NODE) {
            const corregido = corregir(nodo.nodeValue);
            if (corregido !== nodo.nodeValue) nodo.nodeValue = corregido;
            return;
        }

        if (nodo.nodeType !== Node.ELEMENT_NODE) return;

        atributosTexto.forEach((atributo) => {
            if (!nodo.hasAttribute(atributo)) return;
            const actual = nodo.getAttribute(atributo);
            const corregido = corregir(actual);
            if (corregido !== actual) nodo.setAttribute(atributo, corregido);
        });

        nodo.childNodes.forEach(corregirNodo);
    }

    function iniciar() {
        corregirNodo(document.body);

        const observador = new MutationObserver((cambios) => {
            cambios.forEach((cambio) => {
                if (cambio.type === "characterData") {
                    corregirNodo(cambio.target);
                    return;
                }
                cambio.addedNodes.forEach(corregirNodo);
            });
        });

        observador.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());
