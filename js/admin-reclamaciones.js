(function () {
  "use strict";
  const supabase = window.supabaseClient;
  const tbody = document.getElementById("tabla-reclamaciones");
  const estadoUI = document.getElementById("admin-estado");
  let reclamaciones = [];
  let talleres = new Map();

  function escapar(valor) {
    const d = document.createElement("div");
    d.textContent = valor == null ? "" : String(valor);
    return d.innerHTML;
  }

  function fecha(valor) {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(d);
  }

  function estadoBadge(estado) {
    return `<span class="admin-badge">${escapar(estado || "—")}</span>`;
  }

  async function proteger() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace("admin-login.html"); return false; }
    const { data: admin, error } = await supabase.rpc("es_administrador");
    if (error || !admin) { await supabase.auth.signOut(); window.location.replace("admin-login.html"); return false; }
    document.getElementById("admin-usuario").textContent = session.user.email || "Administrador";
    estadoUI.textContent = "Acceso verificado";
    return true;
  }

  async function metricas() {
    const estados = ["pendiente", "aprobada", "rechazada"];
    const ids = { pendiente: "rec-pendientes", aprobada: "rec-aprobadas", rechazada: "rec-rechazadas" };
    await Promise.all(estados.map(async (estado) => {
      const { count } = await supabase.from("reclamaciones_taller").select("id", { count: "exact", head: true }).eq("estado", estado);
      document.getElementById(ids[estado]).textContent = Number.isFinite(count) ? count : "—";
    }));
  }

  async function cargarTalleres(ids) {
    talleres = new Map();
    if (!ids.length) return;
    const { data } = await supabase.from("talleres").select("id,nombre,slug,ciudad").in("id", ids);
    (data || []).forEach((t) => talleres.set(t.id, t));
  }

  function filtrarLocal() {
    const texto = document.getElementById("rec-busqueda").value.trim().toLowerCase();
    const estado = document.getElementById("rec-estado").value;
    return reclamaciones.filter((r) => {
      if (estado !== "todas" && r.estado !== estado) return false;
      if (!texto) return true;
      const t = talleres.get(r.taller_id);
      return [t?.nombre, t?.ciudad, r.email, r.nombre_contacto, r.telefono_contacto, r.mensaje]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(texto));
    });
  }

  function render() {
    const filas = filtrarLocal();
    if (!filas.length) {
      tbody.innerHTML = '<tr><td colspan="6">No hay reclamaciones con estos filtros.</td></tr>';
      return;
    }
    tbody.innerHTML = filas.map((r) => {
      const t = talleres.get(r.taller_id) || {};
      const link = t.slug ? `<a href="/talleres/${encodeURIComponent(t.slug)}" target="_blank" rel="noopener">${escapar(t.nombre || "Ver ficha")}</a>` : escapar(t.nombre || r.taller_id);
      const acciones = r.estado === "pendiente"
        ? `<button class="admin-btn" data-aprobar="${r.id}" type="button">Aprobar</button> <button class="admin-btn" data-rechazar="${r.id}" type="button">Rechazar</button>`
        : "—";
      return `<tr><td><strong>${link}</strong><br><small>${escapar(t.ciudad || "")}</small></td><td><strong>${escapar(r.nombre_contacto)}</strong><br>${escapar(r.email)}<br><small>${escapar(r.telefono_contacto || "")}</small></td><td>${escapar(r.mensaje || "Sin información adicional")}</td><td>${estadoBadge(r.estado)}</td><td>${fecha(r.created_at)}</td><td>${acciones}</td></tr>`;
    }).join("");
  }

  async function cargar() {
    estadoUI.textContent = "Cargando…";
    const { data, error } = await supabase.from("reclamaciones_taller").select("id,taller_id,usuario_id,email,nombre_contacto,telefono_contacto,mensaje,estado,created_at,revisado_at").order("created_at", { ascending: false }).limit(300);
    if (error) {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="6">No se pudieron cargar las reclamaciones. Comprueba que el SQL de la fase 8 está activo.</td></tr>';
      estadoUI.textContent = "Error de carga";
      return;
    }
    reclamaciones = data || [];
    await cargarTalleres([...new Set(reclamaciones.map((r) => r.taller_id).filter(Boolean))]);
    render();
    await metricas();
    estadoUI.textContent = "Actualizado";
  }

  async function resolver(id, aprobar) {
    const accion = aprobar ? "aprobar" : "rechazar";
    if (!window.confirm(`¿Seguro que quieres ${accion} esta reclamación?`)) return;
    estadoUI.textContent = aprobar ? "Aprobando…" : "Rechazando…";
    const { error } = await supabase.rpc("resolver_reclamacion_taller", { p_reclamacion_id: Number(id), p_aprobar: aprobar });
    if (error) {
      console.error(error);
      window.alert(`No se pudo ${accion} la reclamación: ${error.message || "error desconocido"}`);
      estadoUI.textContent = "Error";
      return;
    }
    await cargar();
  }

  tbody.addEventListener("click", (event) => {
    const aprobar = event.target.closest("[data-aprobar]");
    const rechazar = event.target.closest("[data-rechazar]");
    if (aprobar) resolver(aprobar.dataset.aprobar, true);
    if (rechazar) resolver(rechazar.dataset.rechazar, false);
  });
  document.getElementById("btn-filtrar").addEventListener("click", render);
  document.getElementById("rec-busqueda").addEventListener("input", render);
  document.getElementById("rec-estado").addEventListener("change", render);
  document.getElementById("btn-recargar").addEventListener("click", cargar);
  document.getElementById("btn-cerrar-sesion").addEventListener("click", async () => { await supabase.auth.signOut(); window.location.replace("admin-login.html"); });

  proteger().then((ok) => { if (ok) cargar(); });
}());