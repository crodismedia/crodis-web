function injectWorkshopLinks(html, workshopHTML) {
    const openPattern =
        /<div\b([^>]*\bid=["']lista-talleres["'][^>]*)>/i;

    const match = openPattern.exec(html);

    if (!match) {
        throw new Error(
            "No se encontró el contenedor #lista-talleres en index.html"
        );
    }

    const contentStart = match.index + match[0].length;
    const divPattern = /<\/?div\b[^>]*>/gi;
    divPattern.lastIndex = contentStart;

    let depth = 1;
    let token;

    while ((token = divPattern.exec(html))) {
        if (/^<\/div/i.test(token[0])) {
            depth--;
        } else {
            depth++;
        }

        if (depth === 0) {
            return (
                html.slice(0, contentStart) +
                workshopHTML +
                html.slice(token.index)
            );
        }
    }

    throw new Error(
        "No se pudo cerrar el contenedor #lista-talleres en index.html"
    );
}
