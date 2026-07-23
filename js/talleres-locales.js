(function () {
    "use strict";

    const scriptActual = document.currentScript;
    const urlDatos = scriptActual?.src
        ? new URL("../data/talleres-silla.json", scriptActual.src).href
        : "data/talleres-silla.json";

    let talleresLocales = [];
    let temporizador = null;
    let observador = null;

    function normalizar(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function escapar(valor) {
        if (typeof window.escaparHTML === "function") {
            return window.escaparHTML(valor);
        }
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function urlSegura(valor) {
        if (!valor) return "";
        try {
            const url = new URL(String(valor));
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch (_error) {
            return "";
        }
    }

    function telefonoLimpio(valor) {
        return String(valor || "").replace(/[^\d+]/g, "");
    }

    function etiquetaServicio(servicio) {
        return window.TallerMapServicios?.etiquetas?.[servicio] || servicio;
    }

    function coincidePoblacion(taller, poblacion) {
        const termino = normalizar(poblacion);
        if (!termino) return true;
        return normalizar([
            taller.ciudad,
            taller.provincia,
            taller.codigo_postal,
            taller.direccion
        ].join(" ")).includes(termino);
    }

    function coincideServicio(taller, servicio) {
        return !servicio || (Array.isArray(taller.servicios) && taller.servicios.includes(servicio));
    }

    function crearTarjeta(taller) {
        const nombre = escapar(taller.nombre || "Taller sin nombre");
        const ubicacion = [taller.direccion, taller.ciudad, taller.provincia]
            .filter(Boolean)
            .map(escapar)
            .join(", ");
        const telefono = telefonoLimpio(taller.telefono);
        const whatsapp = telefonoLimpio(taller.movil_whatsapp);
        const web = urlSegura(taller.web);
        const enlaces = [];

        if (telefono) {
            enlaces.push(`<a href="tel:${escapar(telefono)}" aria-label="Llamar a ${nombre}">Llamar</a>`);
        }
        if (whatsapp) {
            const numeroWhatsApp = whatsapp.startsWith("+")
                ? whatsapp.replace(/[^\d]/g, "")
                : `34${whatsapp.replace(/[^\d]/g, "")}`;
            enlaces.push(
                `<a href="https://wa.me/${escapar(numeroWhatsApp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
            );
        }
        if (web) {
            enlaces.push(`<a href="${escapar(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);
        }

        const servicios = Array.isArray(taller.servicios) && taller.servicios.length
            ? taller.servicios.slice(0, 4)
            : ["mecanica-general"];
        const horario = taller.horario
            ? `<details class="taller-horario"><summary>Ver horario publicado</summary><p>${escapar(taller.horario)}</p></details>`
            : "";

        return `
            <article class="taller-card" data-taller-local="silla" data-taller-nombre="${escapar(normalizar(taller.nombre))}">
                <div class="taller-imagen taller-imagen-1">
                    <span class="verificado">Publicado</span>
                </div>
                <div class="taller-informacion">
                    <div class="valoracion">★ Nuevo <span>Ficha recopilada públicamente</span></div>
                    <h3>${nombre}</h3>
                    <p class="ubicacion">⌖ ${ubicacion || "Silla, Valencia"}</p>
                    <p class="taller-descripcion">${escapar(taller.descripcion || "Información pública disponible.")}</p>
                    <div class="especialidades">
                        ${servicios.map((servicio) => `<span>${escapar(etiquetaServicio(servicio))}</span>`).join("")}
                    </div>
                    ${horario}
                    <div class="taller-pie">
                        <span class="abierto">● Publicado</span>
                        ${enlaces.length
                            ? `<span class="taller-contactos">${enlaces.join("")}</span>`
                            : "<span>Contacto pendiente de confirmar</span>"}
                    </div>
                </div>
            </article>
        `;
    }

    function totalRemotoDesdeIndicador() {
        const indicador = document.querySelector(".mapa-estado");
        const coincidencia = String(indicador?.textContent || "").match(/\d+/);
        return coincidencia ? Number(coincidencia[0]) : null;
    }

    function aplicarTalleresLocales() {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor || !talleresLocales.length) return;

        const poblacion = document.getElementById("poblacion")?.value || "";
        const servicio = document.getElementById("servicio")?.value || "";
        const filtrados = talleresLocales.filter((taller) =>
            taller.activo !== false
            && coincidePoblacion(taller, poblacion)
            && coincideServicio(taller, servicio)
        );

        const totalRemoto = totalRemotoDesdeIndicador();
        observador?.disconnect();
        contenedor.querySelectorAll("[data-taller-local='silla']").forEach((elemento) => elemento.remove());

        const nombresRemotos = new Set(
            [...contenedor.querySelectorAll(".taller-card:not([data-taller-local]) h3")]
                .map((elemento) => normalizar(elemento.textContent))
        );
        const sinDuplicar = filtrados.filter((taller) => !nombresRemotos.has(normalizar(taller.nombre)));

        if (sinDuplicar.length) {
            contenedor.querySelectorAll(".mensaje-talleres").forEach((mensaje) => mensaje.remove());
            contenedor.insertAdjacentHTML(
                "beforeend",
                sinDuplicar.map(crearTarjeta).join("")
            );
        }

        const indicador = document.querySelector(".mapa-estado");
        if (indicador && totalRemoto !== null) {
            const total = totalRemoto + sinDuplicar.length;
            indicador.textContent = `${total} ${total === 1 ? "disponible" : "disponibles"}`;
        } else if (indicador && sinDuplicar.length) {
            indicador.textContent = `${sinDuplicar.length} disponibles`;
        }

        observador?.observe(contenedor, { childList: true, subtree: true });
    }

    function programarAplicacion(retraso = 160) {
        window.clearTimeout(temporizador);
        temporizador = window.setTimeout(aplicarTalleresLocales, retraso);
    }

    function ajustarContadores() {
        let intentos = 0;
        const intervalo = window.setInterval(() => {
            intentos += 1;
            ["contador-altas-cabecera", "estadistica-talleres"].forEach((id) => {
                const elemento = document.getElementById(id);
                if (!elemento) return;
                const actual = Number(String(elemento.textContent || "").replace(/[^\d]/g, ""));
                if (!Number.isFinite(actual)) return;

                if (!elemento.dataset.totalSupabase) {
                    elemento.dataset.totalSupabase = String(actual);
                }
                const base = Number(elemento.dataset.totalSupabase);
                elemento.textContent = new Intl.NumberFormat("es-ES").format(base + talleresLocales.length);
            });
            if (intentos >= 20) window.clearInterval(intervalo);
        }, 300);
    }

    async function iniciar() {
        const contenedor = document.getElementById("lista-talleres");
        if (!contenedor) return;

        try {
            const respuesta = await fetch(urlDatos, {
                headers: { Accept: "application/json" },
                cache: "no-cache"
            });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const datos = await respuesta.json();
            talleresLocales = Array.isArray(datos?.talleres) ? datos.talleres : [];
        } catch (error) {
            console.error("No se pudo cargar el catálogo público de talleres de Silla:", error);
            return;
        }

        observador = new MutationObserver(() => programarAplicacion());
        observador.observe(contenedor, { childList: true, subtree: true });

        document.querySelector("form.buscador")?.addEventListener("submit", () => {
            programarAplicacion(500);
        });

        ajustarContadores();
        programarAplicacion(350);
        console.info(`TallerMap: ${talleresLocales.length} talleres públicos de Silla preparados.`);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
}());
