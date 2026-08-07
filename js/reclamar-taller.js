(function () {
  "use strict";

  const supabase = window.supabaseClient;
  const params = new URLSearchParams(window.location.search);
  const slug = String(params.get("slug") || "").trim();
  const tallerBox = document.getElementById("claim-taller");
  const acceso = document.getElementById("claim-acceso");
  const formWrap = document.getElementById("claim-form-wrap");
  const mensaje = document.getElementById("claim-mensaje");
  const btnLink = document.getElementById("claim-enviar-enlace");
  const btnEnviar = document.getElementById("claim-enviar");
  let taller = null;

  function mostrar(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `claim-msg ${tipo}`;
    mensaje.hidden = false;
  }

  function limpiarMensaje() {
    mensaje.hidden = true;
    mensaje.textContent = "";
    mensaje.className = "";
  }

  async function cargarTaller() {
    if (!slug) {
      tallerBox.textContent = "No se ha indicado qué taller quieres reclamar.";
      btnLink.disabled = true;
      return;
    }
    const { data, error } = await supabase.rpc("obtener_taller_publico", { p_id: null, p_slug: slug });
    if (error || !Array.isArray(data) || !data.length) {
      console.error("No se pudo cargar el taller:", error);
      tallerBox.textContent = "No hemos podido localizar esta ficha.";
      btnLink.disabled = true;
      return;
    }
    taller = data[0];
    tallerBox.innerHTML = `<strong>${escapar(taller.nombre || "Taller")}</strong><br><span>${escapar([taller.direccion, taller.codigo_postal, taller.ciudad, taller.provincia].filter(Boolean).join(", "))}</span>`;
  }

  function escapar(valor) {
    const d = document.createElement("div");
    d.textContent = valor == null ? "" : String(valor);
    return d.innerHTML;
  }

  async function refrescarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    const activa = Boolean(session?.user);
    acceso.hidden = activa;
    formWrap.hidden = !activa;
    if (activa) document.getElementById("claim-session-email").textContent = session.user.email || "";
  }

  btnLink.addEventListener("click", async () => {
    limpiarMensaje();
    const email = document.getElementById("claim-email").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      mostrar("Escribe un correo electrónico válido.", "error");
      return;
    }
    btnLink.disabled = true;
    btnLink.textContent = "Enviando…";
    const redirect = new URL("/pages/reclamar-taller.html", window.location.origin);
    redirect.searchParams.set("slug", slug);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.href, shouldCreateUser: true }
    });
    btnLink.disabled = false;
    btnLink.textContent = "Recibir enlace de verificación";
    if (error) {
      console.error(error);
      mostrar("No se pudo enviar el enlace. Inténtalo de nuevo dentro de un minuto.", "error");
      return;
    }
    mostrar("Enlace enviado. Revisa tu correo y vuelve desde el enlace de verificación.", "ok");
  });

  document.getElementById("claim-cerrar").addEventListener("click", async () => {
    await supabase.auth.signOut();
    limpiarMensaje();
    await refrescarSesion();
  });

  document.getElementById("claim-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    limpiarMensaje();
    if (!taller?.id) {
      mostrar("No se ha podido identificar el taller.", "error");
      return;
    }
    const nombre = document.getElementById("claim-nombre").value.trim();
    const telefono = document.getElementById("claim-telefono").value.trim();
    const texto = document.getElementById("claim-texto").value.trim();
    if (nombre.length < 2) {
      mostrar("Indica tu nombre y apellidos.", "error");
      return;
    }
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando solicitud…";
    const { error } = await supabase.rpc("crear_reclamacion_taller", {
      p_taller_id: taller.id,
      p_nombre_contacto: nombre,
      p_telefono_contacto: telefono || null,
      p_mensaje: texto || null
    });
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar reclamación";
    if (error) {
      console.error(error);
      const detalle = String(error.message || "").toLowerCase();
      if (detalle.includes("pendiente_existente")) mostrar("Ya tienes una reclamación pendiente para este taller.", "error");
      else if (detalle.includes("ya_reclamado")) mostrar("Esta ficha ya está asignada a un propietario. Contacta con TallerMap si necesitas revisarla.", "error");
      else if (detalle.includes("sesion_requerida")) { mostrar("Tu sesión ha caducado. Verifica de nuevo tu correo.", "error"); await refrescarSesion(); }
      else mostrar("No se pudo registrar la reclamación. Inténtalo de nuevo.", "error");
      return;
    }
    document.getElementById("claim-form").reset();
    mostrar("Solicitud recibida. Queda pendiente de revisión administrativa. Cuando se apruebe, podrás gestionar la ficha desde “Mi taller”.", "ok");
  });

  supabase.auth.onAuthStateChange(() => { window.setTimeout(refrescarSesion, 0); });
  Promise.all([cargarTaller(), refrescarSesion()]).catch((error) => {
    console.error(error);
    mostrar("No se pudo iniciar el sistema de reclamación.", "error");
  });
}());