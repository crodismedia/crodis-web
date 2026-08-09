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

function municipalitySlug(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function fetchMunicipalities() {
    const result = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/listar_municipios_sitemap`,
        {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            },
            body: "{}"
        }
    );

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const data = await result.json();
    return Array.isArray(data) ? data : [];
}

export default async function handler(_request, response) {
    let municipalities;
    try {
        municipalities = await fetchMunicipalities();
    } catch (error) {
        console.error("No se pudo construir el sitemap de municipios:", error);
        response.setHeader("Content-Type", "application/xml; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.status(503).send(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
        );
        return;
    }

    const uniqueMunicipalities = Array.from(
        new Map(
            municipalities
                .filter((item) => /^\d{5}$/.test(String(item?.codigo_municipal || "")))
                .map((item) => [String(item.codigo_municipal), item])
        ).values()
    );

    const entries = uniqueMunicipalities.map((item) => {
        const code = String(item.codigo_municipal);
        const slug = municipalitySlug(item.municipio);
        const location = `${SITE_URL}/municipios/${slug}-${code}.html`;
        const lastModified = item.updated_at
            ? `<lastmod>${escapeXML(String(item.updated_at).slice(0, 10))}</lastmod>`
            : "";
        return `<url><loc>${escapeXML(location)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    }).join("");

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-TallerMap-Sitemap-Urls", String(uniqueMunicipalities.length));
    response.status(200).send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
    );
}
