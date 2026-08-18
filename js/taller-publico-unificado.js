(() => {
  "use strict";

  function crearPortadaDesdeHorario(horario) {
    const foto = document.getElementById("taller-foto");
    if (!foto || !horario) return;

    foto.hidden = false;
    foto.classList.add("ficha-publica-portada-verde");
    foto.innerHTML = `
      <div class="tm-auto-portada tm-auto-portada-grande tm-auto-portada-horario" role="group" aria-label="Horario de atención">
        <div class="tm-portada-identidad" aria-hidden="true">
          <img src="/favicon.svg" alt="" width="58" height="58">
          <strong>TallerMap</strong>
          <span>Conectamos conductores<br>con talleres de confianza</span>
        </div>
        <div class="tm-portada-horario-contenido">
          <h2><span aria-hidden="true">◷</span> Horario de atención</h2>
          ${horario}
        </div>
      </div>`;
  }

  function unificarAcciones() {
    const acciones = document.getElementById("taller-acciones");
    if (!acciones) return;
    acciones.classList.add("ficha-publica-acciones-alicante");

    const whatsapp = acciones.querySelector(".accion-whatsapp");
    const mapa = acciones.querySelector(".accion-mapa");
    if (whatsapp && mapa && whatsapp.compareDocumentPosition(mapa) & Node.DOCUMENT_POSITION_PRECEDING) {
      acciones.insertBefore(whatsapp, mapa);
    }
  }

  function unificarServicios() {
    const servicios = document.getElementById("taller-servicios");
    if (!servicios || servicios.closest(".ficha-servicios-ofrecidos")) return;

    servicios.classList.add("especialidades-destacadas");
    const seccion = document.createElement("section");
    seccion.className = "ficha-servicios-ofrecidos";
    seccion.setAttribute("aria-labelledby", "servicios-ofrecidos-titulo");
    seccion.innerHTML = `
      <h2 id="servicios-ofrecidos-titulo">Servicios que se ofrecen</h2>
      <p>Servicios confirmados en esta ficha</p>`;
    servicios.parentNode.insertBefore(seccion, servicios);
    seccion.appendChild(servicios);
  }

  function unificarDatosYHorario() {
    const datos = document.getElementById("taller-datos");
    if (!datos) return;
    datos.classList.add("ficha-publica-datos-alicante");

    const foto = document.getElementById("taller-foto");
    const tieneFotoReal = foto && !foto.hidden && (foto.querySelector("img#taller-foto-imagen") || foto.dataset.fotoRuta);
    const details = datos.querySelector("details.taller-horario");

    if (!details) {
      if (foto && foto.hidden) {
        crearPortadaDesdeHorario('<p class="taller-horario-no-disponible">Horario no disponible</p>');
      }
      return;
    }

    const dl = details.querySelector("dl");
    if (!dl) return;
    dl.classList.add("taller-horario-visible");
    const horarioHtml = dl.outerHTML;

    if (tieneFotoReal) {
      const bloque = document.createElement("div");
      bloque.className = "taller-horario-visible-bloque";
      bloque.innerHTML = `<h2>Horario de atención</h2>${horarioHtml}`;
      details.replaceWith(bloque);
    } else {
      details.remove();
      crearPortadaDesdeHorario(horarioHtml);
    }
  }

  function iniciar() {
    if (!document.getElementById("ficha-taller")) return;
    unificarAcciones();
    unificarServicios();
    unificarDatosYHorario();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
