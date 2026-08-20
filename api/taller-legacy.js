import { slugify, supabaseRpc } from "../lib/server-utils.js";

const SITE_URL = "https://www.tallermap.es";

// Mapeo SEO temporal de URLs legacy detectadas en Search Console.
// Evita que versiones antiguas /pages/taller.html?... terminen en home
// cuando el id/slug antiguo ya no coincide con la ficha pública actual.
const LEGACY_ID_TO_SLUG = {
  "4a5dac44-936f-4e0b-884e-e8d8aec06f66": "antonio-perea-garcia-hondon-de-las-nieves-4a5dac44",
  "f85efa90-259e-4fd2-8699-8a9e4d35254d": "taller-victoria-guardamar-guardamar-del-segura-f85efa90",
  "c357b044-38fb-4748-8fb7-25023f5b78e7": "autokryp-orihuela-c357b044",
  "950a1d4f-8cc2-4e5a-98f4-a90e09398df4": "civerlliria-lliria-950a1d4f",
  "ead5c648-fb69-44b8-8bd1-7c3032d4c255": "confortauto-hnos-ortiz-peris-carlet-ead5c648",
  "81242af5-8702-40f2-b858-6ad8951f9e46": "cristalbox-orihuela-orihuela-81242af5",
  "feb4a90e-86c2-4cec-a37e-03d5b95ca7db": "chapa-y-pintura-hermanos-ayas-s-l-elche-feb4a90e",
  "8b2a207b-1ab2-478f-9827-dfcdbbe27e02": "automocion-garosa-s-l-les-coves-de-vinroma-8b2a207b",
  "95de87f8-542b-47b0-9113-4f051685d021": "nilbud-s-l-nules-95de87f8",
  "91effe30-8d84-45c7-be7d-1e63efb8e877": "francisco-alarcon-carrion-chiva-91effe30",
  "7e45310f-c6fc-46a1-ab4c-2c970596f444": "auto-belmar-s-l-alcala-de-xivert-7e45310f",
  "78d9c4bb-7474-4cf3-839e-1e487e9e7293": "talleres-diaz-utiel-74f7facd",
  "cdc34f95-7ac9-4fbe-9d10-788ed0e17d4b": "talleres-vigo-mayordomo-utiel-cdc34f95",
  "739b750e-1f26-4da4-b9d1-b68bfc64d98a": "auto-taller-bolbaite-bolbaite-739b750e",
  "b8645082-e83f-403e-9b48-0f264a3d2efa": "manuel-sorribes-gavara-nules-b8645082",
  "05d1c672-e121-4ed3-b62f-a73de9c7e5cb": "auto-chapa-castellon-castello-de-la-plana-05d1c672",
  "212f3243-9a32-4528-9003-162eb4edd30d": "auto-servicio-babel-alicante-212f3243"
};

const LEGACY_SLUG_TO_SLUG = {
  "antonio-perea-garcia-hondon-de-las-nieves-4a5dac44": "antonio-perea-garcia-hondon-de-las-nieves-4a5dac44",
  "taller-victoria-guardamar-guardamar-del-segura-f85efa90": "taller-victoria-guardamar-guardamar-del-segura-f85efa90",
  "autokryp-orihuela-c357b044": "autokryp-orihuela-c357b044",
  "civerlliria-lliria-950a1d4f": "civerlliria-lliria-950a1d4f",
  "auto-centers-ontinyent-ontinyent-9a8a95a9": "auto-centers-ontinyent-ontinyent-9a8a95a9",
  "confortauto-hnos-ortiz-peris-carlet-ead5c648": "confortauto-hnos-ortiz-peris-carlet-ead5c648",
  "cristalbox-orihuela-orihuela-81242af5": "cristalbox-orihuela-orihuela-81242af5",
  "chapa-y-pintura-hermanos-ayas-s-l-elche-feb4a90e": "chapa-y-pintura-hermanos-ayas-s-l-elche-feb4a90e",
  "automocion-garosa-s-l-les-coves-de-vinroma-8b2a207b": "automocion-garosa-s-l-les-coves-de-vinroma-8b2a207b",
  "nilbud-s-l-nules-95de87f8": "nilbud-s-l-nules-95de87f8",
  "francisco-alarcon-carrion-chiva-91effe30": "francisco-alarcon-carrion-chiva-91effe30",
  "niquelauto-castellon-castello-de-la-plana-58fbc458": "niquelauto-castellon-castello-de-la-plana-58fbc458",
  "auto-belmar-s-l-alcala-de-xivert-7e45310f": "auto-belmar-s-l-alcala-de-xivert-7e45310f",
  "talleres-hermanos-diaz-utiel-utiel-78d9c4bb": "talleres-diaz-utiel-74f7facd",
  "talleres-vigo-mayordomo-utiel-cdc34f95": "talleres-vigo-mayordomo-utiel-cdc34f95",
  "talleres-autocenter-los-montesinos-los-montesinos-075d866a": "talleres-autocenter-los-montesinos-los-montesinos-075d866a",
  "auto-taller-bolbaite-bolbaite-739b750e": "auto-taller-bolbaite-bolbaite-739b750e",
  "skoda-benicarlo-benicarlo-cac08503": "skoda-benicarlo-benicarlo-cac08503",
  "manuel-sorribes-gavara-nules-b8645082": "manuel-sorribes-gavara-nules-b8645082",
  "auto-chapa-castellon-castello-de-la-plana-05d1c672": "auto-chapa-castellon-castello-de-la-plana-05d1c672",
  "auto-servicio-babel-alicante-212f3243": "auto-servicio-babel-alicante-212f3243"
};

