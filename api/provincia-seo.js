import provinciaHandler from "./provincia.js";

const SITE_URL = "https://www.tallermap.es";
const PROVINCIAS = new Set(["alicante", "castellon", "valencia"]);

export default async function handler(request, response) {
    const slug = String(request.query?.provincia || "")
        .toLowerCase()
        .replace(/\.html$/, "")
        .trim();
    const pagina = Math.max(1, Number.parseInt(String(request.query?.pagina || "1"), 10) || 1);

    if (pagina <= 1 || !PROVINCIAS.has(slug)) {
        return provinciaHandler(request, response);
    }

    // Las páginas 2+ sirven para navegación y descubrimiento de enlaces,
    // pero no deben convertirse en nuevas URLs SEO independientes.
    response.setHeader("X-Robots-Tag", "noindex, follow");

    const sendOriginal = response.send.bind(response);
    response.send = (body) => {
        if (typeof body !== "string") return sendOriginal(body);

        const canonical = `${SITE_URL}/provincias/${slug}.html`;
        const cleaned = body
            .replace(
                /<meta\s+name="robots"[^>]*>/i,
                '<meta name="robots" content="noindex,follow,max-image-preview:large">'
            )
            .replace(
                /<link\s+rel="canonical"\s+href="[^"]+"\s*\/?\s*>/i,
                `<link rel="canonical" href="${canonical}">`
            );

        return sendOriginal(cleaned);
    };

    return provinciaHandler(request, response);
}
