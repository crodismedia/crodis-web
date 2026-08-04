const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const SITE_URL = "https://www.tallermap.es";

function escapeXML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export default async function handler(_request, response) {
    let workshops = [];
    try {
        const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            },
            body: "{}"
        });
        if (result.ok) workshops = await result.json();
    } catch (error) {
        console.error("No se pudo construir el sitemap de talleres:", error);
    }

    const entries = (Array.isArray(workshops) ? workshops : []).map((workshop) => {
        const location = `${SITE_URL}/pages/taller.html?slug=${encodeURIComponent(workshop.slug)}`;
        const lastModified = workshop.updated_at
            ? `<lastmod>${escapeXML(String(workshop.updated_at).slice(0, 10))}</lastmod>`
            : "";
        return `<url><loc>${escapeXML(location)}</loc>${lastModified}<changefreq>weekly</changefreq></url>`;
    }).join("");

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`);
}
