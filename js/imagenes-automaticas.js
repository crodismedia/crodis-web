(function () {
  "use strict";

  if (window.__TALLERMAP_IMAGENES_AUTOMATICAS__) return;
  window.__TALLERMAP_IMAGENES_AUTOMATICAS__ = true;

  const SUPABASE_URL =
    "https://cnyptelvbsndpkzbrete.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

  let sdkPromise = null;
  let client = null;


  /* ==================================================
     UTILIDADES
  ================================================== */

  function texto(valor) {
    return String(valor || "")
      .replace(/\s+/g, " ")
      .trim();
  }


  function ubicacionCorta(valor) {
    const limpia = texto(valor)
      .replace(/^⌖\s*/, "");

    if (!limpia) {
      return "Ubicación no indicada";
    }

    const partes = limpia
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    return partes.length > 2
      ? partes.slice(-2).join(" · ")
      : partes.join(" · ");
  }


  function iniciales(nombre) {
    const palabras = texto(nombre)
      .split(" ")
      .filter(Boolean);

    if (!palabras.length) {
      return "TM";
    }

    return palabras
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }


  function hayImagenReal(contenedor) {
    return [
      ...contenedor.querySelectorAll("img")
    ].some((img) => {

      /*
       * El logo de TallerMap dentro de la portada
       * verde NO cuenta como fotografía real.
       */
      if (img.closest(".tm-auto-portada")) {
        return false;
      }

      return Boolean(
        texto(
          img.getAttribute("src")
        )
      );
    });
  }


  /* ==================================================
     PORTADA AZUL
     SOLO PARA TARJETAS DEL LISTADO
  ================================================== */

  function crearPortada(
    nombre,
    ubicacion,
    grande
  ) {
    const portada =
      document.createElement("div");

    portada.className =
      `tm-auto-portada${
        grande
          ? " tm-auto-portada-grande"
          : ""
      }`;

    portada.setAttribute(
      "role",
      "img"
    );

    portada.setAttribute(
      "aria-label",
      `Imagen genérica de TallerMap para ${nombre}; fotografía no disponible`
    );


    const marca =
      document.createElement("div");

    marca.className =
      "tm-auto-marca";


    const sello =
      document.createElement("span");

    sello.className =
      "tm-auto-sello";

    sello.textContent =
      iniciales(nombre);


    const brand =
      document.createElement("span");

    brand.textContent =
      "TallerMap";


    marca.append(
      sello,
      brand
    );


    const contenido =
      document.createElement("div");

    contenido.className =
      "tm-auto-contenido";


    const tipo =
      document.createElement("span");

    tipo.className =
      "tm-auto-tipo";

    tipo.textContent =
      "Imagen no disponible";


    const titulo =
      document.createElement("strong");

    titulo.textContent =
      nombre;


    const lugar =
      document.createElement("span");

    lugar.className =
      "tm-auto-lugar";

    lugar.textContent =
      ubicacion;


    contenido.append(
      tipo,
      titulo,
      lugar
    );


    const pie =
      document.createElement("small");

    pie.textContent =
      "Portada genérica de TallerMap";


    portada.append(
      marca,
      contenido,
      pie
    );

    return portada;
  }


  /* ==================================================
     OBTENER HORARIO EXISTENTE
  ================================================== */

  function clonarHorarioVisible() {

    /*
     * Caso antiguo:
     * horario dentro de <details>.
     */
    const horarioDetails =
      document.querySelector(
        "#taller-datos .taller-horario"
      );

    const dlDetails =
      horarioDetails?.querySelector("dl");

    if (dlDetails) {
      const copia =
        dlDetails.cloneNode(true);

      copia.className =
        "taller-horario-visible";

      horarioDetails.remove();

      return copia;
    }


    /*
     * Caso SSR nuevo:
     * horario ya visible dentro del bloque.
     */
    const horarioVisible =
      document.querySelector(
        "#taller-datos .taller-horario-visible"
      );

    if (horarioVisible) {
      const copia =
        horarioVisible.cloneNode(true);

      const bloque =
        horarioVisible.closest(
          ".taller-horario-visible-bloque"
        );

      bloque?.remove();

      return copia;
    }


    return null;
  }


  /* ==================================================
     PORTADA VERDE DE FICHA PÚBLICA
  ================================================== */

  function crearPortadaVerde(
    horarioVisible
  ) {
    const portada =
      document.createElement("div");

    portada.className =
      "tm-auto-portada tm-auto-portada-grande tm-auto-portada-horario";

    portada.setAttribute(
      "role",
      "group"
    );

    portada.setAttribute(
      "aria-label",
      "Horario de atención"
    );


    const identidad =
      document.createElement("div");

    identidad.className =
      "tm-portada-identidad";

    identidad.setAttribute(
      "aria-hidden",
      "true"
    );


    const logo =
      document.createElement("img");

    logo.src =
      "/favicon.svg";

    logo.alt =
      "";

    logo.width =
      58;

    logo.height =
      58;


    const marca =
      document.createElement("strong");

    marca.textContent =
      "TallerMap";


    const lema =
      document.createElement("span");

    lema.innerHTML =
      "Conectamos conductores<br>con talleres de confianza";


    identidad.append(
      logo,
      marca,
      lema
    );


    const contenido =
      document.createElement("div");

    contenido.className =
      "tm-portada-horario-contenido";


    const titulo =
      document.createElement("h2");

    titulo.textContent =
      "◷ Horario de atención";


    contenido.appendChild(
      titulo
    );


    if (horarioVisible) {

      contenido.appendChild(
        horarioVisible
      );

    } else {

      const sinHorario =
        document.createElement("p");

      sinHorario.className =
        "taller-horario-no-disponible";

      sinHorario.textContent =
        "Horario no disponible";

      contenido.appendChild(
        sinHorario
      );
    }


    portada.append(
      identidad,
      contenido
    );

    return portada;
  }


  /* ==================================================
     TARJETAS DEL LISTADO
  ================================================== */

  function asegurarTarjeta(
    tarjeta
  ) {
    const contenedor =
      tarjeta.querySelector(
        ".taller-imagen"
      );

    if (!contenedor) {
      return;
    }


    const existente =
      contenedor.querySelector(
        ":scope > .tm-auto-portada"
      );


    if (
      hayImagenReal(
        contenedor
      )
    ) {
      existente?.remove();
      return;
    }


    const nombre =
      texto(
        tarjeta.querySelector("h3")
          ?.textContent
      ) ||
      "Taller sin nombre";


    const ubicacion =
      ubicacionCorta(
        tarjeta.querySelector(
          ".ubicacion"
        )?.textContent
      );


    /*
     * En el LISTADO mantenemos
     * la portada azul.
     */
    if (!existente) {
      contenedor.prepend(
        crearPortada(
          nombre,
          ubicacion,
          false
        )
      );
    }
  }


  /* ==================================================
     FICHA PÚBLICA INDIVIDUAL

     REGLA DEFINITIVA:

     SI HAY FOTO REAL:
       mostrar foto.

     SI NO HAY FOTO REAL:
       mostrar SIEMPRE portada verde.

     Ya no depende de Alicante,
     Castellón o Valencia.
  ================================================== */

  function asegurarFicha() {

    const contenedor =
      document.getElementById(
        "taller-foto"
      );


    const nombre =
      texto(
        document.getElementById(
          "taller-nombre"
        )?.textContent
      );


    if (
      !contenedor ||
      !nombre ||
      nombre === "Ficha de taller"
    ) {
      return;
    }


    const existente =
      contenedor.querySelector(
        ":scope > .tm-auto-portada"
      );


    /*
     * Si existe fotografía real:
     * respetarla y eliminar cualquier
     * portada automática.
     */
    if (
      hayImagenReal(
        contenedor
      )
    ) {
      existente?.remove();

      contenedor.classList.remove(
        "ficha-publica-portada-verde"
      );

      contenedor.hidden =
        false;

      return;
    }


    /*
     * Si el SSR ya ha generado
     * correctamente la portada verde,
     * NO sustituirla.
     */
    if (
      existente?.classList.contains(
        "tm-auto-portada-horario"
      )
    ) {

      const horarioVisible =
        clonarHorarioVisible();


      if (horarioVisible) {

        const contenido =
          existente.querySelector(
            ".tm-portada-horario-contenido"
          );


        contenido
          ?.querySelector(
            ".taller-horario-no-disponible"
          )
          ?.remove();


        contenido
          ?.querySelector(
            ".taller-horario-visible"
          )
          ?.remove();


        contenido?.appendChild(
          horarioVisible
        );
      }


      contenedor.classList.add(
        "ficha-publica-portada-verde"
      );

      contenedor.hidden =
        false;

      return;
    }


    /*
     * Si existe portada azul en una ficha
     * individual, eliminarla.
     */
    existente?.remove();


    /*
     * Recuperar horario disponible.
     */
    const horarioVisible =
      clonarHorarioVisible();


    /*
     * Crear una única portada VERDE.
     */
    contenedor.prepend(
      crearPortadaVerde(
        horarioVisible
      )
    );


    contenedor.classList.add(
      "ficha-publica-portada-verde"
    );


    contenedor.hidden =
      false;
  }


  /* ==================================================
     REVISIÓN
  ================================================== */

  function revisar() {

    document
      .querySelectorAll(
        ".taller-card"
      )
      .forEach(
        asegurarTarjeta
      );


    asegurarFicha();
  }


  /* ==================================================
     SUPABASE SDK
  ================================================== */

  function cargarSDK() {

    if (
      window.supabase
        ?.createClient
    ) {
      return Promise.resolve(
        window.supabase
      );
    }


    if (sdkPromise) {
      return sdkPromise;
    }


    sdkPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0";


          script.onload =
            () =>
              window.supabase
                ?.createClient

                ? resolve(
                    window.supabase
                  )

                : reject(
                    new Error(
                      "Supabase no disponible"
                    )
                  );


          script.onerror =
            () =>
              reject(
                new Error(
                  "No se pudo cargar Supabase"
                )
              );


          document.head
            .appendChild(
              script
            );
        }
      );


    return sdkPromise;
  }


  /* ==================================================
     FOTOS AUTORIZADAS
  ================================================== */

  async function cargarFotosAutorizadas() {

    const selector =
      ".taller-imagen[data-foto-ruta], .ficha-publica-foto[data-foto-ruta]";


    const contenedores =
      [
        ...document.querySelectorAll(
          selector
        )
      ]
        .filter(
          (contenedor) =>
            !hayImagenReal(
              contenedor
            ) &&
            contenedor.dataset
              .fotoIntentada !== "1"
        );


    if (!contenedores.length) {
      return;
    }


    contenedores.forEach(
      (contenedor) => {
        contenedor.dataset
          .fotoIntentada = "1";
      }
    );


    try {

      const sdk =
        await cargarSDK();


      client ||=
        sdk.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );


      const rutas =
        [
          ...new Set(
            contenedores
              .map(
                (contenedor) =>
                  contenedor.dataset
                    .fotoRuta
              )
              .filter(Boolean)
          )
        ];


      const {
        data,
        error
      } =
        await client
          .storage
          .from(
            "fotos-talleres"
          )
          .createSignedUrls(
            rutas,
            3600
          );


      if (error) {
        throw error;
      }


      const porRuta =
        new Map(
          (data || [])
            .map(
              (item) => [
                item.path,
                item.signedUrl ||
                item.signedURL ||
                ""
              ]
            )
        );


      contenedores.forEach(
        (contenedor) => {

          const url =
            porRuta.get(
              contenedor.dataset
                .fotoRuta
            );


          if (!url) {
            return;
          }


          const esFicha =
            contenedor.classList
              .contains(
                "ficha-publica-foto"
              );


          const nombre =
            esFicha

              ? (
                  texto(
                    document
                      .getElementById(
                        "taller-nombre"
                      )
                      ?.textContent
                  ) ||
                  "taller"
                )

              : (
                  texto(
                    contenedor
                      .closest(
                        ".taller-card"
                      )
                      ?.querySelector(
                        "h3"
                      )
                      ?.textContent
                  ) ||
                  "taller"
                );


          const imagen =
            document.createElement(
              "img"
            );


          if (esFicha) {
            imagen.id =
              "taller-foto-imagen";
          }


          imagen.src =
            url;


          imagen.alt =
            `Fotografía de ${nombre}`;


          imagen.loading =
            "lazy";


          imagen.decoding =
            "async";


          contenedor.prepend(
            imagen
          );
        }
      );


      revisar();

    } catch (error) {

      console.warn(
        "No se pudieron cargar las fotografías autorizadas:",
        error
      );


      /*
       * Si falla la foto de una ficha pública,
       * revisar otra vez para garantizar
       * la portada verde.
       */
      asegurarFicha();
    }
  }


  /* ==================================================
     ESTILOS DE PLACEHOLDER
     SOLO BASE DE IMAGEN AUTOMÁTICA
  ================================================== */

  function instalarEstilos() {

    if (
      document.getElementById(
        "tm-auto-portadas-estilos"
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "tm-auto-portadas-estilos";


    style.textContent =
      `
      .taller-imagen,
      .ficha-publica-foto {
        position: relative;
        overflow: hidden;
      }


      .tm-auto-portada {
        position: absolute;
        inset: 0;
        z-index: 0;

        display: flex;
        flex-direction: column;
        justify-content: space-between;

        gap: 12px;

        padding: 18px;

        background:
          linear-gradient(
            135deg,
            #f8fafc 0%,
            #eef3ff 58%,
            #dce7ff 100%
          );

        color: #172033;

        text-align: left;

        border:
          1px solid
          #dbe4f2;
      }


      .tm-auto-portada::after {
        content: "";

        position: absolute;

        right: -42px;
        top: -52px;

        width: 170px;
        height: 170px;

        border-radius: 50%;

        background:
          rgba(
            18,
            70,
            216,
            .08
          );

        pointer-events: none;
      }


      .tm-auto-marca,
      .tm-auto-contenido,
      .tm-auto-portada small {
        position: relative;
        z-index: 1;
      }


      .tm-auto-marca {
        display: flex;
        align-items: center;

        gap: 9px;

        font-weight: 850;

        font-size: .88rem;

        letter-spacing: .01em;

        color: #173a7a;
      }


      .tm-auto-sello {
        display: inline-flex;

        align-items: center;
        justify-content: center;

        width: 34px;
        height: 34px;

        border-radius: 10px;

        background: #ffffff;

        color: #1246d8;

        font-size: .78rem;

        font-weight: 950;

        box-shadow:
          0
          5px
          15px
          rgba(
            18,
            70,
            216,
            .12
          );

        border:
          1px solid
          #d6e0f2;
      }


      .tm-auto-contenido {
        display: grid;

        gap: 4px;

        align-content: center;
      }


      .tm-auto-tipo {
        font-size: .72rem;

        font-weight: 850;

        text-transform: uppercase;

        letter-spacing: .08em;

        color: #3159b8;
      }


      .tm-auto-contenido strong {
        display: -webkit-box;

        -webkit-line-clamp: 2;

        -webkit-box-orient: vertical;

        overflow: hidden;

        font-size: 1.22rem;

        line-height: 1.08;

        letter-spacing: -.02em;

        color: #172033;
      }


      .tm-auto-lugar {
        display: block;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

        font-size: .82rem;

        color: #5d6a7d;
      }


      .tm-auto-portada small {
        font-size: .68rem;

        color: #6f7d91;
      }


      .taller-imagen > img {
        position: relative;

        z-index: 1;
      }


      .taller-imagen > .verificado {
        position: relative;

        z-index: 3;
      }


      .ficha-publica-foto:has(
        .tm-auto-portada-grande
      ) {
        min-height: 320px;
      }


      .tm-auto-portada-grande {
        padding: 30px;
      }


      .tm-auto-portada-grande
      .tm-auto-sello {
        width: 48px;
        height: 48px;

        font-size: 1rem;

        border-radius: 13px;
      }


      .tm-auto-portada-grande
      .tm-auto-marca {
        font-size: 1rem;
      }


      .tm-auto-portada-grande
      .tm-auto-contenido strong {
        font-size:
          clamp(
            1.8rem,
            4vw,
            3.1rem
          );

        max-width: 780px;
      }


      .tm-auto-portada-grande
      .tm-auto-tipo {
        font-size: .86rem;
      }


      .tm-auto-portada-grande
      .tm-auto-lugar {
        font-size: 1rem;
      }


      .ficha-publica-foto
      > img[src]:not([src=""]) {
        position: relative;

        z-index: 2;
      }


      .taller-card
      .taller-pie
      a.enlace-ficha-taller,

      .taller-card
      .taller-pie
      a[href*="google.com/maps"],

      .taller-card
      .taller-pie
      a[href*="maps.google"] {
        color: #ffffff !important;

        -webkit-text-fill-color:
          #ffffff !important;
      }


      @media(
        max-width: 600px
      ) {

        .ficha-publica-foto:has(
          .tm-auto-portada-grande
        ) {
          min-height: 250px;
        }


        .tm-auto-portada-grande {
          padding: 22px;
        }


        .taller-card
        .taller-imagen:has(
          > .tm-auto-portada:not(
            .tm-auto-portada-grande
          )
        ) {
          height: 148px !important;

          min-height: 148px !important;

          aspect-ratio:
            auto !important;
        }


        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        ) {
          padding:
            14px
            16px;

          gap: 8px;

          justify-content:
            space-between;
        }


        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        )
        .tm-auto-contenido strong,

        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        )
        .tm-auto-lugar,

        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        )
        small {
          display: none;
        }


        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        )
        .tm-auto-contenido {
          margin-top: auto;
        }


        .taller-card
        .tm-auto-portada:not(
          .tm-auto-portada-grande
        )
        .tm-auto-tipo {
          font-size: .75rem;
        }
      }
      `;


    document.head.appendChild(
      style
    );
  }


  /* ==================================================
     INICIO
  ================================================== */

  function iniciar() {

    instalarEstilos();

    revisar();

    void cargarFotosAutorizadas();


    let temporizador =
      0;


    new MutationObserver(
      () => {

        window.clearTimeout(
          temporizador
        );


        temporizador =
          window.setTimeout(
            () => {

              revisar();

              void cargarFotosAutorizadas();

            },
            40
          );
      }
    )
      .observe(
        document.body,
        {
          childList: true,

          subtree: true,

          characterData: true,

          attributes: true,

          attributeFilter: [
            "src",
            "hidden"
          ]
        }
      );
  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      iniciar,
      {
        once: true
      }
    );

  } else {

    iniciar();
  }

}());
