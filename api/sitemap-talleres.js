const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const SITE_URL = "https://www.tallermap.es";
const PAGE_SIZE = 1000;
const MAX_WORKSHOPS = 50000;

function escapeXML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

async function fetchWorkshopPage(offset) {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`;
    const end = offset + PAGE_SIZE - 1;
    const result = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "count=exact",
            Range: `${offset}-${end}`,
            "Range-Unit": "items"
        },
        body: "{}"
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const page = await result.json();
    const contentRange = result.headers.get("content-range") || "";
    const totalMatch = contentRange.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : null;

    return {
        page: Array.isArray(page) ? page : [],
        total: Number.isFinite(total) ? total : null
    };
}

export default async function handler(_request, response) {
    const workshops = [];

    try {
        for (let offset = 0; offset < MAX_WORKSHOPS; offset += PAGE_SIZE) {
            const { page, total } = await fetchWorkshopPage(offset);
            if (!page.length) break;

            workshops.push(...page);

            if (page.length < PAGE_SIZE) break;
            if (total !== null && workshops.length >= total) break;
        }
    } catch (error) {
        console.error("No se pudo construir el sitemap de talleres:", error);
        response.setHeader("Content-Type", "application/xml; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.status(503).send(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
        );
        return;
    }

    const uniqueWorkshops = Array.from(
        new Map(
            workshops
                .filter((workshop) => workshop && workshop.slug)
                .map((workshop) => [workshop.slug, workshop])
        ).values()
    );

    const entries = uniqueWorkshops.map((workshop) => {
        const location = `${SITE_URL}/pages/taller.html?slug=${encodeURIComponent(workshop.slug)}`;
        const lastModified = workshop.updated_at
            ? `<lastmod>${escapeXML(String(workshop.updated_at).slice(0, 10))}</lastmod>`
            : "";
        return `<url><loc>${escapeXML(location)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }).join("");

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-TallerMap-Sitemap-Urls", String(uniqueWorkshops.length));
    response.status(200).send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
    );
}
