(function () {
  "use strict";

  if (!/\/pages\/taller\.html$/i.test(window.location.pathname)) return;

  const params = new URLSearchParams(window.location.search);
  const slug = String(params.get("slug") || "").trim();
  const id = String(params.get("id") || "").trim();

  function slugSeguro(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function irASlug(valor) {
    const destino = slugSeguro(valor);
    if (!destino) return false;
    window.location.replace(`/talleres/${encodeURIComponent(destino)}`);
    return true;
  }

  if (slug && irASlug(slug)) return;

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return;

  const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
  const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

  async function resolverPorId() {
    try {
      const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_taller_publico`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_id: id, p_slug: null })
      });

      if (!respuesta.ok) return;
      const filas = await respuesta.json();
      const taller = Array.isArray(filas) ? filas[0] : null;
      if (taller?.slug) irASlug(taller.slug);
    } catch (_error) {
      // La ficha antigua mantiene su noindex si no puede resolverse.
    }
  }

  resolverPorId();
}());
