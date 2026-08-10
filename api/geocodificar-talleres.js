const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
    "TallerMap/1.0 (https://www.tallermap.es; info@tallermap.es)";

const LOTE_MAXIMO = 50;
const ESPERA_MS = 1100;

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function numeroSeguro(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

async function rpcPrivada(name, body) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error(
            "Falta la variable SUPABASE_SERVICE_ROLE_KEY en Vercel"
        );
    }

    const result = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/${name}`,
        {
            method: "POST",
            headers: {
                apikey: serviceRoleKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        }
    );

    if (!result.ok) {
        const message = await result.text().catch(() => "");

        throw new Error(
            `${name} respondió ${result.status}: ${message.slice(0, 500)}`
        );
    }

    const text = await result.text();

    if (!text) {
        return [];
    }

    const data = JSON.parse(text);

    return Array.isArray(data) ? data : [];
}

function autorizada(request) {
    const expected = process.env.GEOCODIFICAR_TOKEN;
    const received = request.headers["x-geocodificar-token"];

    if (!expected) {
        throw new Error(
            "Falta la variable GEOCODIFICAR_TOKEN en Vercel"
        );
    }

    return (
        typeof received === "string" &&
        received.length > 0 &&
        received === expected
    );
}

async function consultarNominatim(direccion) {
    const params = new URLSearchParams({
        q: direccion,
        format: "jsonv2",
        limit: "1",
        addressdetails: "1",
        countrycodes: "es"
    });

    const result = await fetch(
        `${NOMINATIM_URL}?${params.toString()}`,
        {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept-Language": "es"
            }
        }
    );

    if (!result.ok) {
        throw new Error(`Nominatim HTTP ${result.status}`);
    }

    const data = await result.json();

    if (!Array.isArray(data) || !data.length) {
        return null;
    }

    const item = data[0];

    const latitud = numeroSeguro(item.lat);
    const longitud = numeroSeguro(item.lon);

    if (latitud === null || longitud === null) {
        return null;
    }

    return {
        latitud,
        longitud,
        display_name: String(item.display_name || ""),
        tipo: String(item.type || ""),
        categoria: String(item.category || "")
    };
}

async function obtenerPendientes(limite) {
    return rpcPrivada(
        "obtener_cola_geocodificacion",
        { p_limite: limite }
    );
}

async function guardarResultado(
    tallerId,
    direccionBusqueda,
    resultado
) {
    await rpcPrivada(
        "guardar_geocodificacion_taller",
        {
            p_taller_id: tallerId,
            p_latitud: resultado.latitud,
            p_longitud: resultado.longitud,
            p_precision_geocodificacion:
                resultado.tipo ||
                resultado.categoria ||
                "nominatim",
            p_direccion_geocodificada:
                resultado.display_name ||
                direccionBusqueda
        }
    );
}

async function marcarError(tallerId, mensaje) {
    await rpcPrivada(
        "marcar_error_geocodificacion",
        {
            p_taller_id: tallerId,
            p_error: String(
                mensaje || "Error desconocido"
            ).slice(0, 500)
        }
    );
}

export default async function handler(request, response) {
    response.setHeader(
        "Cache-Control",
        "no-store, max-age=0"
    );

    if (request.method !== "POST") {
        response.setHeader("Allow", "POST");

        response.status(405).json({
            ok: false,
            error: "Método no permitido"
        });

        return;
    }

    try {
        if (!autorizada(request)) {
            response.status(401).json({
                ok: false,
                error: "No autorizado"
            });

            return;
        }
    } catch (error) {
        console.error(error);

        response.status(500).json({
            ok: false,
            error: error.message
        });

        return;
    }

    const limiteSolicitado =
        Number(request.body?.limite || 5);

    const limite = Math.max(
        1,
        Math.min(
            Number.isFinite(limiteSolicitado)
                ? Math.floor(limiteSolicitado)
                : 5,
            LOTE_MAXIMO
        )
    );

    let pendientes;

    try {
        pendientes = await obtenerPendientes(limite);
    } catch (error) {
        console.error(
            "No se pudo obtener la cola:",
            error
        );

        response.status(500).json({
            ok: false,
            error: error.message
        });

        return;
    }

    const resumen = {
        solicitados: limite,
        encontrados: pendientes.length,
        completados: 0,
        errores: 0,
        resultados: []
    };

    for (const candidato of pendientes) {
        const tallerId = candidato.taller_id;

        const direccion = String(
            candidato.direccion_busqueda || ""
        ).trim();

        if (!tallerId || !direccion) {
            resumen.errores += 1;
            continue;
        }

        try {
            const resultado =
                await consultarNominatim(direccion);

            if (!resultado) {
                await marcarError(
                    tallerId,
                    "Nominatim no encontró coincidencia"
                );

                resumen.errores += 1;

                resumen.resultados.push({
                    taller_id: tallerId,
                    direccion,
                    estado: "sin_resultado"
                });
            } else {
                await guardarResultado(
                    tallerId,
                    direccion,
                    resultado
                );

                resumen.completados += 1;

                resumen.resultados.push({
                    taller_id: tallerId,
                    direccion,
                    estado: "completado",
                    latitud: resultado.latitud,
                    longitud: resultado.longitud,
                    direccion_geocodificada:
                        resultado.display_name
                });
            }
        } catch (error) {
            console.error(
                `Error geocodificando ${tallerId}:`,
                error
            );

            try {
                await marcarError(
                    tallerId,
                    error?.message ||
                        "Error de geocodificación"
                );
            } catch (errorMarcado) {
                console.error(
                    "No se pudo guardar el error:",
                    errorMarcado
                );
            }

            resumen.errores += 1;

            resumen.resultados.push({
                taller_id: tallerId,
                direccion,
                estado: "error",
                error:
                    error?.message ||
                    "Error desconocido"
            });
        }

        await esperar(ESPERA_MS);
    }

    response.status(200).json({
        ok: true,
        ...resumen
    });
}