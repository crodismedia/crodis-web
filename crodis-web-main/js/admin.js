(function () {
    "use strict";
    const lista = document.getElementById("lista-solicitudes");
    const mensaje = document.getElementById("mensaje-admin");

    function escaparHtml(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function mostrar(texto, tipo = "error") {
        mensaje.textContent = texto;
        mensaje.className = `mensaje-formulario mensaje-${tipo}`;
        mensaje.hidden = false;
    }

    function ocultarMensaje() { mensaje.hidden = true; }

    function formatoFecha(valor) {
        return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
    }

    function tarjeta(solicitud) {
        const campos = [
            ["Propietario/a", solicitud.propietario], ["CIF", solicitud.cif], ["Email", solicitud.email],
            ["Teléfono", solicitud.telefono], ["Dirección", solicitud.direccion], ["Código postal", solicitud.codigo_postal],
            ["Ciudad", solicitud.ciudad], ["Provincia", solicitud.provincia], ["Descripción", solicitud.descripcion]
        ];
        return `<article class="solicitud-card" data-solicitud-id="${Number(solicitud.id)}">
            <div class="solicitud-titulo"><div><span>Solicitud #${Number(solicitud.id)}</span><h2>${escaparHtml(solicitud.nombre_taller)}</h2></div><time>${escaparHtml(formatoFecha(solicitud.created_at))}</time></div>
            <dl>${campos.map(([etiqueta, valor]) => `<div><dt>${escaparHtml(etiqueta)}</dt><dd>${escaparHtml(valor)}</dd></div>`).join("")}</dl>
            <div class="solicitud-acciones"><button class="boton boton-pequeno" data-accion="aprobar" type="button">Aprobar</button><button class="boton boton-rechazar boton-pequeno" data-accion="rechazar" type="button">Rechazar</button></div>
        </article>`;
    }

    async function cargarSolicitudes() {
        ocultarMensaje();
        lista.innerHTML = '<p class="mensaje-talleres">Cargando solicitudes…</p>';
        const { data, error } = await window.supabaseClient.from("solicitudes_alta_taller").select("*").eq("estado", "pendiente").order("created_at", { ascending: true });
        if (error) {
            lista.innerHTML = "";
            mostrar("No tienes permisos de administración o no se han podido cargar las solicitudes.");
            return;
        }
        lista.innerHTML = data.length ? data.map(tarjeta).join("") : '<p class="mensaje-talleres">No hay solicitudes pendientes.</p>';
    }

    async function gestionarSolicitud(id, accion, boton) {
        boton.disabled = true;
        const etiqueta = accion === "aprobar" ? "Aprobando..." : "Rechazando...";
        boton.textContent = etiqueta;
        const funcion = accion === "aprobar" ? "aprobar_solicitud" : "rechazar_solicitud";
        const { error } = await window.supabaseClient.rpc(funcion, { solicitud_id: id });
        if (error) {
            boton.disabled = false;
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
        gestionarSolicitud(id, boton.dataset.accion, boton);
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
