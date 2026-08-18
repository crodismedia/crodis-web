import tallerHtmlHandler from "./taller-html.js";

function captureResponse() {
    const state = {
        statusCode: 200,
        headers: new Map(),
        body: ""
    };

    const response = {
        setHeader(name, value) {
            state.headers.set(String(name), value);
            return response;
        },

        getHeader(name) {
            const key = [...state.headers.keys()].find(
                (item) => item.toLowerCase() === String(name).toLowerCase()
            );
            return key ? state.headers.get(key) : undefined;
        },

        status(code) {
            state.statusCode = Number(code) || 200;
            return response;
        },

        send(body) {
            state.body = body == null ? "" : String(body);
            return response;
        },

        end(body = "") {
            state.body = body == null ? "" : String(body);
            return response;
        }
    };

    return { state, response };
}

function scheduleFromHtml(html) {
    const visible = html.match(
        /<div\s+class="taller-horario-visible-bloque">[\s\S]*?(<dl\s+class="taller-horario-visible">[\s\S]*?<\/dl>)[\s\S]*?<\/div>/i
    );

    if (visible?.[1]) {
        return visible[1];
    }

    const details = html.match(
        /<details\s+class="taller-horario">[\s\S]*?<dl>([\s\S]*?)<\/dl>[\s\S]*?<\/details>/i
    );

    if (details?.[1]) {
        return `<dl class="taller-horario-visible">${details[1]}</dl>`;
    }

    return "";
}

function greenCover(schedule) {
    return `
        <div
            id="taller-foto"
            class="ficha-publica-foto ficha-publica-portada-verde"
        >
            <div
                class="tm-auto-portada tm-auto-portada-grande tm-auto-portada-horario"
                role="group"
                aria-label="Horario de atención"
            >
                <div
                    class="tm-portada-identidad"
                    aria-hidden="true"
                >
                    <img
                        src="/favicon.svg"
                        alt=""
                        width="58"
                        height="58"
                    >
                    <strong>TallerMap</strong>
                    <span>
                        Conectamos conductores<br>
                        con talleres de confianza
                    </span>
                </div>

                <div class="tm-portada-horario-contenido">
                    <h2>
                        <span aria-hidden="true">◷</span>
                        Horario de atención
                    </h2>
                    ${schedule || `
                        <p class="taller-horario-no-disponible">
                            Horario no disponible
                        </p>
                    `}
                </div>
            </div>
        </div>
    `;
}

function normalizeServices(html) {
    if (/class="ficha-servicios-ofrecidos"/i.test(html)) {
        return html;
    }

    return html.replace(
        /<div\s+id="taller-servicios"\s+class="especialidades">([\s\S]*?)<\/div>/i,
        `
        <section
            class="ficha-servicios-ofrecidos"
            aria-labelledby="servicios-ofrecidos-titulo"
        >
            <h2 id="servicios-ofrecidos-titulo">
                Servicios que se ofrecen
            </h2>
            <p>Servicios confirmados en esta ficha</p>
            <div
                id="taller-servicios"
                class="especialidades especialidades-destacadas"
            >$1</div>
        </section>
        `
    );
}

function forceGreenPublicCard(source) {
    let html = String(source || "");
    const schedule = scheduleFromHtml(html);

    if (!/ficha-publica-portada-verde/i.test(html)) {
        html = html.replace(
            /<div\s+id="taller-foto"\s+class="ficha-publica-foto"(?:\s+data-foto-ruta="[^"]*")?\s*(?:hidden)?\s*>[\s\S]*?<\/div>/i,
            greenCover(schedule)
        );
    }

    html = html
        .replace(
            /<div\s+class="taller-horario-visible-bloque">[\s\S]*?<\/dl>\s*<\/div>/gi,
            ""
        )
        .replace(
            /<details\s+class="taller-horario">[\s\S]*?<\/details>/gi,
            ""
        )
        .replace(
            /class="ficha-publica-acciones"/gi,
            'class="ficha-publica-acciones ficha-publica-acciones-alicante"'
        )
        .replace(
            /class="ficha-publica-datos"/gi,
            'class="ficha-publica-datos ficha-publica-datos-alicante"'
        )
        .replace(
            /<p\s+id="taller-descripcion">[\s\S]*?<\/p>/i,
            ""
        );

    html = normalizeServices(html);

    return html;
}

export default async function handler(request, response) {
    const captured = captureResponse();

    await tallerHtmlHandler(
        request,
        captured.response
    );

    let body = captured.state.body;

    if (
        captured.state.statusCode === 200 &&
        /<html[\s>]/i.test(body)
    ) {
        body = forceGreenPublicCard(body);
    }

    for (const [name, value] of captured.state.headers.entries()) {
        response.setHeader(name, value);
    }

    response.setHeader(
        "X-TallerMap-Ficha-Unificada",
        "verde-v1"
    );

    response
        .status(captured.state.statusCode)
        .send(body);
}
