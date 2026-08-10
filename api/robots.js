export default function handler(_request, response) {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send([
        "User-agent: *",
        "Allow: /",
        "",
        "Sitemap: https://www.tallermap.es/sitemap-index.xml",
        "Host: www.tallermap.es",
        "",
        "# Índice principal actualizado 2026-08-10"
    ].join("\n"));
}
