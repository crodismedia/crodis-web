import { slugify, supabaseRpc } from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";

function first(value) {
  return Array.isArray(value)
    ? String(value[0] || "").trim()
    : String(value || "").trim();
}

function extractLegacyUuid(value) {
  const match = first(value).match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
  );
  return match?.[1] || "";
}

async function resolveCanonicalSlug(legacy) {
  const id = extractLegacyUuid(legacy);

  if (id) {
    const rows = await supabaseRpc("obtener_taller_publico", {
      p_id: id,
      p_slug: null
    });
    return rows?.[0]?.slug ? slugify(rows[0].slug) : "";
  }

  const candidate = slugify(legacy);
  if (!candidate) return "";

  const rows = await supabaseRpc("obtener_taller_publico", {
    p_id: null,
    p_slug: candidate
  });
  return rows?.[0]?.slug ? slugify(rows[0].slug) : "";
}

export default async function handler(request, response) {
  const legacy = first(request?.query?.legacy);

  if (!legacy) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    response.status(410).send("Esta ficha antigua ya no está disponible.");
    return;
  }

  try {
    const slug = await resolveCanonicalSlug(legacy);

    if (slug) {
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
      response.statusCode = 301;
      response.setHeader(
        "Location",
        `${SITE_URL}/talleres/${encodeURIComponent(slug)}`
      );
      response.end();
      return;
    }
  } catch (error) {
    console.error("No se pudo resolver la ruta legacy /taller/:", error);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Retry-After", "60");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    response.status(503).send("No se pudo comprobar esta ficha en este momento.");
    return;
  }

  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  response.status(410).send("Esta ficha antigua ya no está disponible.");
}
