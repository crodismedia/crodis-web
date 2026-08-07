(function () {
  "use strict";
  const enlace = document.getElementById("reclamar-ficha");
  if (!enlace) return;

  function slugActual() {
    const ruta = window.__TALLERMAP_URL_LIMPIA__ || window.location.pathname;
    if (String(ruta).startsWith("/talleres/")) {
      return decodeURIComponent(String(ruta).slice("/talleres/".length).split("/")[0] || "").trim();
    }
    return String(new URLSearchParams(window.location.search).get("slug") || "").trim();
  }

  const slug = slugActual();
  if (!slug) return;
  enlace.href = `/pages/reclamar-taller.html?slug=${encodeURIComponent(slug)}`;
  enlace.removeAttribute("target");
  enlace.textContent = "Soy el propietario: reclamar ficha";
}());