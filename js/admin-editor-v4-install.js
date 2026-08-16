(function () {
  "use strict";

  let deferredPrompt = null;

  const banner = () => document.getElementById("v4-install-banner");
  const button = () => document.getElementById("v4-install-button");
  const closeButton = () => document.getElementById("v4-install-close");

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

  async function installEditor() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      hideBanner();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
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
        .catch(error => console.warn("No se pudo registrar TallerMap Editor como aplicación:", error));
    }
  }, { once: true });
}());
