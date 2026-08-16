import { slugify, supabaseRpc } from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";

function first(value) {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function uuidValido(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolverSlug(request) {
  const query = request?.query || {};
  const slugQuery = first(query.slug);
  if (slugQuery) return slugify(slugQuery);

  const id = first(query.id);
  if (!uuidValido(id)) return "";

  try {
    const rows = await supabaseRpc("obtener_taller_publico", { p_id: id, p_slug: null });
    return rows?.[0]?.slug ? slugify(rows[0].slug) : "";
  } catch (error) {
    console.warn("No se pudo resolver la URL legacy del taller:", error);
    return "";
  }
}

export default async function handler(request, response) {
  const slug = await resolverSlug(request);

  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");

  if (slug) {
    response.statusCode = 301;
    response.setHeader("Location", `${SITE_URL}/talleres/${encodeURIComponent(slug)}`);
    response.end();
    return;
  }

  response.statusCode = 302;
  response.setHeader("Location", `${SITE_URL}/`);
  response.end();
}
