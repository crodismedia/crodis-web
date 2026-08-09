(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const PAGE_SIZE = 30;
    const BASE_TITLE = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    const BASE_DESCRIPTION = descriptionMeta?.content || "";
    const BASE_CANONICAL = new URL(
        canonicalLink?.href || `${window.location.origin}${window.location.pathname}`
    );

    if (!window.supabase?.createClient) {
        console.error("No se ha cargado la biblioteca de Supabase.");
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const labels = window.TallerMapServicios?.etiquetas || {};
    let offset = 0;
    let totalWorkshops = 0;
    let loading = false;
    let selectedService = "";
    let legacyWorkshopsPromise = null;

    function escapeHTML(value) {
        const element = document.createElement("div");
        element.textContent = value ?? "";
        return element.innerHTML;
    }

    function safeWeb(value) {
        if (!value) return "";
        try {
            const url = new URL(String(value));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function safeTerm(value) {
        return String(value || "")
            .replace(/[,%().]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
    }

    function municipalityAliases(name) {
        const aliases = String(name || "")
            .split("/")
            .map((part) => safeTerm(part))
            .filter(Boolean);
        return [...new Set(aliases.length ? aliases : [safeTerm(name)])];
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function workshopSlug(workshop) {
        if (workshop.slug) return String(workshop.slug);
        const base = `${workshop.nombre || "taller"}-${workshop.ciudad || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return workshop.id ? `${base}-${String(workshop.id).slice(0, 8)}` : base;
    }

    function workshopPageURL(workshop) {
        const slug = workshopSlug(workshop);
        return slug ? `/talleres/${encodeURIComponent(slug)}` : "";
    }

    function scheduleHTML(schedule) {
        if (!schedule || typeof schedule !== "object") return "";
        const days = [
            ["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"],
            ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"],
            ["domingo", "Domingo"]
        ];
        const rows = days.map(([key, label]) => {
            const value = schedule[key];
            if (!value) return "";
            const text = value.cerrado
                ? "Cerrado"
                : (value.turnos || []).map((slot) => `${slot.apertura}–${slot.cierre}`).join(" y ");
            return text ? `<div><dt>${label}</dt><dd>${escapeHTML(text)}</dd></div>` : "";
        }).filter(Boolean).join("");
        return rows
            ? `<details class="taller-horario"><summary>Ver horario semanal</summary><dl>${rows}</dl></details>`
            : "";
    }

    function cardHTML(workshop, index) {
        const name = escapeHTML(workshop.nombre || workshop.nombre_taller || "Taller sin nombre");
        const city = escapeHTML(workshop.ciudad || "");
        const province = escapeHTML(workshop.provincia || "");
        const address = escapeHTML(workshop.direccion || "");
        const description = escapeHTML(workshop.descripcion || "Información próximamente disponible.");
        const location = [address, city, province].filter(Boolean).join(", ");
        const phone = String(workshop.telefono || "").replace(/[^\d+]/g, "");
        const web = safeWeb(workshop.web);
        const photo = safeWeb(workshop.fotoFirmada);
        const services = Array.isArray(workshop.servicios) ? workshop.servicios : [];
        const serviceLabels = services.length ? services.slice(0, 4) : ["Taller mecánico"];
        const links = [];
        if (phone) links.push(`<a href="tel:${escapeHTML(phone)}" aria-label="Llamar a ${name}">Llamar</a>`);
        if (web) links.push(`<a href="${escapeHTML(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
        links.push(`<a class="enlace-ficha-taller" href="${escapeHTML(workshopPageURL(workshop))}">Ver ficha</a>`);

        return `
            <article class="taller-card" data-taller-index="${index}">
                <div class="taller-imagen taller-imagen-1">
                    ${photo ? `<img src="${escapeHTML(photo)}" alt="Fotografía de ${name}" loading="lazy" decoding="async">` : ""}
                    <span class="verificado">${workshop.verificado ? "✓ Verificado" : "Publicado"}</span>
                </div>
                <div class="taller-informacion">
                    <div class="valoracion">Ficha local <span>Taller publicado</span></div>
                    <h3>${name}</h3>
                    <p class="ubicacion">⌖ ${location || "Ubicación no indicada"}</p>
                    <p class="taller-descripcion">${description}</p>
                    <div class="especialidades">
                        ${serviceLabels.map((service) => `<span>${escapeHTML(labels[service] || service)}</span>`).join("")}
                    </div>
                    ${scheduleHTML(workshop.horarios)}
                    <div class="taller-pie">
                        <span class="abierto">● Disponible</span>
                        <span class="taller-contactos">${links.join("") || "Sin contacto publicado"}</span>
                    </div>
                </div>
            </article>
        `;
    }

    async function signedPhotos(workshops) {
        const paths = [...new Set(workshops
            .map((workshop) => Array.isArray(workshop.fotos) ? workshop.fotos[0] : "")
            .filter(Boolean))];
        if (!paths.length || !client.storage?.from) return workshops;

        const { data, error } = await client.storage
            .from("fotos-talleres")
            .createSignedUrls(paths, 3600);

        if (error) return workshops;
        const byPath = new Map((data || []).map((item) => [item.path, item.signedUrl || item.signedURL || ""]));
        return workshops.map((workshop) => ({
            ...workshop,
            fotoFirmada: byPath.get(Array.isArray(workshop.fotos) ? workshop.fotos[0] : "") || ""
        }));
    }

    async function loadPhotosAfterPaint(container, workshops, renderVersion) {
        try {
            const withPhotos = await signedPhotos(workshops);
            if (container.dataset.renderVersion !== renderVersion) return;

            withPhotos.forEach((workshop, index) => {
                const photo = safeWeb(workshop.fotoFirmada);
                if (!photo) return;
                const imageBox = container.querySelector(`[data-taller-index="${index}"] .taller-imagen`);
                if (!imageBox || imageBox.querySelector("img")) return;

                const image = document.createElement("img");
                image.src = photo;
                image.alt = `Fotografía de ${workshop.nombre || workshop.nombre_taller || "taller"}`;
                image.loading = "lazy";
                image.decoding = "async";
                imageBox.prepend(image);
            });
        } catch (error) {
            console.warn("Las fotos de los talleres se cargarán más tarde:", error);
        }
    }

    function setStatus(message) {
        const status = document.querySelector(".mapa-estado");
        if (status) status.textContent = message;
    }

    function setPagination(busy = false) {
        const wrapper = document.getElementById("contenedor-cargar-mas");
        const previous = document.getElementById("boton-pagina-anterior");
        const next = document.getElementById("boton-pagina-siguiente");
        const page = document.getElementById("estado-paginacion");
        if (!wrapper || !previous || !next || !page) return;
        const totalPages = Math.max(1, Math.ceil(totalWorkshops / PAGE_SIZE));
        const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
        wrapper.hidden = totalWorkshops <= PAGE_SIZE;
        const previousDisabled = busy || offset <= 0;
        const nextDisabled = busy || offset + PAGE_SIZE >= totalWorkshops;
        previous.classList.toggle("deshabilitado", previousDisabled);
        next.classList.toggle("deshabilitado", nextDisabled);
        previous.setAttribute("aria-disabled", String(previousDisabled));
        next.setAttribute("aria-disabled", String(nextDisabled));
        previous.href = pageURL(Math.max(1, currentPage - 1));
        next.href = pageURL(Math.min(totalPages, currentPage + 1));
        page.textContent = `Página ${currentPage} de ${totalPages}`;
        updateHeadPagination(currentPage, totalPages);
    }

    function requestedPage() {
        const value = Number(new URLSearchParams(window.location.search).get("pagina"));
        return Number.isInteger(value) && value > 0 ? value : 1;
    }

    function pageURL(pageNumber) {
        const url = new URL(window.location.href);
        if (pageNumber > 1) url.searchParams.set("pagina", String(pageNumber));
        else url.searchParams.delete("pagina");
        if (selectedService) url.searchParams.set("servicio", selectedService);
        else url.searchParams.delete("servicio");
        return `${url.pathname}${url.search}`;
    }

    function updateHeadSEO(pageNumber, totalPages, hasResults = true) {
        const validPage = hasResults && pageNumber >= 1 && pageNumber <= totalPages;
        const indexable = validPage && !selectedService;
        const canonicalURL = new URL(BASE_CANONICAL.href);

        if (indexable && pageNumber > 1) {
            canonicalURL.searchParams.set("pagina", String(pageNumber));
        }

        if (robotsMeta) {
            robotsMeta.content = indexable
                ? "index,follow,max-image-preview:large"
                : "noindex,follow,max-image-preview:large";
        }
        if (canonicalLink) canonicalLink.href = canonicalURL.href;

        document.title = indexable && pageNumber > 1
            ? `Página ${pageNumber} · ${BASE_TITLE}`
            : BASE_TITLE;
        if (descriptionMeta) {
            descriptionMeta.content = indexable && pageNumber > 1
                ? `Página ${pageNumber}. ${BASE_DESCRIPTION}`
                : BASE_DESCRIPTION;
        }
    }

    function navigateToPage(pageNumber, replace = false) {
        const url = pageURL(pageNumber);
        window.history[replace ? "replaceState" : "pushState"]({}, "", url);
        offset = (pageNumber - 1) * PAGE_SIZE;
    }

    function updateHeadPagination(currentPage, totalPages) {
        document.querySelectorAll('link[data-pagination="municipio"]').forEach((link) => link.remove());
        [["prev", currentPage - 1], ["next", currentPage + 1]].forEach(([rel, pageNumber]) => {
            if (pageNumber < 1 || pageNumber > totalPages) return;
            const link = document.createElement("link");
            link.rel = rel;
            link.href = new URL(pageURL(pageNumber), window.location.origin).href;
            link.dataset.pagination = "municipio";
            document.head.appendChild(link);
        });
    }

    async function loadLegacyWorkshops(municipality, aliases) {
        if (legacyWorkshopsPromise) return legacyWorkshopsPromise;
        legacyWorkshopsPromise = (async () => {
            const byId = new Map();
            for (const alias of aliases) {
                let from = 0;
                let total = Infinity;
                while (from < total && from < 10000) {
                    const { data, error } = await client.rpc("buscar_talleres_publicos", {
                        p_poblacion: alias,
                        p_servicio: selectedService,
                        p_desde: from,
                        p_limite: 100
                    });
                    if (error) throw error;
                    const batch = Array.isArray(data) ? data : [];
                    if (!batch.length) break;
                    batch.forEach((workshop) => {
                        const key = workshop.id || `${workshop.nombre}-${workshop.direccion}`;
                        byId.set(key, workshop);
                    });
                    const reported = Number(batch[0]?.total_resultados);
                    total = Number.isFinite(reported) ? reported : from + batch.length;
                    from += batch.length;
                    if (batch.length < 100) break;
                }
            }

            const normalizedAliases = municipalityAliases(municipality).map(normalizeText);
            return [...byId.values()]
                .filter((workshop) => normalizedAliases.includes(normalizeText(workshop.ciudad)))
                .sort((a, b) => String(a.nombre || "").localeCompare(
                    String(b.nombre || ""),
                    "es",
                    { sensitivity: "base" }
                ));
        })();
        return legacyWorkshopsPromise;
    }

    async function loadWorkshops(reset = true, keepRequestedPage = false) {
        const container = document.getElementById("lista-talleres");
        if (!container || loading) return;

        const municipality = container.dataset.municipio || "";
        const municipalityCode = container.dataset.codigoMunicipal || "";
        const aliases = municipalityAliases(municipality);
        if (reset) {
            offset = keepRequestedPage ? (requestedPage() - 1) * PAGE_SIZE : 0;
            totalWorkshops = 0;
            legacyWorkshopsPromise = null;
            container.innerHTML = `<p class="mensaje-talleres">Cargando talleres de ${escapeHTML(municipality)}…</p>`;
            setPagination(true);
        }

        loading = true;
        setPagination(true);

        try {
            const { data: directoryData, error: directoryError } = await client.rpc("buscar_talleres_municipio", {
                p_codigo_municipal: municipalityCode,
                p_servicio: selectedService,
                p_desde: offset,
                p_limite: PAGE_SIZE
            });
            let data;
            if (!directoryError) {
                data = Array.isArray(directoryData) ? directoryData : [];
            } else {
                const legacy = await loadLegacyWorkshops(municipality, aliases);
                data = legacy.slice(offset, offset + PAGE_SIZE);
                if (data.length) data[0] = { ...data[0], total_resultados: legacy.length };
            }

            if (!data?.length && reset) {
                container.innerHTML = `
                    <div class="municipio-sin-talleres">
                        <h3>Todavía no hay talleres publicados en ${escapeHTML(municipality)}</h3>
                        <p>Un taller de esta población puede solicitar gratuitamente su alta en TallerMap.</p>
                        <a class="boton" href="../pages/registro.html">Registrar un taller</a>
                    </div>
                `;
                setStatus("0 talleres publicados");
                updateHeadSEO(requestedPage(), 0, false);
                setPagination(false);
                return;
            }
            if (!data?.length) {
                setPagination(false);
                return;
            }

            const renderVersion = `${Date.now()}-${offset}-${selectedService}`;
            container.dataset.renderVersion = renderVersion;
            container.innerHTML = data.map((workshop, index) => cardHTML(workshop, index)).join("");

            const totalReported = Number(data[0]?.total_resultados);
            if (Number.isFinite(totalReported)) totalWorkshops = totalReported;
            else totalWorkshops = Math.max(totalWorkshops, offset + data.length);
            updateHeadSEO(
                Math.floor(offset / PAGE_SIZE) + 1,
                Math.max(1, Math.ceil(totalWorkshops / PAGE_SIZE))
            );
            setStatus(`${totalWorkshops} ${totalWorkshops === 1 ? "taller publicado" : "talleres publicados"}`);
            setPagination(false);

            void loadPhotosAfterPaint(container, data, renderVersion);
        } catch (error) {
            console.error("No se pudieron cargar los talleres del municipio:", error);
            if (reset) {
                container.innerHTML = "<p class=\"mensaje-talleres\">No se pudieron cargar los talleres en este momento.</p>";
            }
            setStatus("Error al cargar");
            setPagination(false);
        } finally {
            loading = false;
        }
    }

    function init() {
        const form = document.getElementById("buscador-municipio");
        const service = document.getElementById("servicio");
        const pagination = document.getElementById("contenedor-cargar-mas");
        if (pagination) {
            pagination.classList.add("municipio-paginacion");
            pagination.innerHTML = `
                <a id="boton-pagina-anterior" class="boton boton-claro" href="?">← Anterior</a>
                <span id="estado-paginacion" aria-live="polite">Página 1 de 1</span>
                <a id="boton-pagina-siguiente" class="boton" href="?pagina=2">Siguiente →</a>
            `;
        }
        const previousButton = document.getElementById("boton-pagina-anterior");
        const nextButton = document.getElementById("boton-pagina-siguiente");

        selectedService = new URLSearchParams(window.location.search).get("servicio") || "";
        if (service && selectedService) service.value = selectedService;
        updateHeadSEO(requestedPage(), Number.MAX_SAFE_INTEGER);

        form?.addEventListener("submit", (event) => {
            event.preventDefault();
            selectedService = service?.value || "";
            navigateToPage(1);
            updateHeadSEO(1, Number.MAX_SAFE_INTEGER);
            loadWorkshops(true);
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });

        previousButton?.addEventListener("click", (event) => {
            event.preventDefault();
            if (previousButton.getAttribute("aria-disabled") === "true") return;
            navigateToPage(Math.max(1, Math.floor(offset / PAGE_SIZE)));
            loadWorkshops(false);
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });
        nextButton?.addEventListener("click", (event) => {
            event.preventDefault();
            if (offset + PAGE_SIZE >= totalWorkshops) return;
            navigateToPage(Math.floor(offset / PAGE_SIZE) + 2);
            loadWorkshops(false);
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });
        window.addEventListener("popstate", () => {
            selectedService = new URLSearchParams(window.location.search).get("servicio") || "";
            if (service) service.value = selectedService;
            updateHeadSEO(requestedPage(), Number.MAX_SAFE_INTEGER);
            loadWorkshops(true, true);
        });
        loadWorkshops(true, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
