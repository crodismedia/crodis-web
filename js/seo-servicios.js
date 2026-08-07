(function () {
    "use strict";

    const SITE_URL = "https://www.tallermap.es";

    function asegurarMeta(selector, atributos) {
        let elemento = document.head.querySelector(selector);
        if (!elemento) {
            elemento = document.createElement("meta");
            Object.entries(atributos).forEach(([clave, valor]) => elemento.setAttribute(clave, valor));
            document.head.appendChild(elemento);
        }
        return elemento;
    }

    function nombreServicio() {
        return document.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim() || "Servicios de automoción";
    }

    function descripcionServicio() {
        return document.querySelector('meta[name="description"]')?.content
            || document.querySelector(".hero-descripcion")?.textContent.trim()
            || `Consulta ${nombreServicio().toLowerCase()} en TallerMap.`;
    }

    function iniciar() {
        const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
        const titulo = document.title || `${nombreServicio()} | TallerMap`;
        const descripcion = descripcionServicio().slice(0, 158);

        const ogTitle = asegurarMeta('meta[property="og:title"]', { property: "og:title" });
        const ogDescription = asegurarMeta('meta[property="og:description"]', { property: "og:description" });
        const ogUrl = asegurarMeta('meta[property="og:url"]', { property: "og:url" });
        const ogType = asegurarMeta('meta[property="og:type"]', { property: "og:type" });
        const ogSite = asegurarMeta('meta[property="og:site_name"]', { property: "og:site_name" });
        const twitterCard = asegurarMeta('meta[name="twitter:card"]', { name: "twitter:card" });
        const twitterTitle = asegurarMeta('meta[name="twitter:title"]', { name: "twitter:title" });
        const twitterDescription = asegurarMeta('meta[name="twitter:description"]', { name: "twitter:description" });

        ogTitle.content = titulo;
        ogDescription.content = descripcion;
        ogUrl.content = canonical;
        ogType.content = "website";
        ogSite.content = "TallerMap";
        twitterCard.content = "summary_large_image";
        twitterTitle.content = titulo;
        twitterDescription.content = descripcion;

        const existente = document.querySelector('script[data-seo-servicio="true"]');
        if (existente) return;

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.dataset.seoServicio = "true";
        script.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: nombreServicio(),
            description: descripcion,
            url: canonical,
            isPartOf: {
                "@type": "WebSite",
                name: "TallerMap",
                url: `${SITE_URL}/`
            }
        });
        document.head.appendChild(script);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
}());