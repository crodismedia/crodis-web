import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const ORIGENES_PERMITIDOS = new Set([
    "https://tallermap.es",
    "https://www.tallermap.es"
]);

const SERVIDORES_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];

type ElementoOpenStreetMap = {
    id: number;
    type: string;
    lat?: number;
    lon?: number;
    center?: { lat?: number; lon?: number };
    tags?: Record<string, string>;
};

type LugarNominatim = {
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: Record<string, string>;
    boundingbox?: string[];
};

type CoordenadasAbsolutas = {
    latitud: number;
    longitud: number;
    origen: "nodo_osm" | "centro_geometria_osm";
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

function normalizar(valor: unknown) {
    return texto(valor, 300)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function primerValor(tags: Record<string, string>, claves: string[]) {
    for (const clave of claves) {
        if (tags[clave]) return texto(tags[clave]);
    }
    return "";
}

function direccionDe(tags: Record<string, string>) {
    const calle = primerValor(tags, ["addr:street", "addr:place"]);
    const numero = texto(tags["addr:housenumber"], 30);
    return [calle, numero].filter(Boolean).join(" ");
}

function coordenadasValidas(latitud: number, longitud: number) {
    return Number.isFinite(latitud)
        && Number.isFinite(longitud)
        && latitud >= -90
        && latitud <= 90
        && longitud >= -180
        && longitud <= 180;
}

function coordenadasDe(elemento: ElementoOpenStreetMap): CoordenadasAbsolutas | null {
    const esNodo = elemento.lat !== undefined && elemento.lon !== undefined;
    const latitud = Number(esNodo ? elemento.lat : elemento.center?.lat);
    const longitud = Number(esNodo ? elemento.lon : elemento.center?.lon);

    if (!coordenadasValidas(latitud, longitud)) return null;

    return {
        latitud,
        longitud,
        origen: esNodo ? "nodo_osm" : "centro_geometria_osm"
    };
}

function distanciaKilometros(
    latitudOrigen: number,
    longitudOrigen: number,
    latitudDestino: number,
    longitudDestino: number
) {
    const radianes = (grados: number) => grados * Math.PI / 180;
    const diferenciaLatitud = radianes(latitudDestino - latitudOrigen);
    const diferenciaLongitud = radianes(longitudDestino - longitudOrigen);
    const latitudOrigenRadianes = radianes(latitudOrigen);
    const latitudDestinoRadianes = radianes(latitudDestino);
    const haverseno =
        Math.sin(diferenciaLatitud / 2) ** 2
        + Math.cos(latitudOrigenRadianes)
        * Math.cos(latitudDestinoRadianes)
        * Math.sin(diferenciaLongitud / 2) ** 2;

    return 6371 * 2 * Math.asin(Math.sqrt(haverseno));
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

function coordenadasDentroDe(
    coordenadas: CoordenadasAbsolutas,
    limites: ReturnType<typeof limitesDe>
) {
    if (!limites) return false;

    return coordenadas.latitud >= limites.sur
        && coordenadas.latitud <= limites.norte
        && coordenadas.longitud >= limites.oeste
        && coordenadas.longitud <= limites.este;
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

async function consultarOverpass(consulta: string, agente: string) {
    const datosFormulario = new URLSearchParams({ data: consulta });
    let ultimoError = "sin respuesta";

    for (const servidor of SERVIDORES_OVERPASS) {
        try {
            const respuestaOverpass = await fetchConTiempoLimite(
                servidor,
                {
                    method: "POST",
                    headers: {
                        "User-Agent": agente,
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                    },
                    body: datosFormulario.toString()
                },
                12000
            );

            if (!respuestaOverpass.ok) {
                ultimoError = `${new URL(servidor).host}: HTTP ${respuestaOverpass.status}`;
                console.warn(`Overpass: ${ultimoError}`);
                continue;
            }

            const datos = await respuestaOverpass.json() as {
                elements?: ElementoOpenStreetMap[];
            };
            if (Array.isArray(datos.elements)) return datos;

            ultimoError = `${new URL(servidor).host}: respuesta no válida`;
        } catch (error) {
            const detalle = error instanceof Error ? error.message : "error de red";
            ultimoError = `${new URL(servidor).host}: ${detalle}`;
        }

        console.warn(`Overpass: ${ultimoError}`);
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

    const consultaOverpass = `[out:json][timeout:25];
(
  nwr["shop"="car_repair"](around:${radioMetros},${latitud},${longitud});
  nwr["craft"="car_repair"](around:${radioMetros},${latitud},${longitud});
  nwr["amenity"="car_repair"](around:${radioMetros},${latitud},${longitud});
);
out center tags 80;`;
    let datos: { elements?: ElementoOpenStreetMap[] };
    try {
        datos = await consultarOverpass(consultaOverpass, agente);
    } catch (error) {
        console.error("No respondió ningún servidor Overpass:", error);
        return respuesta({
            error: "El buscador externo está ocupado",
            detalle: "Los servidores cartográficos no respondieron. Inténtalo de nuevo en unos segundos."
        }, 503, cabeceras);
    }

    const { data: existentes } = await supabase
        .from("talleres")
        .select("id,nombre,direccion,ciudad")
        .limit(5000);
    const talleresExistentes = existentes || [];
    const candidatos = (Array.isArray(datos.elements) ? datos.elements : [])
        .map((elemento) => {
            const coordenadas = coordenadasDe(elemento);
            if (!coordenadas) return null;

            const distanciaCentroKm = distanciaKilometros(
                latitud,
                longitud,
                coordenadas.latitud,
                coordenadas.longitud
            );
            if (distanciaCentroKm > radioKm) return null;

            const tags = elemento.tags || {};
            const nombre = primerValor(tags, ["name", "brand", "operator"]) || "Taller sin nombre";
            const direccion = direccionDe(tags);
            const poblacionFuente = primerValor(tags, [
                "addr:city", "addr:town", "addr:village", "addr:municipality"
            ]);
            const codigoPostalFuente = texto(tags["addr:postcode"], 10);
            const coincidencia = talleresExistentes.find((taller) => {
                const mismoNombre = normalizar(taller.nombre) === normalizar(nombre);
                const mismaCiudad = poblacionFuente
                    && normalizar(taller.ciudad) === normalizar(poblacionFuente);
                const mismaDireccion = direccion
                    && normalizar(taller.direccion) === normalizar(direccion);
                return mismoNombre && (mismaCiudad || mismaDireccion);
            });
            return {
                id: `${elemento.type}/${elemento.id}`,
                nombre,
                direccion,
                codigo_postal: codigoPostalFuente,
                ciudad: poblacionFuente,
                provincia: primerValor(tags, ["addr:province", "addr:state"]),
                telefono: primerValor(tags, ["contact:phone", "phone", "contact:mobile"]),
                email: primerValor(tags, ["contact:email", "email"]),
                web: primerValor(tags, ["contact:website", "website", "url"]),
                horario_externo: texto(tags.opening_hours, 300),
                latitud: coordenadas.latitud,
                longitud: coordenadas.longitud,
                coordenadas_absolutas: true,
                origen_coordenadas: coordenadas.origen,
                distancia_centro_km: Number(distanciaCentroKm.toFixed(3)),
                dentro_limites_poblacion: coordenadasDentroDe(
                    coordenadas,
                    limitesPoblacion
                ),
                etiquetas_osm: tags,
                poblacion_fuente: poblacionFuente,
                codigo_postal_fuente: codigoPostalFuente,
                posible_duplicado: Boolean(coincidencia),
                taller_existente_id: coincidencia?.id || null,
                fuente: `https://www.openstreetmap.org/${elemento.type}/${elemento.id}`
            };
        })
        .filter((candidato) => candidato !== null)
        .sort((a, b) => {
            if (a.posible_duplicado !== b.posible_duplicado) {
                return Number(a.posible_duplicado) - Number(b.posible_duplicado);
            }
            if (a.nombre === "Taller sin nombre") return 1;
            if (b.nombre === "Taller sin nombre") return -1;
            return a.nombre.localeCompare(b.nombre, "es");
        })
        .slice(0, 80);

    return respuesta({
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
        candidatos,
        atribucion: "© colaboradores de OpenStreetMap, datos ODbL"
    }, 200, cabeceras);
});
