(function () {
  "use strict";

  let deferredPrompt = null;
  let fallbackTimer = null;

  const banner = () => document.getElementById("v4-install-banner");
  const button = () => document.getElementById("v4-install-button");
  const closeButton = () => document.getElementById("v4-install-close");
  const copy = () => document.querySelector("#v4-install-banner .v4-install-copy span");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function hideBanner() {
    const element = banner();
    if (element) element.hidden = true;
  }

  function showBanner() {
    if (isStandalone()) return;
    const element = banner();
    if (element) element.hidden = false;
  }

  function setNativeReady() {
    const installButton = button();
    const text = copy();
    if (installButton) {
      installButton.disabled = false;
      installButton.textContent = "Instalar";
    }
    if (text) text.textContent = "Añádelo a tu pantalla de inicio y abre directamente el Editor V4 con tu acceso habitual.";
    showBanner();
  }

  function setManualFallback() {
    if (deferredPrompt || isStandalone()) return;
    const installButton = button();
    const text = copy();
    if (installButton) {
      installButton.disabled = false;
      installButton.textContent = "Cómo instalar";
    }
    if (text) text.textContent = "Si Chrome no muestra el instalador automático, toca aquí y te indicamos la opción del menú del navegador.";
    showBanner();
  }

  async function installEditor() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        hideBanner();
      }
      return;
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.alert("En Chrome: toca los tres puntos (⋮) arriba o abajo del navegador y elige ‘Instalar aplicación’ o ‘Añadir a pantalla de inicio’. Después confirma ‘Instalar’. Si esa opción no aparece, recarga esta página una vez y vuelve a abrir el menú.");
    } else {
      window.alert("Abre el menú de tu navegador y elige ‘Instalar aplicación’ o ‘Añadir a pantalla de inicio’. El nombre será TallerMap Editor.");
    }
  }

  async function registrarServiceWorkerEditor() {
    if (!("serviceWorker" in navigator)) return;

    try {
      const rootScope = `${window.location.origin}/`;
      const registrations = await navigator.serviceWorker.getRegistrations();

      await Promise.all(registrations.map(async registration => {
        const worker = registration.active || registration.waiting || registration.installing;
        const scriptURL = String(worker?.scriptURL || "");
        const esEditorV4 = scriptURL.includes("/admin-editor-v4-sw.js");
        if (esEditorV4 && registration.scope === rootScope) {
          await registration.unregister();
        }
      }));

      await navigator.serviceWorker.register("/admin-editor-v4-sw.js?v=6", { scope: "/pages/" });
    } catch (error) {
      console.warn("No se pudo registrar TallerMap Editor como aplicación:", error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function montarGuardian() {
    if (document.getElementById("v4-guardian")) return;
    const anchor = document.querySelector(".v4-csv-import") || document.querySelector(".v4-card.v4-pad");
    if (!anchor) return;

    const section = document.createElement("section");
    section.id = "v4-guardian";
    section.className = "v4-csv-import";
    section.setAttribute("aria-labelledby", "v4-guardian-title");
    section.innerHTML = `
      <h2 id="v4-guardian-title">🛡️ Guardian</h2>
      <div class="v4-csv-help">Ejecuta el <strong>Quality Guard real</strong> del proyecto. Solo funciona con una sesión administrativa válida y no modifica datos ni archivos.</div>
      <div class="v4-actions">
        <button id="v4-guardian-ejecutar" class="v4-btn v4-primary" type="button">Ejecutar Guardian</button>
      </div>
      <div id="v4-guardian-estado" class="v4-status">Preparado para analizar la versión desplegada.</div>
      <div id="v4-guardian-kpis" class="v4-csv-kpis" hidden>
        <div><strong id="v4-guardian-score">—</strong><span>Score</span></div>
        <div><strong id="v4-guardian-errors">0</strong><span>Errores</span></div>
        <div><strong id="v4-guardian-warnings">0</strong><span>Advertencias</span></div>
        <div><strong id="v4-guardian-files">0</strong><span>Archivos</span></div>
      </div>
      <div id="v4-guardian-resultados" class="v4-csv-preview" aria-live="polite"></div>
    `;

    anchor.insertAdjacentElement("afterend", section);
    document.getElementById("v4-guardian-ejecutar")?.addEventListener("click", ejecutarGuardian);
  }

  async function ejecutarGuardian() {
    const runButton = document.getElementById("v4-guardian-ejecutar");
    const estado = document.getElementById("v4-guardian-estado");
    const resultados = document.getElementById("v4-guardian-resultados");
    const kpis = document.getElementById("v4-guardian-kpis");
    const sb = window.supabaseClient;

    if (!runButton || !estado || !resultados || !kpis || !sb) return;
    runButton.disabled = true;
    estado.textContent = "Guardian está analizando el proyecto…";
    estado.className = "v4-status";
    resultados.innerHTML = "";

    try {
      const { data: { session }, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Sesión administrativa no disponible");

      const response = await fetch("/api/guardian", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);

      const summary = data.summary || {};
      const metrics = data.metrics || {};
      document.getElementById("v4-guardian-score").textContent = `${summary.score ?? 0}/100`;
      document.getElementById("v4-guardian-errors").textContent = summary.errors ?? 0;
      document.getElementById("v4-guardian-warnings").textContent = summary.warnings ?? 0;
      document.getElementById("v4-guardian-files").textContent = metrics.filesAnalyzed ?? metrics.totalFiles ?? 0;
      kpis.hidden = false;

      const commit = data.commit ? String(data.commit).slice(0, 7) : "sin SHA";
      estado.textContent = `✓ Guardian ejecutado · ${summary.grade || "sin nota"} · ${data.branch || "main"} @ ${commit}`;
      estado.className = "v4-status ok";

      const issues = Array.isArray(data.issues) ? data.issues : [];
      if (!issues.length) {
        resultados.innerHTML = '<div class="v4-csv-row ok"><strong>Sin incidencias</strong><small>Guardian no ha detectado errores ni advertencias.</small></div>';
        return;
      }

      resultados.innerHTML = issues.map(issue => {
        const severity = issue.severity === "error" ? "error" : issue.severity === "warning" ? "duplicate" : "";
        const line = issue.line ? ` · línea ${escapeHtml(issue.line)}` : "";
        return `<div class="v4-csv-row ${severity}"><strong>${escapeHtml(issue.severity || "info").toUpperCase()} · ${escapeHtml(issue.file || "proyecto")}${line}</strong><small>${escapeHtml(issue.message || "")}</small></div>`;
      }).join("") + (data.truncated ? '<div class="v4-csv-row"><strong>Resultado recortado</strong><small>Se muestran las primeras 500 incidencias.</small></div>' : "");
    } catch (error) {
      estado.textContent = `No se pudo ejecutar Guardian: ${error?.message || error}`;
      estado.className = "v4-status error";
    } finally {
      runButton.disabled = false;
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    setNativeReady();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBanner();
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (isStandalone()) {
      hideBanner();
    } else {
      button()?.addEventListener("click", installEditor);
      closeButton()?.addEventListener("click", hideBanner);
      fallbackTimer = window.setTimeout(setManualFallback, 1800);
    }

    montarGuardian();
    void registrarServiceWorkerEditor();
  }, { once: true });
}());
