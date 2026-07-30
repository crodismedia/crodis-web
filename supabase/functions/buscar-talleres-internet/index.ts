import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const ORIGENES_PERMITIDOS = new Set([
    "https://tallermap.es",
    "https://www.tallermap.es"
]);

type LugarNominatim = {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
    boundingbox?: string[];
};

function cabecerasCors(origen: string | null) {
    return {
        "Access-Control-Allow-Origin": origen && ORIGENES_PERMITIDOS.has(origen)
            ? origen
            : "https://tallermap.es",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
        "Vary": "Origin"
    };
}

function respuesta(cuerpo: unknown, estado: number, cabeceras: Record<string, string>) {
    return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

function texto(valor: unknown, maximo = 255) {
    return String(valor || "").trim().slice(0, maximo);
}

function primerValor(tags: Record<string, string>, claves: string[]) {
    for (const clave of claves) {
        if (tags[clave]) return texto(tags[clave]);
    }
    return "";
}

function coordenadasValidas(latitud: number, longitud: number) {
    return Number.isFinite(latitud)
        && Number.isFinite(longitud)
        && latitud >= -90
        && latitud <= 90
        && longitud >= -180
        && longitud <= 180;
}

function limitesDe(lugar: LugarNominatim) {
    if (!Array.isArray(lugar.boundingbox) || lugar.boundingbox.length !== 4) {
        return null;
    }

    const [sur, norte, oeste, este] = lugar.boundingbox.map(Number);
    if (![sur, norte, oeste, este].every(Number.isFinite)) return null;
    if (!coordenadasValidas(sur, oeste) || !coordenadasValidas(norte, este)) {
        return null;
    }

    return { sur, norte, oeste, este };
}

async function fetchConTiempoLimite(
    recurso: string | URL,
    opciones: RequestInit,
    milisegundos: number
) {
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), milisegundos);

    try {
        return await fetch(recurso, {
            ...opciones,
            signal: controlador.signal
        });
    } finally {
        clearTimeout(limite);
    }
}

async function localizarPoblacion(url: URL, agente: string) {
    let ultimoError = "sin respuesta";

    for (let intento = 1; intento <= 2; intento += 1) {
        try {
            const respuestaGeocodificacion = await fetchConTiempoLimite(
                url,
                {
                    headers: {
                        "User-Agent": agente,
                        "Accept-Language": "es"
                    }
                },
                7000
            );

            if (respuestaGeocodificacion.ok) {
                return await respuestaGeocodificacion.json() as LugarNominatim[];
            }

            ultimoError = `HTTP ${respuestaGeocodificacion.status}`;
        } catch (error) {
            ultimoError = error instanceof Error ? error.message : "error de red";
        }

        console.warn(`Nominatim intento ${intento}: ${ultimoError}`);
    }

    throw new Error(ultimoError);
}

Deno.serve(async (peticion) => {
    const origen = peticion.headers.get("Origin");
    const cabeceras = cabecerasCors(origen);
    if (peticion.method === "OPTIONS") return new Response("ok", { headers: cabeceras });
    if (peticion.method !== "POST") {
        return respuesta({ error: "Método no permitido" }, 405, cabeceras);
    }

    const token = peticion.headers.get("Authorization");
    if (!token?.startsWith("Bearer ")) {
        return respuesta({ error: "Sesión no válida" }, 401, cabeceras);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
        return respuesta({ error: "Configuración incompleta" }, 500, cabeceras);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: token } },
        auth: { persistSession: false }
    });
    const { data: usuario, error: errorUsuario } = await supabase.auth.getUser(
        token.replace(/^Bearer\s+/i, "")
    );
    if (errorUsuario || !usuario.user) {
        return respuesta({ error: "Sesión caducada" }, 401, cabeceras);
    }
    const { data: esAdministrador, error: errorPermiso } =
        await supabase.rpc("es_administrador");
    if (errorPermiso || !esAdministrador) {
        return respuesta({ error: "No autorizado" }, 403, cabeceras);
    }

    let cuerpo: { ubicacion?: string; radio_km?: number };
    try {
        cuerpo = await peticion.json();
    } catch {
        return respuesta({ error: "Solicitud no válida" }, 400, cabeceras);
    }
    const ubicacion = texto(cuerpo.ubicacion, 120);
    const radioKm = Math.min(25, Math.max(1, Number(cuerpo.radio_km) || 10));
    if (ubicacion.length < 2) {
        return respuesta({ error: "Indica una población o código postal" }, 400, cabeceras);
    }

    const agente = "TallerMap/1.0 (https://tallermap.es; contacto: crodismedia@outlook.es)";
    const geocodificacionUrl = new URL("https://nominatim.openstreetmap.org/search");
    geocodificacionUrl.searchParams.set("q", `${ubicacion}, España`);
    geocodificacionUrl.searchParams.set("format", "jsonv2");
    geocodificacionUrl.searchParams.set("addressdetails", "1");
    geocodificacionUrl.searchParams.set("countrycodes", "es");
    geocodificacionUrl.searchParams.set("limit", "1");

    let lugares: LugarNominatim[];
    try {
        lugares = await localizarPoblacion(geocodificacionUrl, agente);
    } catch (error) {
        console.error("No se pudo localizar la población:", error);
        return respuesta({
            error: "No se pudo localizar la población",
            detalle: "El servicio de localización no respondió tras dos intentos."
        }, 502, cabeceras);
    }
    if (!Array.isArray(lugares) || !lugares.length) {
        return respuesta({ error: "No se encontró esa ubicación en España" }, 404, cabeceras);
    }
    const latitud = Number(lugares[0].lat);
    const longitud = Number(lugares[0].lon);
    if (!coordenadasValidas(latitud, longitud)) {
        return respuesta({ error: "La ubicación no tiene coordenadas válidas" }, 502, cabeceras);
    }
    const limitesPoblacion = limitesDe(lugares[0]);
    const radioMetros = Math.round(radioKm * 1000);

    const consultaOverpass = `[out:json][timeout:35];
(
  nwr["shop"="car_repair"](around:${radioMetros},${latitud},${longitud});
  nwr["craft"="car_repair"](around:${radioMetros},${latitud},${longitud});
  nwr["amenity"="car_repair"](around:${radioMetros},${latitud},${longitud});
);
out center tags 80;`;
    return respuesta({
        modo_consulta: "navegador",
        consulta_overpass: consultaOverpass,
        servidores_overpass: [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
        ],
        ubicacion: {
            nombre: texto(lugares[0].display_name, 300),
            latitud,
            longitud,
            radio_km: radioKm
        },
        poblacion: {
            nombre: primerValor(lugares[0].address || {}, [
                "city", "town", "village", "municipality"
            ]) || ubicacion.split(",")[0].trim(),
            codigo_postal: texto(lugares[0].address?.postcode, 10),
            provincia: primerValor(lugares[0].address || {}, ["province", "state"]),
            limites: limitesPoblacion
        },
        atribucion: "© colaboradores de OpenStreetMap, datos ODbL"
    }, 200, cabeceras);
});
