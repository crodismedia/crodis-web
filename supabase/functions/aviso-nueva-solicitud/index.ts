type Solicitud = {
    id?: number | string;
    nombre_taller?: string;
    propietario?: string;
    cif?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    codigo_postal?: string;
    ciudad?: string;
    provincia?: string;
    descripcion?: string;
    acepta_responsabilidad?: boolean;
    acepta_terminos_at?: string;
    version_terminos?: string;
    created_at?: string;
};

type WebhookPayload = {
    type?: string;
    table?: string;
    schema?: string;
    record?: Solicitud;
};

const DESTINATARIO = "crodismedia@outlook.es";
const encoder = new TextEncoder();

function texto(valor: unknown): string {
    if (
        typeof valor === "string" ||
        typeof valor === "number" ||
        typeof valor === "boolean"
    ) {
        return String(valor);
    }

    return "No indicado";
}

function escaparHtml(valor: unknown): string {
    return texto(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function sonIgualesEnTiempoConstante(
    valorA: string,
    valorB: string
): boolean {
    const bytesA = encoder.encode(valorA);
    const bytesB = encoder.encode(valorB);

    let diferencia = bytesA.length ^ bytesB.length;
    const longitud = Math.max(bytesA.length, bytesB.length);

    for (let indice = 0; indice < longitud; indice += 1) {
        diferencia |=
            (bytesA[indice] ?? 0) ^
            (bytesB[indice] ?? 0);
    }

    return diferencia === 0;
}

function formatearFecha(valor: unknown): string {
    if (!valor) {
        return "No indicada";
    }

    const fecha = new Date(String(valor));

    if (Number.isNaN(fecha.getTime())) {
        return texto(valor);
    }

    return fecha.toLocaleString("es-ES", {
        timeZone: "Europe/Madrid",
        dateStyle: "long",
        timeStyle: "short"
    });
}

function crearCorreo(solicitud: Solicitud) {
    const responsabilidadAceptada =
        solicitud.acepta_responsabilidad === true
            ? "Sí"
            : "No";

    const campos: Array<[string, unknown]> = [
        ["Número de solicitud", solicitud.id],
        ["Nombre del taller", solicitud.nombre_taller],
        ["Propietario o responsable", solicitud.propietario],
        ["CIF o NIF", solicitud.cif],
        ["Correo electrónico", solicitud.email],
        ["Teléfono", solicitud.telefono],
        ["Dirección", solicitud.direccion],
        ["Código postal", solicitud.codigo_postal],
        ["Ciudad", solicitud.ciudad],
        ["Provincia", solicitud.provincia],
        ["Descripción", solicitud.descripcion],
        ["Aceptó responsabilidad", responsabilidadAceptada],
        ["Versión de las condiciones", solicitud.version_terminos],
        [
            "Fecha de aceptación",
            formatearFecha(solicitud.acepta_terminos_at)
        ],
        [
            "Fecha de solicitud",
            formatearFecha(solicitud.created_at)
        ]
    ];

    const filasHtml = campos
        .map(
            ([etiqueta, valor]) => `
                <tr>
                    <th
                        align="left"
                        style="
                            padding:10px;
                            border:1px solid #dfe6ef;
                            background:#f5f7fb;
                            vertical-align:top;
                        "
                    >
                        ${escaparHtml(etiqueta)}
                    </th>

                    <td
                        style="
                            padding:10px;
                            border:1px solid #dfe6ef;
                            white-space:pre-wrap;
                            vertical-align:top;
                        "
                    >
                        ${escaparHtml(valor)}
                    </td>
                </tr>
            `
        )
        .join("");

    const contenidoTexto = campos
        .map(
            ([etiqueta, valor]) =>
                `${etiqueta}: ${texto(valor)}`
        )
        .join("\n");

    return {
        subject:
            "Nueva solicitud de taller: " +
            texto(solicitud.nombre_taller),

        html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Nueva solicitud de taller</title>
            </head>

            <body
                style="
                    margin:0;
                    padding:24px;
                    background:#f3f6fa;
                    font-family:Arial,sans-serif;
                    color:#1f2937;
                "
            >
                <div
                    style="
                        max-width:750px;
                        margin:0 auto;
                        padding:28px;
                        background:#ffffff;
                        border-radius:12px;
                    "
                >
                    <h1 style="margin-top:0;color:#12365a;">
                        Nueva solicitud de alta de taller
                    </h1>

                    <p>
                        Se ha recibido una solicitud nueva desde
                        el formulario de TallerMap.
                    </p>

                    <table
                        cellspacing="0"
                        cellpadding="0"
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    >
                        ${filasHtml}
                    </table>

                    <p style="margin-top:24px;color:#5f6b7a;">
                        Esta solicitud todavía debe revisarse antes
                        de publicar el taller.
                    </p>
                </div>
            </body>
            </html>
        `,

        text: [
            "Nueva solicitud de alta de taller",
            "",
            contenidoTexto,
            "",
            "La solicitud debe revisarse antes de publicar el taller."
        ].join("\n")
    };
}

Deno.serve(async function (req) {
    if (req.method !== "POST") {
        return new Response(
            "Método no permitido",
            {
                status: 405,
                headers: {
                    Allow: "POST"
                }
            }
        );
    }

    const secretoConfigurado = Deno.env.get(
        "AVISO_WEBHOOK_SECRET"
    );

    const secretoRecibido = req.headers.get(
        "x-aviso-webhook-secret"
    );

    if (
        !secretoConfigurado ||
        !secretoRecibido ||
        !sonIgualesEnTiempoConstante(
            secretoRecibido,
            secretoConfigurado
        )
    ) {
        console.error(
            "Petición rechazada por secreto incorrecto."
        );

        return new Response(
            "No autorizado",
            { status: 401 }
        );
    }

    let payload: WebhookPayload;

    try {
        payload = await req.json();
    } catch {
        return new Response(
            "JSON no válido",
            { status: 400 }
        );
    }

    if (
        payload.type !== "INSERT" ||
        payload.schema !== "public" ||
        payload.table !== "solicitudes_alta_taller" ||
        !payload.record
    ) {
        console.error(
            "El webhook recibió un evento no válido."
        );

        return new Response(
            "Evento no válido",
            { status: 400 }
        );
    }

    const resendApiKey = Deno.env.get(
        "RESEND_API_KEY"
    );

    const remitente = Deno.env.get(
        "RESEND_FROM_EMAIL"
    );

    if (!resendApiKey || !remitente) {
        console.error(
            "Faltan RESEND_API_KEY o RESEND_FROM_EMAIL."
        );

        return new Response(
            "Configuración de correo no disponible",
            { status: 500 }
        );
    }

    const correo = crearCorreo(payload.record);

    const identificadorSolicitud =
        payload.record.id !== undefined
            ? String(payload.record.id)
            : crypto.randomUUID();

    try {
        const respuestaResend = await fetch(
            "https://api.resend.com/emails",
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${resendApiKey}`,

                    "Content-Type":
                        "application/json",

                    "User-Agent":
                        "TallerMap-Supabase-Edge-Function",

                    "Idempotency-Key":
                        `solicitud-alta-${identificadorSolicitud}`
                },

                body: JSON.stringify({
                    from: remitente,
                    to: [DESTINATARIO],
                    subject: correo.subject,
                    html: correo.html,
                    text: correo.text
                })
            }
        );

        if (!respuestaResend.ok) {
            const detalleError =
                await respuestaResend.text();

            console.error(
                "Resend rechazó el envío:",
                respuestaResend.status,
                detalleError
            );

            return new Response(
                "No se pudo enviar el aviso por correo",
                { status: 502 }
            );
        }

        const resultado = await respuestaResend.json();

        console.log(
            "Aviso enviado correctamente.",
            resultado?.id ?? ""
        );

        return Response.json({
            ok: true,
            mensaje:
                "Aviso enviado a crodismedia@outlook.es"
        });
    } catch (error) {
        console.error(
            "Error de conexión con Resend:",
            error
        );

        return new Response(
            "Error al conectar con el servicio de correo",
            { status: 502 }
        );
    }
});