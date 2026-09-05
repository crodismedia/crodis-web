(() => {
  "use strict";

  const asegurarConsentimiento = () => {
    if (window.__tallerMapCookieConsentLoaded || document.querySelector('script[src*="cookie-consent.js"]')) return;
    const script = document.createElement("script");
    script.src = "/js/cookie-consent.js?v=20260903-1";
    script.defer = true;
    document.head.appendChild(script);
  };

  asegurarConsentimiento();

  const form = document.getElementById("buscador-municipio");
  const select = document.getElementById("servicio");
  const list = document.getElementById("lista-talleres");
  if (!form || !select || !list) return;

  const slugify = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const esAlicante = /^03\d{3}$/.test(String(list.dataset.codigoMunicipal || "").trim());

  const prepararAccionesPublicasAlicante = () => {
    if (!esAlicante) return;

    if (!document.getElementById("tm-municipio-alicante-acciones")) {
      const style = document.createElement("style");
      style.id = "tm-municipio-alicante-acciones";
      style.textContent = `
        #lista-talleres[data-codigo-municipal^="03"] .taller-card .taller-contactos .accion-mapa {
          display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;
          border:1px solid #df7418;border-radius:11px;background:linear-gradient(135deg,#f5a23b,#ed7f1d);
          color:#fff!important;-webkit-text-fill-color:#fff!important;font-weight:850;line-height:1.15;
          text-decoration:none;box-shadow:0 8px 18px rgba(237,127,29,.24);
          transition:transform .15s ease,filter .15s ease,box-shadow .15s ease
        }
        #lista-talleres[data-codigo-municipal^="03"] .taller-card .taller-contactos .accion-mapa::before {
          content:"⌖";margin-right:7px;font-size:16px
        }
        #lista-talleres[data-codigo-municipal^="03"] .taller-card .taller-contactos .accion-mapa:hover {
          filter:brightness(.96);transform:translateY(-1px);box-shadow:0 11px 22px rgba(237,127,29,.30)
        }
        #lista-talleres[data-codigo-municipal^="03"] .taller-card .taller-contactos .accion-mapa:focus-visible {
          outline:3px solid rgba(245,162,59,.32);outline-offset:2px
        }`;
      document.head.appendChild(style);
    }

    list.querySelectorAll(".taller-card .accion-mapa").forEach(link => {
      try {
        const current = new URL(link.href, window.location.href);
        let destination = "";
        if (current.pathname.includes("/maps/search/")) destination = current.searchParams.get("query") || "";
        else if (current.pathname.includes("/maps/dir/")) destination = current.searchParams.get("destination") || "";
        if (!destination) return;
        link.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
        link.classList.add("accion-mapa-alicante");
      } catch (_) {
        // Conserva el enlace original si no se puede interpretar.
      }
    });
  };

  prepararAccionesPublicasAlicante();

  const cards = Array.from(list.querySelectorAll(".taller-card"));
  const counter = document.querySelector(".orden-talleres.mapa-estado");

  const cardMatchesService = (card, service) => {
    if (!service) return true;
    const visibleServices = Array.from(card.querySelectorAll(".especialidades span")).map(span => slugify(span.textContent));
    if (visibleServices.includes(service)) return true;
    const description = String(card.querySelector(".taller-descripcion")?.textContent || "").toLocaleLowerCase("es");
    return description.includes(service.toLocaleLowerCase("es"));
  };

  const applyFilter = (updateUrl = true) => {
    const service = String(select.value || "").trim();
    let visible = 0;

    cards.forEach(card => {
      const matches = cardMatchesService(card, service);
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (counter) counter.textContent = `${visible} ${visible === 1 ? "taller publicado" : "talleres publicados"}`;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (service) url.searchParams.set("servicio", service);
      else url.searchParams.delete("servicio");
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  form.addEventListener("submit", event => {
    event.preventDefault();
    applyFilter(true);
    document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const initial = new URLSearchParams(window.location.search).get("servicio") || "";
  if (initial && Array.from(select.options).some(option => option.value === initial)) {
    select.value = initial;
    applyFilter(false);
  }
})();
