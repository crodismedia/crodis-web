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
        "Sitemap: https://www.tallermap.es/sitemap-index.xml",
        "",
        "# TallerMap robots actualizado 2026-09-03"
    ].join("\n"));
}
