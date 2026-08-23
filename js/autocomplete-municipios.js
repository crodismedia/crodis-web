(function () {
    "use strict";

    const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
    const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

    const normalizar = valor => String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    async function cargarMunicipios() {
        const params = new URLSearchParams({
            select: "nombre,provincia,codigo_municipal,nombre_busqueda",
            activo: "eq.true",
            order: "nombre.asc"
        });
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/municipios?${params.toString()}`, {
                headers: { apikey: SUPABASE_KEY, Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.warn("No se pudo cargar el catálogo de municipios:", error);
            return [];
        }
    }

    async function iniciar() {
        const input = document.getElementById("poblacion");
        const contenedor = input?.closest(".poblacion-controles");
        if (!input || !contenedor || input.dataset.autocompleteMunicipios === "1") return;

        input.dataset.autocompleteMunicipios = "1";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-controls", "sugerencias-poblacion");
        input.setAttribute("aria-expanded", "false");

        let lista = document.getElementById("sugerencias-poblacion");
        if (!lista) {
            lista = document.createElement("div");
            lista.id = "sugerencias-poblacion";
            lista.setAttribute("role", "listbox");
            lista.setAttribute("aria-label", "Sugerencias de población");
            contenedor.appendChild(lista);
        }
        lista.hidden = true;

        let catalogo = [];
        let cargando = null;
        let indiceActivo = -1;

        const cerrar = () => {
            lista.replaceChildren();
            lista.hidden = true;
            indiceActivo = -1;
            input.setAttribute("aria-expanded", "false");
        };

        const cargarCatalogo = () => {
            if (catalogo.length) return Promise.resolve(catalogo);
            if (cargando) return cargando;
            cargando = cargarMunicipios().then(data => {
                cargando = null;
                const vistos = new Set();
                catalogo = data.filter(item => {
                    const clave = `${normalizar(item.nombre)}|${item.codigo_municipal || ""}`;
                    if (!item.nombre || vistos.has(clave)) return false;
                    vistos.add(clave);
                    item._nombreNormalizado = normalizar(item.nombre);
                    item._busquedaNormalizada = normalizar(item.nombre_busqueda || item.nombre);
                    return true;
                });
                return catalogo;
            });
            return cargando;
        };

        const seleccionar = item => {
            input.value = item.nombre || "";
            input.dataset.codigoMunicipal = item.codigo_municipal || "";
            cerrar();
            input.focus();
        };

        const mostrar = resultados => {
            lista.replaceChildren();
            indiceActivo = -1;
            if (!resultados.length) return cerrar();
            resultados.forEach((item, indice) => {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.className = "sugerencia-poblacion";
                boton.setAttribute("role", "option");
                boton.dataset.indice = String(indice);
                const nombre = document.createElement("strong");
                nombre.textContent = item.nombre || "";
                boton.appendChild(nombre);
                if (item.provincia) {
                    const provincia = document.createElement("span");
                    provincia.textContent = item.provincia;
                    boton.appendChild(provincia);
                }
                boton.addEventListener("pointerdown", evento => evento.preventDefault());
                boton.addEventListener("click", () => seleccionar(item));
                lista.appendChild(boton);
            });
            lista.hidden = false;
            input.setAttribute("aria-expanded", "true");
        };

        const buscar = async () => {
            const termino = normalizar(input.value);
            if (termino.length < 2) return cerrar();
            const municipios = await cargarCatalogo();
            const comienzan = [];
            const contienen = [];
            municipios.forEach(item => {
                const nombre = item._nombreNormalizado || "";
                const busqueda = item._busquedaNormalizada || "";
                if (nombre.startsWith(termino) || busqueda.startsWith(termino)) comienzan.push(item);
                else if (nombre.includes(termino) || busqueda.includes(termino)) contienen.push(item);
            });
            mostrar(comienzan.concat(contienen).slice(0, 8));
        };

        const moverFoco = direccion => {
            const botones = [...lista.querySelectorAll("button.sugerencia-poblacion")];
            if (!botones.length) return;
            indiceActivo = Math.max(0, Math.min(botones.length - 1, indiceActivo + direccion));
            botones[indiceActivo].focus();
        };

        input.addEventListener("input", evento => {
            evento.stopImmediatePropagation();
            input.dataset.codigoMunicipal = "";
            void buscar();
        }, true);
        input.addEventListener("focus", evento => {
            evento.stopImmediatePropagation();
            if (normalizar(input.value).length >= 2) void buscar();
        }, true);
        input.addEventListener("keydown", evento => {
            if (evento.key === "Escape") return cerrar();
            if (evento.key === "ArrowDown" && !lista.hidden) {
                evento.preventDefault();
                evento.stopImmediatePropagation();
                moverFoco(1);
            }
        }, true);
        lista.addEventListener("keydown", evento => {
            if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
                evento.preventDefault();
                const botones = [...lista.querySelectorAll("button.sugerencia-poblacion")];
                const actual = botones.indexOf(document.activeElement);
                const siguiente = evento.key === "ArrowDown" ? Math.min(botones.length - 1, actual + 1) : Math.max(0, actual - 1);
                botones[siguiente]?.focus();
            }
            if (evento.key === "Escape") {
                cerrar();
                input.focus();
            }
        });
        document.addEventListener("pointerdown", evento => {
            if (!contenedor.contains(evento.target)) cerrar();
        });

        void cargarCatalogo();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void iniciar(), { once: true });
    else void iniciar();
}());
