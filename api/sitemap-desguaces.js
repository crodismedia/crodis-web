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

function safeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : "";
}

async function fetchDesguaces() {
  const endpoint = `${SUPABASE_URL}/rest/v1/desguaces?select=slug,updated_at&activo=eq.true&verificado=eq.true&order=slug.asc`;
  const result = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Accept: "application/json"
    }
  });

  if (!result.ok) {
    const message = await result.text().catch(() => "");
    throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
  }

  const data = await result.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(_request, response) {
  let desguaces = [];

  try {
    desguaces = await fetchDesguaces();
  } catch (error) {
    console.error("No se pudo construir el sitemap de desguaces:", error);
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.status(503).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
    );
    return;
  }

  const unique = Array.from(
    new Map(
      desguaces
        .map((d) => [safeSlug(d?.slug), d])
        .filter(([slug]) => Boolean(slug))
    ).values()
  );

  const entries = unique.map((desguace) => {
    const slug = safeSlug(desguace.slug);
    const location = `${SITE_URL}/desguace/${encodeURIComponent(slug)}`;
    const lastModified = desguace.updated_at
      ? `<lastmod>${escapeXML(String(desguace.updated_at).slice(0, 10))}</lastmod>`
      : "";

    return `<url><loc>${escapeXML(location)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  }).join("");

  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.setHeader("X-TallerMap-Sitemap-Urls", String(unique.length));
  response.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
  );
}
