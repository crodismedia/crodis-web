import { createClient } from "npm:@supabase/supabase-js@2.111.0";

type Limites = {
    sur: number;
    norte: number;
    oeste: number;
    este: number;
};

type LugarNominatim = {
    boundingbox?: unknown[];
    lat?: string | number;
    lon?: string | number;
    display_name?: unknown;
    address?: Record<string, unknown>;
};

const ORIGENES_PERMITIDOS = new Set([
    "https://tallermap.es",
    "https://www.tallermap.es"
]);

function cabecerasCors(origen: string | null): HeadersInit {
    return {
        "Access-Control-Allow-Origin":
            origen && ORIGENES_PERMITIDOS.has(origen)
                ? origen
                : "https://tallermap.es",
        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
        "Vary": "Origin"
    };
}

function respuesta(cuerpo: unknown, estado: number, cabeceras: HeadersInit): Response {
    return new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: cabeceras
    });
}

function texto(valor: unknown, maximo = 255): string {
    return String(valor || "").trim().slice(0, maximo);
}

function primerValor(datos: Record<string, unknown> | null | undefined, claves: string[]): string {
    for (const clave of claves) {
        if (datos && datos[clave]) return texto(datos[clave]);
    }
    return "";
}

function coordenadasValidas(latitud: number, longitud: number): boolean {
    return Number.isFinite(latitud)
        && Number.isFinite(longitud)
        && latitud >= -90
        && latitud <= 90
        && longitud >= -180
        && longitud <= 180;
}

function limitesDe(lugar: LugarNominatim | null | undefined): Limites | null {
    if (!lugar || !Array.isArray(lugar.boundingbox) || lugar.boundingbox.length !== 4) {
        return null;
    }

    const [sur, norte, oeste, este] = lugar.boundingbox.map(Number);

    if (![sur, norte, oeste, este].every(Number.isFinite)) return null;
    if (!coordenadasValidas(sur, oeste) || !coordenadasValidas(norte, este)) return null;
    if (sur >= norte || oeste >= este) return null;

    return { sur, norte, oeste, este };
}

function selectorGeografico(
    limites: Limites | null,
    radioMetros: number,
    latitud: number,
    longitud: number
): string {
    if (limites) {
        return `(${limites.sur},${limites.oeste},${limites.norte},${limites.este})`;
    }
    return `(around:${radioMetros},${latitud},${longitud})`;
}

async function fetchConTiempoLimite(
    recurso: RequestInfo | URL,
    opciones: RequestInit,
    milisegundos: number
): Promise<Response> {
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

async function localizarPoblacion(url: URL, agente: string): Promise<LugarNominatim[]> {
    let ultimoError = "sin respuesta";

    for (let intento = 1; intento <= 2; intento += 1) {
        try {
            const resultado = await fetchConTiempoLimite(
                url,
                {
                    headers: {
                        "User-Agent": agente,
                        "Accept-Language": "es"
                    }
                },
                7000
            );

            if (resultado.ok) {
                const datos: unknown = await resultado.json();
                return Array.isArray(datos) ? datos as LugarNominatim[] : [];
            }

            ultimoError = `HTTP ${resultado.status}`;
        } catch (error: unknown) {
            ultimoError = error instanceof Error ? error.message : "error de red";
        }

        console.warn(`Nominatim intento ${intento}: ${ultimoError}`);
    }

    throw new Error(ultimoError);
}

Deno.serve(async (peticion: Request) => {
    const origen = peticion.headers.get("Origin");
    const cabeceras = cabecerasCors(origen);

    if (peticion.method === "OPTIONS") {
        return new Response("ok", { headers: cabeceras });
    }

    if (peticion.method !== "POST") {
        return respuesta({ error: "Método no permitido" }, 405, cabeceras);
    }

    const token = peticion.headers.get("Authorization");
    if (!token || !token.startsWith("Bearer ")) {
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

    const jwt = token.replace(/^Bearer\s+/i, "");
    const resultadoUsuario = await supabase.auth.getUser(jwt);

    if (resultadoUsuario.error || !resultadoUsuario.data || !resultadoUsuario.data.user) {
        return respuesta({ error: "Sesión caducada" }, 401, cabeceras);
    }

    const resultadoPermiso = await supabase.rpc("es_administrador");
    if (resultadoPermiso.error || !resultadoPermiso.data) {
        return respuesta({ error: "No autorizado" }, 403, cabeceras);
    }

    let cuerpo: Record<string, unknown>;
    try {
        const recibido: unknown = await peticion.json();
        cuerpo = recibido && typeof recibido === "object" && !Array.isArray(recibido)
            ? recibido as Record<string, unknown>
            : {};
    } catch {
        return respuesta({ error: "Solicitud no válida" }, 400, cabeceras);
    }

    const ubicacion = texto(cuerpo.ubicacion, 120);
    const radioSolicitado = Number(cuerpo.radio_km);
    const radioKm = Math.min(
        25,
        Math.max(1, Number.isFinite(radioSolicitado) ? radioSolicitado : 10)
    );

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
    } catch (error: unknown) {
        console.error("No se pudo localizar la población:", error);
        return respuesta({
            error: "No se pudo localizar la población",
            detalle: "El servicio de localización no respondió tras dos intentos."
        }, 502, cabeceras);
    }

    if (lugares.length === 0) {
        return respuesta({ error: "No se encontró esa ubicación en España" }, 404, cabeceras);
    }

    const lugar = lugares[0];
    const latitud = Number(lugar.lat);
    const longitud = Number(lugar.lon);

    if (!coordenadasValidas(latitud, longitud)) {
        return respuesta({ error: "La ubicación no tiene coordenadas válidas" }, 502, cabeceras);
    }

    const limitesPoblacion = limitesDe(lugar);
    const radioMetros = Math.round(radioKm * 1000);
    const selector = selectorGeografico(limitesPoblacion, radioMetros, latitud, longitud);

    const consultaOverpass = `[out:json][timeout:35];
(
  nwr["shop"="car_repair"]${selector};
  nwr["craft"="car_repair"]${selector};
  nwr["amenity"="car_repair"]${selector};
);
out center tags 80;`;

    const direccion = lugar.address || {};
    const nombrePoblacion = primerValor(direccion, [
        "city",
        "town",
        "village",
        "municipality"
    ]) || ubicacion.split(",")[0].trim();

    return respuesta({
        modo_consulta: "navegador",
        criterio_geografico: limitesPoblacion ? "limites_poblacion" : "radio_centro",
        consulta_overpass: consultaOverpass,
        servidores_overpass: [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
        ],
        ubicacion: {
            nombre: texto(lugar.display_name, 300),
            latitud,
            longitud,
            radio_km: limitesPoblacion ? null : radioKm
        },
        poblacion: {
            nombre: nombrePoblacion,
            codigo_postal: texto(direccion.postcode, 10),
            provincia: primerValor(direccion, ["province", "state"]),
            limites: limitesPoblacion
        },
        atribucion: "© colaboradores de OpenStreetMap, datos ODbL"
    }, 200, cabeceras);
});
