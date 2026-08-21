import provinciaHandler from "./provincia.js";

const PROVINCIAS = new Set(["alicante", "castellon", "valencia"]);

export default async function handler(request, response) {
    const slug = String(request.query?.provincia || "")
        .toLowerCase()
        .replace(/\.html$/, "")
        .trim();

    if (!PROVINCIAS.has(slug)) {
        return provinciaHandler(request, response);
    }

    const paginaRaw = String(request.query?.pagina || "").trim();
    if (paginaRaw) {
        response.setHeader("Cache-Control", "public, max-age=3600");
        response.redirect(301, `/provincias/${slug}.html`);
        return;
    }

    return provinciaHandler(request, response);
}
