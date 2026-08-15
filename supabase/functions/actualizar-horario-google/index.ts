import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function hora(point: any) {
  const h = Number(point?.hour ?? 0);
  const m = Number(point?.minute ?? 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function plantillaSemanal() {
  return {
    lunes: { cerrado: true, turnos: [] as any[] },
    martes: { cerrado: true, turnos: [] as any[] },
    miercoles: { cerrado: true, turnos: [] as any[] },
    jueves: { cerrado: true, turnos: [] as any[] },
    viernes: { cerrado: true, turnos: [] as any[] },
    sabado: { cerrado: true, turnos: [] as any[] },
    domingo: { cerrado: true, turnos: [] as any[] },
  } as Record<string, { cerrado: boolean; turnos: Array<{ apertura: string; cierre: string }> }>;
}

function normalizarRegular(openingHours: any) {
  const periods = Array.isArray(openingHours?.periods) ? openingHours.periods : [];
  if (!periods.length) return null;
  const out = plantillaSemanal();

  for (const p of periods) {
    const openDay = Number(p?.open?.day);
    const closeDay = Number(p?.close?.day);
    if (!Number.isInteger(openDay) || openDay < 0 || openDay > 6) continue;
    const dia = DIAS[openDay];
    if (!p?.close || !Number.isInteger(closeDay) || closeDay !== openDay) {
      throw new Error("HORARIO_COMPLEJO");
    }
    out[dia].cerrado = false;
    out[dia].turnos.push({ apertura: hora(p.open), cierre: hora(p.close) });
  }

  for (const dia of Object.keys(out)) {
    out[dia].turnos.sort((a, b) => a.apertura.localeCompare(b.apertura));
  }
  return out;
}

function canon(v: any): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

async function googlePlace(apiKey: string, taller: any) {
  const commonMask = "id,displayName,formattedAddress,regularOpeningHours.periods,regularOpeningHours.weekdayDescriptions,currentOpeningHours.periods,currentOpeningHours.weekdayDescriptions,currentOpeningHours.specialDays";

  if (taller.google_place_id) {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(taller.google_place_id)}`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": commonMask, "Accept-Language": "es" },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`GOOGLE_${r.status}:${data?.error?.message || "Error Places"}`);
    return data;
  }

  const textQuery = [taller.nombre, taller.direccion, taller.codigo_postal, taller.ciudad, taller.provincia, "España"]
    .filter(Boolean).join(", ");
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": `places.${commonMask.replaceAll(",", ",places.")}`,
      "Accept-Language": "es",
    },
    body: JSON.stringify({ textQuery, languageCode: "es", regionCode: "ES", maxResultCount: 1 }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`GOOGLE_${r.status}:${data?.error?.message || "Error Places"}`);
  const place = Array.isArray(data?.places) ? data.places[0] : null;
  if (!place) throw new Error("GOOGLE_SIN_RESULTADOS");
  return place;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respuesta({ ok: false, error: "Método no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
  if (!supabaseUrl || !serviceKey) return respuesta({ ok: false, error: "Configuración Supabase incompleta" }, 500);
  if (!googleKey) return respuesta({ ok: false, error: "GOOGLE_PLACES_API_KEY_NO_CONFIGURADA" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return respuesta({ ok: false, error: "JSON inválido" }, 400); }
  const tallerId = String(body?.taller_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(tallerId)) return respuesta({ ok: false, error: "taller_id inválido" }, 400);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: taller, error: readError } = await db.from("talleres")
    .select("id,nombre,direccion,codigo_postal,ciudad,provincia,horarios,google_place_id,google_horario_piloto")
    .eq("id", tallerId).maybeSingle();
  if (readError) return respuesta({ ok: false, error: readError.message }, 500);
  if (!taller) return respuesta({ ok: false, error: "Taller no encontrado" }, 404);
  if (!taller.google_horario_piloto) return respuesta({ ok: false, error: "PILOTO_NO_ACTIVADO" }, 403);

  try {
    const place = await googlePlace(googleKey, taller);
    const regular = normalizarRegular(place.regularOpeningHours);
    const actual = place.currentOpeningHours || null;
    const now = new Date().toISOString();

    if (!regular) {
      await db.from("talleres").update({
        google_place_id: place.id || taller.google_place_id || null,
        google_horario_regular: null,
        google_horario_actual: actual,
        google_horario_consultado_at: now,
        google_horario_estado: "sin_horario",
      }).eq("id", tallerId);
      return respuesta({ ok: true, estado: "sin_horario", actualizado: false, place_id: place.id || null, horario_google: null, horario_actual_google: actual });
    }

    const coincide = canon(regular) === canon(taller.horarios || null);
    const cambios: Record<string, any> = {
      google_place_id: place.id || taller.google_place_id || null,
      google_horario_regular: regular,
      google_horario_actual: actual,
      google_horario_consultado_at: now,
      google_horario_estado: coincide ? "coincide" : "actualizado",
    };
    if (!coincide) cambios.horarios = regular;

    const { error: updateError } = await db.from("talleres").update(cambios).eq("id", tallerId);
    if (updateError) throw new Error(`DB_UPDATE:${updateError.message}`);

    return respuesta({
      ok: true,
      estado: coincide ? "coincide" : "actualizado",
      actualizado: !coincide,
      place_id: place.id || null,
      nombre_google: place.displayName?.text || null,
      direccion_google: place.formattedAddress || null,
      horario_google: regular,
      horario_actual_google: actual,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const estado = message === "HORARIO_COMPLEJO" ? "horario_complejo" : "error";
    await db.from("talleres").update({ google_horario_consultado_at: new Date().toISOString(), google_horario_estado: estado }).eq("id", tallerId);
    return respuesta({ ok: false, error: message, estado }, message === "HORARIO_COMPLEJO" ? 422 : 502);
  }
});
