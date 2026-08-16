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
      return;
    }

    button()?.addEventListener("click", installEditor);
    closeButton()?.addEventListener("click", hideBanner);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin-editor-v4-sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .catch(error => console.warn("No se pudo registrar TallerMap Editor como aplicación:", error));
    }

    fallbackTimer = window.setTimeout(setManualFallback, 1800);
  }, { once: true });
}());
