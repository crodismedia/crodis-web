(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const supabase = window.supabaseClient;
  const PROVINCIAS = {
    "01": "Araba/Álava", "02": "Albacete", "03": "Alicante/Alacant",
    "04": "Almería", "05": "Ávila", "06": "Badajoz",
    "07": "Illes Balears", "08": "Barcelona", "09": "Burgos",
    "10": "Cáceres", "11": "Cádiz", "12": "Castellón/Castelló",
    "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
    "16": "Cuenca", "17": "Girona", "18": "Granada",
    "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva",
    "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
    "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga",
    "30": "Murcia", "31": "Navarra", "32": "Ourense", "33": "Asturias",
    "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
    "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
    "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona",
    "44": "Teruel", "45": "Toledo", "46": "Valencia/València",
    "47": "Valladolid", "48": "Bizkaia", "49": "Zamora",
    "50": "Zaragoza", "51": "Ceuta", "52": "Melilla"
  };

  let municipios = [];
  let catalogoCargado = false;
  let aprobado = false;
  let temporizador = null;

  function valor(id) {
    return String($(id)?.value || "").trim();
  }

  function normalizar(valorTexto) {
    return String(valorTexto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/^\s*(el|la|los|las)\s+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aliasMunicipio(nombre) {
    return [...new Set([
      nombre,
      ...String(nombre || "").split("/")
    ].map(normalizar).filter(Boolean))];
  }

  function prefijoPostal() {
    const cp = valor("codigo_postal");
    return /^\d{5}$/.test(cp) ? cp.slice(0, 2) : "";
  }

  function provinciaEsperada() {
    return PROVINCIAS[prefijoPostal()] || "";
  }

  function municipiosProvincia() {
    const prefijo = prefijoPostal();
    return municipios.filter((municipio) =>
      String(municipio.codigo_municipal || "").startsWith(prefijo)
    );
  }

  function buscarMunicipio() {
    const ciudad = normalizar(valor("ciudad"));
    if (!ciudad) return null;
    return municipiosProvincia().find((municipio) =>
      aliasMunicipio(municipio.nombre).includes(ciudad)
    ) || null;
  }

  function botonGuardar() {
    return $("form-taller")?.querySelector('button[type="submit"]') || null;
  }

  function camposTerritoriales() {
    return ["codigo_postal", "ciudad", "provincia"]
      .map((id) => $(id)?.closest(".tm-field"))
      .filter(Boolean);
  }

  function pintar(tipo, texto) {
    const caja = $("resultado-territorio");
    if (!caja) return;

    const configuracion = {
      comprobando: { color: "#667085", fondo: "#f8fafc", borde: "#cbd5e1", icono: "…" },
      ok: { color: "#15803d", fondo: "#f0fdf4", borde: "#86efac", icono: "✓" },
      error: { color: "#b91c1c", fondo: "#fef2f2", borde: "#fca5a5", icono: "✕" }
    }[tipo];

    caja.style.color = configuracion.color;
    caja.style.background = configuracion.fondo;
    caja.style.borderColor = configuracion.borde;
    caja.innerHTML = `<strong>${configuracion.icono} ${texto}</strong>`;
    camposTerritoriales().forEach((campo) => {
      campo.classList.toggle("tm-territorio-aprobado", tipo === "ok");
      campo.classList.toggle("tm-territorio-error", tipo === "error");
    });
  }

  function establecerAprobado(valorAprobado) {
    aprobado = Boolean(valorAprobado);
    const boton = botonGuardar();
    if (boton) boton.disabled = !aprobado;
    $("form-taller")?.toggleAttribute("data-territorio-aprobado", aprobado);
  }

  function rellenarMunicipios() {
    const lista = $("municipios-admin-catalogo");
    if (!lista) return;
    lista.replaceChildren();
    municipiosProvincia().forEach((municipio) => {
      const opcion = document.createElement("option");
      opcion.value = municipio.nombre;
      opcion.label = `Código municipal ${municipio.codigo_municipal}`;
      lista.appendChild(opcion);
    });
  }

  function sincronizarProvincia() {
    const provincia = provinciaEsperada();
    const campo = $("provincia");
    if (!campo || !provincia || campo.value === provincia) return;
    campo.value = provincia;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function validarTerritorio() {
    establecerAprobado(false);

    if (!valor("taller-id")) {
      pintar("comprobando", "Selecciona un taller para comprobar su ubicación.");
      return false;
    }

    const cp = valor("codigo_postal");
    if (!/^\d{5}$/.test(cp)) {
      pintar("error", "El código postal debe contener exactamente 5 dígitos.");
      return false;
    }

    const provincia = provinciaEsperada();
    if (!provincia) {
      pintar("error", "El código postal no corresponde a una provincia española válida.");
      return false;
    }

    sincronizarProvincia();

    if (!catalogoCargado) {
      pintar("comprobando", "Comprobando el catálogo territorial de TallerMap…");
      return false;
    }

    const disponibles = municipiosProvincia();
    if (!disponibles.length) {
      pintar("error", `El catálogo de TallerMap no tiene municipios activos para ${provincia}.`);
      return false;
    }

    const municipio = buscarMunicipio();
    if (!municipio) {
      pintar("error", `Selecciona un municipio válido de ${provincia} en la lista de TallerMap.`);
      return false;
    }

    if (valor("ciudad") !== municipio.nombre) {
      $("ciudad").value = municipio.nombre;
      $("ciudad").dispatchEvent(new Event("input", { bubbles: true }));
      $("ciudad").dispatchEvent(new Event("change", { bubbles: true }));
    }

    establecerAprobado(true);
    pintar("ok", `Aprobado · ${municipio.nombre} · ${provincia} · ${cp}`);
    return true;
  }

  function programarValidacion() {
    establecerAprobado(false);
    pintar("comprobando", "Comprobando provincia, municipio y código postal…");
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
      rellenarMunicipios();
      validarTerritorio();
    }, 220);
  }

  async function cargarCatalogo() {
    if (!supabase?.from) {
      pintar("error", "No se pudo abrir el catálogo territorial de TallerMap.");
      return;
    }

    const { data, error } = await supabase
      .from("municipios")
      .select("nombre,codigo_municipal")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("No se pudo cargar el catálogo territorial:", error);
      pintar("error", `No se pudo comprobar el catálogo: ${error.message}`);
      return;
    }

    municipios = Array.isArray(data) ? data : [];
    catalogoCargado = true;
    rellenarMunicipios();
    validarTerritorio();
  }

  function construir() {
    const form = $("form-taller");
    if (!form || $("validacion-territorio")) return;

    const lista = document.createElement("datalist");
    lista.id = "municipios-admin-catalogo";
    document.body.appendChild(lista);
    $("ciudad")?.setAttribute("list", lista.id);
    $("ciudad")?.setAttribute("autocomplete", "off");
    $("provincia")?.setAttribute("readonly", "readonly");
    $("provincia")?.setAttribute("aria-readonly", "true");
    $("provincia")?.setAttribute("title", "Se completa automáticamente desde el código postal.");

    const panel = document.createElement("section");
    panel.id = "validacion-territorio";
    panel.className = "tm-field full";
    panel.innerHTML = '<label>Comprobación territorial</label><div id="resultado-territorio" role="status" aria-live="polite" style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#667085"><strong>… Comprobando el catálogo territorial de TallerMap…</strong></div>';
    form.insertBefore(panel, form.querySelector(".tm-savebar") || null);

    ["codigo_postal", "ciudad", "provincia"].forEach((id) => {
      $(id)?.addEventListener("input", programarValidacion);
      $(id)?.addEventListener("change", programarValidacion);
    });

    $("codigo_postal")?.addEventListener("input", (evento) => {
      const limpio = evento.target.value.replace(/\D/g, "").slice(0, 5);
      if (evento.target.value !== limpio) evento.target.value = limpio;
      if (limpio.length === 5) sincronizarProvincia();
    });

    document.addEventListener("submit", (evento) => {
      if (evento.target !== form || aprobado) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      validarTerritorio();
      const foco = !/^\d{5}$/.test(valor("codigo_postal")) ? $("codigo_postal") : $("ciudad");
      foco?.focus();
    }, true);

    document.addEventListener("click", (evento) => {
      if (evento.target.closest(".tm-result")) window.setTimeout(programarValidacion, 80);
    }, true);

    document.addEventListener("tallermap:ficha-guardada", validarTerritorio);
    establecerAprobado(false);
    cargarCatalogo();
  }

  window.TallerMapTerritorio = {
    validar: validarTerritorio,
    estaAprobado: () => aprobado
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", construir, { once: true });
  } else {
    construir();
  }
}());