const LEGACY_NAME_TO_SLUG = {
  "antonio-perea-garcia": "antonio-perea-garcia-hondon-de-las-nieves-4a5dac44",
  "taller-victoria-guardamar": "taller-victoria-guardamar-guardamar-del-segura-f85efa90",
  "autokryp": "autokryp-orihuela-c357b044",
  "civerlliria": "civerlliria-lliria-950a1d4f",
  "auto-centers-ontinyent": "auto-centers-ontinyent-ontinyent-9a8a95a9",
  "confortauto-hnos-ortiz-peris": "confortauto-hnos-ortiz-peris-carlet-ead5c648",
  "cristalbox-orihuela": "cristalbox-orihuela-orihuela-81242af5",
  "chapa-y-pintura-hermanos-ayas-s-l": "chapa-y-pintura-hermanos-ayas-s-l-elche-feb4a90e",
  "automocion-garosa-s-l": "automocion-garosa-s-l-les-coves-de-vinroma-8b2a207b",
  "nilbud-s-l": "nilbud-s-l-nules-95de87f8",
  "francisco-alarcon-carrion": "francisco-alarcon-carrion-chiva-91effe30",
  "niquelauto-castellon": "niquelauto-castellon-castello-de-la-plana-58fbc458",
  "auto-belmar-s-l": "auto-belmar-s-l-alcala-de-xivert-7e45310f",
  "talleres-hermanos-diaz-utiel": "talleres-diaz-utiel-74f7facd",
  "talleres-vigo-mayordomo": "talleres-vigo-mayordomo-utiel-cdc34f95",
  "talleres-autocenter-los-montesinos": "talleres-autocenter-los-montesinos-los-montesinos-075d866a",
  "auto-taller-bolbaite": "auto-taller-bolbaite-bolbaite-739b750e",
  "skoda-benicarlo": "skoda-benicarlo-benicarlo-cac08503",
  "manuel-sorribes-gavara": "manuel-sorribes-gavara-nules-b8645082",
  "auto-chapa-castellon": "auto-chapa-castellon-castello-de-la-plana-05d1c672",
  "auto-servicio-babel": "auto-servicio-babel-alicante-212f3243",
  "automecanica-adell-s-l": "automecanica-adell-s-l-morella-2c27ccbc",
  "auto-belclaus-s-l": "auto-belclaus-s-l-benicarlo-6339a437",
  "taller-mecanica-y-electronica-jorge": "taller-mecanica-y-electronica-jorge-betxi-d422243d",
  "tallers-jose-marti-s-l": "tallers-jose-marti-s-l-segorbe-cf79adfa",
  "talleres-joaquin-romeu": "talleres-joaquin-romeu-canet-lo-roig-cc0ed77f",
  "taller-hermanos-albalat-c-b": "taller-hermanos-albalat-c-b-ribesalbes-46b962f1",
  "pitarch-c-b": "pitarch-c-b-alcala-de-xivert-2fbf5822",
  "nissan-almenar-castellon": "nissan-almenar-castellon-castello-de-la-plana-9a3de5b0",
  "talleres-madrigal-castellon": "talleres-madrigal-castellon-castello-de-la-plana-bc4915a5",
  "auto-servicio-morella": "auto-servicio-morella-morella-9c629e84",
  "talleres-ultimateauto-s-l": "talleres-ultimateauto-s-l-castello-de-la-plana-eea02352",
  "estilauto-c-b": "estilauto-c-b-borriana-40118fe6",
  "taller-la-vieta-c-b": "taller-la-vieta-c-b-la-vilavella-af0c0df9",
  "cadu-taller": "cadu-taller-castello-de-la-plana-aff1358f",
  "auto-betxi-s-l": "auto-betxi-s-l-betxi-46e49d41",
  "taller-fonollosa": "taller-fonollosa-vinaros-7675fcde",
  "bricoche-s-l": "bricoche-s-l-vila-real-0ad982cb",
  "talleres-madrigal": "talleres-chapa-y-pintura-madrigal-vila-real-4201afe2",
  "estilauto": "estilauto-c-b-borriana-40118fe6"
};

function first(value) {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function uuidValido(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolverSlug(request) {
  const query = request?.query || {};

  const slugQuery = first(query.slug);
  if (slugQuery) {
    const slugLegacy = slugify(slugQuery);
    return LEGACY_SLUG_TO_SLUG[slugLegacy] || slugLegacy;
  }

  const id = first(query.id);
  if (id && LEGACY_ID_TO_SLUG[id]) {
    return LEGACY_ID_TO_SLUG[id];
  }

  const nombre = first(query.nombre);
  if (nombre) {
    const nombreNormalizado = slugify(nombre);
    if (LEGACY_NAME_TO_SLUG[nombreNormalizado]) {
      return LEGACY_NAME_TO_SLUG[nombreNormalizado];
    }
  }

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

  response.statusCode = 301;
  response.setHeader(
    "Location",
    slug
      ? `${SITE_URL}/talleres/${encodeURIComponent(slug)}`
      : `${SITE_URL}/`
  );
  response.end();
}
