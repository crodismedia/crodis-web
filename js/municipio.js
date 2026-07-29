(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
    const PAGE_SIZE = 30;

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

    function cardHTML(workshop) {
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

        return `
            <article class="taller-card">
                <div class="taller-imagen taller-imagen-1">
                    ${photo ? `<img src="${escapeHTML(photo)}" alt="Fotografía de ${name}" loading="lazy">` : ""}
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

    function setStatus(message) {
        const status = document.querySelector(".mapa-estado");
        if (status) status.textContent = message;
    }

    function setLoadMore(show, busy = false) {
        const wrapper = document.getElementById("contenedor-cargar-mas");
        const button = document.getElementById("boton-cargar-mas");
        if (!wrapper || !button) return;
        wrapper.hidden = !show;
        button.disabled = busy;
        button.textContent = busy ? "Cargando talleres…" : "Cargar más talleres";
    }

    async function loadWorkshops(reset = true) {
        const container = document.getElementById("lista-talleres");
        if (!container || loading) return;

        const municipality = container.dataset.municipio || "";
        const aliases = municipalityAliases(municipality);
        if (reset) {
            offset = 0;
            totalWorkshops = 0;
            container.innerHTML = `<p class="mensaje-talleres">Cargando talleres de ${escapeHTML(municipality)}…</p>`;
            setLoadMore(false);
        }

        loading = true;
        if (!reset) setLoadMore(true, true);

        try {
            const { data, error } = await client.rpc("buscar_talleres_publicos", {
                p_poblacion: aliases.join("|"),
                p_servicio: selectedService,
                p_desde: offset,
                p_limite: PAGE_SIZE
            });
            if (error) throw error;

            if (!data?.length && reset) {
                container.innerHTML = `
                    <div class="municipio-sin-talleres">
                        <h3>Todavía no hay talleres publicados en ${escapeHTML(municipality)}</h3>
                        <p>Un taller de esta población puede solicitar gratuitamente su alta en TallerMap.</p>
                        <a class="boton" href="../pages/registro.html">Registrar un taller</a>
                    </div>
                `;
                setStatus("0 talleres publicados");
                setLoadMore(false);
                return;
            }
            if (!data?.length) {
                setLoadMore(false);
                return;
            }

            const withPhotos = await signedPhotos(data || []);
            const cards = withPhotos.map(cardHTML).join("");
            if (reset) container.innerHTML = cards;
            else container.insertAdjacentHTML("beforeend", cards);

            offset += data.length;
            const totalReported = Number(data[0]?.total_resultados);
            if (Number.isFinite(totalReported)) totalWorkshops = totalReported;
            else totalWorkshops = Math.max(totalWorkshops, offset);
            const more = offset < totalWorkshops;
            setStatus(`${totalWorkshops} ${totalWorkshops === 1 ? "taller publicado" : "talleres publicados"}`);
            setLoadMore(more);
        } catch (error) {
            console.error("No se pudieron cargar los talleres del municipio:", error);
            if (reset) {
                container.innerHTML = "<p class=\"mensaje-talleres\">No se pudieron cargar los talleres en este momento.</p>";
            }
            setStatus("Error al cargar");
            setLoadMore(false);
        } finally {
            loading = false;
        }
    }

    function init() {
        const form = document.getElementById("buscador-municipio");
        const service = document.getElementById("servicio");
        const moreButton = document.getElementById("boton-cargar-mas");

        form?.addEventListener("submit", (event) => {
            event.preventDefault();
            selectedService = service?.value || "";
            loadWorkshops(true);
            document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
        });

        moreButton?.addEventListener("click", () => loadWorkshops(false));
        loadWorkshops(true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
