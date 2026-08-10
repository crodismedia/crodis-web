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
    return String(value || "").replace(/[^\d+]/g, "").slice(0, 20);
}

export async function supabaseRpc(name, body) {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
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
