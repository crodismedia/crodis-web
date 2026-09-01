export default function handler(_request, response) {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send([
        "User-agent: *",
        "Allow: /",
        "Disallow: /pages/admin.html",
        "Disallow: /pages/admin-",
        "Disallow: /api/",
        "Disallow: /lib/",
        "",
        "Sitemap: https://www.tallermap.es/sitemap.xml",
        "Sitemap: https://www.tallermap.es/sitemap-municipios.xml",
        "Sitemap: https://www.tallermap.es/servicios/sitemap.xml",
        "Sitemap: https://www.tallermap.es/sitemap-provincias.xml",
        "Sitemap: https://www.tallermap.es/sitemap-talleres.xml",
        "Sitemap: https://www.tallermap.es/sitemap-desguaces.xml",
        "",
        "# TallerMap robots actualizado 2026-09-01"
    ].join("\n"));
}
