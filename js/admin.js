(function () {
    "use strict";
    const lista = document.getElementById("lista-solicitudes");
    const mensaje = document.getElementById("mensaje-admin");
    const escaparHtml = window.escaparHTML;

    function mostrar(texto, tipo = "error") {
        mensaje.textContent = texto;
        mensaje.className = `mensaje-formulario mensaje-${tipo}`;
        mensaje.hidden = false;
    }

    function ocultarMensaje() { mensaje.hidden = true; }

    function formatoFecha(valor) {
        if (!valor) return "Fecha no disponible";
        const fecha = new Date(valor);
        if (isNaN(fecha.getTime())) return "Fecha no válida";
        return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(fecha);
    }

    function tarjeta(solicitud) {
        const servicios = Array.isArray(solicitud.servicios) && solicitud.servicios.length
            ? solicitud.servicios.join(", ")
            : "No indicados";
        const campos = [
            ["Propietario/a", solicitud.propietario], ["CIF", solicitud.cif], ["Email", solicitud.email],
            ["Teléfono", solicitud.telefono], ["Página web", solicitud.web || "No indicada"],
            ["Dirección", solicitud.direccion], ["Código postal", solicitud.codigo_postal],
            ["Ciudad", solicitud.ciudad], ["Provincia", solicitud.provincia], ["Servicios", servicios],
            ["Condiciones aceptadas", solicitud.acepta_responsabilidad ? "Sí" : "No"],
            ["Condiciones de fotos", Array.isArray(solicitud.fotos) && solicitud.fotos.length
                ? (solicitud.acepta_condiciones_fotos ? "Sí" : "No")
                : "No aplican"],
            ["Modalidad", solicitud.plan_publicacion === "destacado"
                ? "Plan Destacado · 1,21 €/mes"
                : "Presencia gratuita"],
            ["Pago destacado", solicitud.suscripciones_destacadas?.[0]?.destacado_activo
                ? "Activo"
                : solicitud.plan_publicacion === "destacado" ? "Pendiente o no completado" : "No aplica"],
            ["Descripción", solicitud.descripcion]
        ];
        const galeria = Array.isArray(solicitud.fotosFirmadas) && solicitud.fotosFirmadas.length
            ? `<div class="solicitud-fotos">${solicitud.fotosFirmadas.map((url, indice) => `<a href="${escaparHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${escaparHtml(url)}" alt="Fotografía ${indice + 1} de ${escaparHtml(solicitud.nombre_taller)}" loading="lazy"></a>`).join("")}</div>`
            : '<p class="solicitud-sin-fotos">No se han añadido fotografías.</p>';
        return `<article class="solicitud-card" data-solicitud-id="${Number(solicitud.id)}">
            <div class="solicitud-titulo"><div><span>Solicitud #${Number(solicitud.id)}</span><h2>${escaparHtml(solicitud.nombre_taller)}</h2></div><time>${escaparHtml(formatoFecha(solicitud.created_at))}</time></div>
            <dl>${campos.map(([etiqueta, valor]) => `<div><dt>${escaparHtml(etiqueta)}</dt><dd>${escaparHtml(valor)}</dd></div>`).join("")}</dl>
            ${galeria}
            <div class="solicitud-acciones"><button class="boton boton-pequeno" data-accion="aprobar" type="button">Aprobar</button><button class="boton boton-rechazar boton-pequeno" data-accion="rechazar" type="button">Rechazar</button></div>
        </article>`;
    }

    async function adjuntarFotosFirmadas(solicitudes) {
        const rutas = [...new Set(solicitudes.flatMap((solicitud) =>
            Array.isArray(solicitud.fotos) ? solicitud.fotos : []
        ))];
        if (!rutas.length) return solicitudes;

        const { data, error } = await window.supabaseClient.storage
            .from("fotos-talleres")
            .createSignedUrls(rutas, 3600);
        if (error) {
            console.error("No se pudieron cargar las fotografías privadas:", error);
            return solicitudes;
        }
        const porRuta = new Map(
            (data || []).map((foto) => [foto.path, foto.signedUrl || foto.signedURL || ""])
        );
        return solicitudes.map((solicitud) => ({
            ...solicitud,
            fotosFirmadas: (solicitud.fotos || []).map((ruta) => porRuta.get(ruta)).filter(Boolean)
        }));
    }

    async function cargarSolicitudes() {
        ocultarMensaje();
        lista.innerHTML = '<p class="mensaje-talleres">Cargando solicitudes…</p>';
        let resultado = await window.supabaseClient
            .from("solicitudes_alta_taller")
            .select("id,nombre_taller,propietario,cif,email,telefono,web,direccion,codigo_postal,ciudad,provincia,servicios,fotos,descripcion,estado,acepta_responsabilidad,acepta_condiciones_fotos,acepta_condiciones_fotos_at,plan_publicacion,acepta_condiciones_destacado,suscripciones_destacadas(estado,destacado_activo,periodo_actual_fin),created_at")
            .eq("estado", "pendiente")
            .order("created_at", { ascending: true });
        if (resultado.error && (
            String(resultado.error.message || "").includes("suscripciones_destacadas")
            || String(resultado.error.message || "").includes("plan_publicacion")
        )) {
            resultado = await window.supabaseClient
                .from("solicitudes_alta_taller")
                .select("id,nombre_taller,propietario,cif,email,telefono,web,direccion,codigo_postal,ciudad,provincia,servicios,fotos,descripcion,estado,acepta_responsabilidad,acepta_condiciones_fotos,acepta_condiciones_fotos_at,created_at")
                .eq("estado", "pendiente")
                .order("created_at", { ascending: true });
        }
        if (resultado.error?.code === "42703" && String(resultado.error.message || "").includes("fotos")) {
            resultado = await window.supabaseClient
                .from("solicitudes_alta_taller")
                .select("id,nombre_taller,propietario,cif,email,telefono,web,direccion,codigo_postal,ciudad,provincia,servicios,descripcion,estado,acepta_responsabilidad,created_at")
                .eq("estado", "pendiente")
                .order("created_at", { ascending: true });
        }
        const { data, error } = resultado;
        if (error) {
            lista.innerHTML = "";
            mostrar("No tienes permisos de administración o no se han podido cargar las solicitudes.");
            return;
        }
        const solicitudes = data?.length ? await adjuntarFotosFirmadas(data) : [];
        lista.innerHTML = solicitudes.length ? solicitudes.map(tarjeta).join("") : '<p class="mensaje-talleres">No hay solicitudes pendientes.</p>';
    }

    async function gestionarSolicitud(id, accion, boton) {
        const tarjetaSolicitud = boton.closest("[data-solicitud-id]");
        tarjetaSolicitud.querySelectorAll("button").forEach((elemento) => {
            elemento.disabled = true;
        });
        const etiqueta = accion === "aprobar" ? "Aprobando..." : "Rechazando...";
        boton.textContent = etiqueta;
        const funcion = accion === "aprobar" ? "aprobar_solicitud" : "rechazar_solicitud";
        const { error } = await window.supabaseClient.rpc(funcion, { p_solicitud_id: id });
        if (error) {
            tarjetaSolicitud.querySelectorAll("button").forEach((elemento) => {
                elemento.disabled = false;
            });
            boton.textContent = accion === "aprobar" ? "Aprobar" : "Rechazar";
            mostrar(error.message.includes("duplicado") ? "No se puede aprobar: ya existe un taller con el mismo CIF o nombre y dirección." : "No se ha podido procesar la solicitud. Actualiza la página e inténtalo de nuevo.");
            return;
        }
        mostrar(accion === "aprobar" ? "Solicitud aprobada y taller creado." : "Solicitud rechazada.", "exito");
        await cargarSolicitudes();
    }

    lista?.addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;
        const id = Number(boton.closest("[data-solicitud-id]").dataset.solicitudId);
        if (!Number.isSafeInteger(id) || id < 1) return;
        const accion = boton.dataset.accion;
        const pregunta = accion === "aprobar"
            ? "¿Aprobar esta solicitud y publicar el taller?"
            : "¿Rechazar esta solicitud?";
        if (!window.confirm(pregunta)) return;
        gestionarSolicitud(id, accion, boton);
    });

    document.getElementById("boton-recargar")?.addEventListener("click", cargarSolicitudes);
    document.getElementById("boton-cerrar-sesion")?.addEventListener("click", async () => {
        await window.supabaseClient.auth.signOut();
        window.location.replace("admin-login.html");
    });

    (async function iniciar() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            window.location.replace("admin-login.html");
            return;
        }
        const { data: esAdministrador, error } = await window.supabaseClient.rpc("es_administrador");
        if (error || !esAdministrador) {
            await window.supabaseClient.auth.signOut();
            window.location.replace("admin-login.html");
            return;
        }
        await cargarSolicitudes();
    }());
}());
