export const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
export const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

export function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function workshopSlug(workshop) {
    if (workshop?.slug) return String(workshop.slug);
    const base = slugify(`${workshop?.nombre || workshop?.nombre_taller || "taller"}-${workshop?.ciudad || ""}`);
    return workshop?.id ? `${base}-${String(workshop.id).slice(0, 8)}` : base;
}

export function safeWeb(value) {
    if (!value) return "";
    try {
        const url = new URL(String(value));
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_error) {
        return "";
    }
}

export function safePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (/^0034\d{9}$/.test(digits)) return digits.slice(4);
    if (/^34\d{9}$/.test(digits)) return digits.slice(2);
    return digits.length >= 9 ? digits.slice(-9) : digits.slice(0, 20);
}

export function formatPhoneDisplay(value) {
    const phone = safePhone(value);
    const match = phone.match(/^(\d{3})(\d{3})(\d{3})$/);
    if (!match) return phone;
    return `${match[1]} ${match[2]} ${match[3]}`;
}

const SERVICE_LABELS = Object.freeze({
    "mecanica-general": "Mecánica general",
    "mantenimiento-programado": "Revisión y mantenimiento programado",
    "cambio-aceite-filtros": "Cambio de aceite y filtros",
    "pre-itv": "Revisión Pre-ITV",
    "frenos": "Frenos",
    "embrague": "Embrague",
    "correa-distribucion": "Correa de distribución",
    "cadena-distribucion": "Cadena de distribución",
    "reparacion-motor": "Reparación de motor",
    "sistema-refrigeracion": "Sistema de refrigeración",
    "escape-catalizador": "Escape y catalizador",
    "caja-cambios": "Caja de cambios",
    "neumaticos": "Neumáticos",
    "alineacion-direccion": "Alineación y dirección",
    "equilibrado-ruedas": "Equilibrado de ruedas",
    "suspension-amortiguadores": "Suspensión y amortiguadores",
    "direccion": "Sistema de dirección",
    "diagnosis-electronica": "Diagnosis electrónica",
    "electricidad-automovil": "Electricidad del automóvil",
    "baterias": "Baterías",
    "alternador-motor-arranque": "Alternador y motor de arranque",
    "centralitas-electronica": "Centralitas y electrónica",
    "sistemas-adas": "Sistemas ADAS y ayudas a la conducción",
    "llaves-codificacion": "Llaves y codificación",
    "chapa-pintura": "Chapa y pintura",
    "carroceria": "Reparación de carrocería",
    "lunas-cristales": "Lunas y cristales",
    "desabollado-sin-pintura": "Desabollado sin pintura",
    "tapiceria": "Tapicería",
    "aire-acondicionado": "Aire acondicionado",
    "calefaccion-climatizacion": "Calefacción y climatización",
    "hibridos-electricos": "Vehículos híbridos y eléctricos",
    "baterias-alta-tension": "Baterías de alta tensión",
    "cargadores-vehiculo-electrico": "Cargadores para vehículo eléctrico",
    "furgonetas": "Furgonetas",
    "vehiculos-industriales": "Vehículos industriales",
    "autocaravanas": "Autocaravanas",
    "vehiculos-4x4": "Vehículos 4x4",
    "equipos-sonido": "Equipos de sonido y audio para automóvil",
    "multimedia-navegacion": "Pantallas, multimedia y navegación",
    "vinilos-rotulacion": "Vinilos y rotulación",
    "wrapping": "Wrapping integral y cambio de color",
    "tuning-personalizacion": "Tuning y personalización",
    "iluminacion-automovil": "Iluminación y sistemas LED",
    "grua-asistencia": "Grúa y asistencia en carretera",
    "lavado-detailing": "Lavado y detailing",
    "montaje-accesorios": "Montaje de accesorios",
    "homologaciones": "Homologaciones",
    "instalacion-glp": "Instalación y mantenimiento GLP",
    "taller-mecanico": "Taller mecánico"
});

export function serviceLabel(service) {
    const raw = typeof service === "string"
        ? service
        : (service?.nombre || service?.slug || service?.servicio || "");
    const value = String(raw || "").trim();
    if (!value) return "";
    if (SERVICE_LABELS[value]) return SERVICE_LABELS[value];
    return value
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^./, (letter) => letter.toLocaleUpperCase("es"));
}

export function reviewStatusLabel(verified) {
    return verified ? "✓ Información revisada" : "Información publicada";
}

export function workshopPhotoSource(workshop) {
    const candidates = [
        workshop?.fotoFirmada,
        ...(Array.isArray(workshop?.fotos) ? workshop.fotos : [])
    ].map((value) => String(value || "").trim()).filter(Boolean);

    for (const candidate of candidates) {
        const url = safeWeb(candidate);
        if (url) return { url, path: "" };
    }

    const path = candidates.find((candidate) =>
        !candidate.includes("..")
        && !candidate.startsWith("/")
        && /^[a-z0-9/_.,() -]+$/i.test(candidate)
    ) || "";
    return { url: "", path };
}

export function renderWorkshopMedia(workshop, name) {
    const source = workshopPhotoSource(workshop);
    const pathAttribute = source.path ? ` data-foto-ruta="${escapeHTML(source.path)}"` : "";
    const image = source.url
        ? `<img src="${escapeHTML(source.url)}" alt="Fotografía de ${escapeHTML(name)}" loading="lazy" decoding="async">`
        : "";
    return `<div class="taller-imagen ${source.url ? "taller-imagen-real" : "taller-imagen-1"}"${pathAttribute}>${image}</div>`;
}

export async function supabaseRpc(name, body) {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`${name} respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const data = await result.json();
    return Array.isArray(data) ? data : [];
}
