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

function safeSlug(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function fetchWorkshopPage(offset) {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`;
    const result = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_limite: PAGE_SIZE,
            p_desde: offset
        })
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const page = await result.json();
    const total = Number(page?.[0]?.total_resultados);

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
                .map((workshop) => [safeSlug(workshop.slug), workshop])
                .filter(([slug]) => Boolean(slug))
        ).values()
    );

    const entries = uniqueWorkshops.map((workshop) => {
        const slug = safeSlug(workshop.slug);
        const location = `${SITE_URL}/talleres/${encodeURIComponent(slug)}`;
        const lastModified = workshop.updated_at
            ? `<lastmod>${escapeXML(String(workshop.updated_at).slice(0, 10))}</lastmod>`
            : "";
        return `<url><loc>${escapeXML(location)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }).join("");

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    response.setHeader("X-TallerMap-Sitemap-Urls", String(uniqueWorkshops.length));
    response.status(200).send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
    );
}
