import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const PAGE_SIZE = 30;
const PROVINCIAS = {
    alicante: "Alicante",
    castellon: "Castellón",
    valencia: "Valencia"
};

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function rpc(name, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`${name}: ${response.status} ${detail.slice(0, 200)}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function renderMunicipios(rows) {
    if (!rows.length) return '<li class="mensaje-talleres">No hay municipios con talleres publicados.</li>';
    return rows
        .filter((row) => Number(row.total_talleres) > 0 && row.municipio && row.codigo_municipal)
        .sort((a, b) => String(a.municipio).localeCompare(String(b.municipio), "es", { sensitivity: "base" }))
        .map((row) => {
            const total = Number(row.total_talleres) || 0;
            const archivo = `${slugify(row.municipio)}-${escapeHTML(row.codigo_municipal)}.html`;
            return `<li><a href="../municipios/${archivo}"><strong>${escapeHTML(row.municipio)}</strong><span>${total} ${total === 1 ? "taller" : "talleres"}</span></a></li>`;
        }).join("");
}

function workshopSlug(row) {
    if (row.slug) return String(row.slug);
    const base = slugify(`${row.nombre || "taller"}-${row.ciudad || ""}`);
    return row.id ? `${base}-${String(row.id).slice(0, 8)}` : base;
}

function renderTalleres(rows) {
    if (!rows.length) return '<p class="mensaje-talleres">Todavía no hay talleres publicados en esta provincia.</p>';
    return rows.map((row) => {
        const nombre = row.nombre || row.nombre_taller || "Taller sin nombre";
        const ubicacion = [row.direccion, row.ciudad, row.provincia].filter(Boolean).join(", ");
        const slug = workshopSlug(row);
        return `<article class="taller-card taller-card-inicial"><div class="taller-informacion"><h3><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${escapeHTML(nombre)}</a></h3><p class="ubicacion">⌖ ${escapeHTML(ubicacion || "Ubicación no indicada")}</p><div class="taller-pie"><span class="taller-contactos"><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a></span></div></div></article>`;
    }).join("");
}

function inject(html, municipiosHTML, talleresHTML, total) {
    html = html.replace(
        /(<ul id="lista-municipios-provincia"[^>]*>)[\s\S]*?(<\/ul>)/i,
        `$1${municipiosHTML}$2`
    );
    html = html.replace(
        /(<div id="lista-talleres-provincia"[^>]*>)[\s\S]*?(<\/div>\s*<div id="contenedor-cargar-mas-provincia")/i,
        `$1${talleresHTML}$2`
    );
    html = html.replace(
        /(<span id="estado-provincia"[^>]*>)[\s\S]*?(<\/span>)/i,
        `$1${total} ${total === 1 ? "taller" : "talleres"}$2`
    );
    return html;
}

export default async function handler(request, response) {
    const slug = String(request.query?.provincia || "").toLowerCase().replace(/\.html$/, "");
    const provincia = PROVINCIAS[slug];
    if (!provincia) {
        response.status(404).send("Provincia no encontrada");
        return;
    }

    let html;
    try {
        html = fs.readFileSync(path.join(process.cwd(), "provincias", `${slug}.html`), "utf8");
    } catch (error) {
        console.error(error);
        response.status(500).send("No se pudo renderizar la provincia");
        return;
    }

    try {
        const pagina = Math.max(1, Number.parseInt(String(request.query?.pagina || "1"), 10) || 1);
        const desde = (pagina - 1) * PAGE_SIZE;
        const [municipios, talleres] = await Promise.all([
            rpc("listar_municipios_publicos", { p_provincia: provincia }),
            rpc("buscar_talleres_provincia", { p_provincia: provincia, p_desde: desde, p_limite: PAGE_SIZE })
        ]);
        const total = Number(talleres[0]?.total_resultados) || talleres.length;
        html = inject(html, renderMunicipios(municipios), renderTalleres(talleres), total);
        response.setHeader("X-TallerMap-Province-SSR", "1");
    } catch (error) {
        console.error("SSR provincia falló; se mantiene fallback JS:", error);
        response.setHeader("X-TallerMap-Province-SSR", "0");
    }

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    response.status(200).send(html);
}
