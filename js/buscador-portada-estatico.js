(() => {
  "use strict";

  const form = document.getElementById("formulario-buscador-publico");
  const input = document.getElementById("poblacion");
  const service = document.getElementById("servicio");
  const controls = input?.closest(".poblacion-controles");
  const status = document.getElementById("estado-buscador-portada");
  const catalog = Array.isArray(window.TallerMapMunicipiosEstaticos)
    ? window.TallerMapMunicipiosEstaticos
    : [];

  if (!form || !input || !service || !controls || !catalog.length) return;

  const serviceGroups = [
    ["Mecánica y mantenimiento", [
      ["mecanica-general", "Mecánica general"],
      ["mantenimiento-programado", "Revisión y mantenimiento programado"],
      ["cambio-aceite-filtros", "Cambio de aceite y filtros"],
      ["pre-itv", "Revisión Pre-ITV"],
      ["frenos", "Frenos"],
      ["embrague", "Embrague"],
      ["correa-distribucion", "Correa de distribución"],
      ["cadena-distribucion", "Cadena de distribución"],
      ["reparacion-motor", "Reparación de motor"],
      ["sistema-refrigeracion", "Sistema de refrigeración"],
      ["escape-catalizador", "Escape y catalizador"],
      ["caja-cambios", "Caja de cambios"],
      ["filtro-particulas-dpf-fap", "Filtro de partículas DPF/FAP"],
      ["turbo", "Turbo"],
      ["inyeccion-diesel", "Inyección diésel"],
      ["inyeccion-gasolina", "Inyección gasolina"],
      ["descarbonizacion-motor", "Descarbonización de motor"],
      ["caja-cambios-automatica-dsg", "Caja de cambios automática / DSG"],
      ["sistema-scr-adblue", "Sistema SCR / AdBlue"],
      ["mantenimiento-flotas", "Mantenimiento de flotas"],
      ["mecanica-rapida", "Mecánica rápida"]
    ]],
    ["Neumáticos, dirección y suspensión", [
      ["neumaticos", "Neumáticos"],
      ["alineacion-direccion", "Alineación y dirección"],
      ["equilibrado-ruedas", "Equilibrado de ruedas"],
      ["suspension-amortiguadores", "Suspensión y amortiguadores"],
      ["direccion", "Sistema de dirección"],
      ["reparacion-llantas", "Reparación de llantas"]
    ]],
    ["Electricidad y diagnosis", [
      ["diagnosis-electronica", "Diagnosis electrónica"],
      ["electricidad-automovil", "Electricidad del automóvil"],
      ["baterias", "Baterías"],
      ["alternador-motor-arranque", "Alternador y motor de arranque"],
      ["centralitas-electronica", "Centralitas y electrónica"],
      ["sistemas-adas", "Sistemas ADAS y ayudas a la conducción"],
      ["llaves-codificacion", "Llaves y codificación"],
      ["reprogramacion-centralita", "Reprogramación de centralita"],
      ["tacografo", "Tacógrafo"]
    ]],
    ["Carrocería y cristales", [
      ["chapa-pintura", "Chapa y pintura"],
      ["carroceria", "Reparación de carrocería"],
      ["lunas-cristales", "Lunas y cristales"],
      ["desabollado-sin-pintura", "Desabollado sin pintura"],
      ["tapiceria", "Tapicería"],
      ["tintado-lunas", "Tintado de lunas"],
      ["pulido-restauracion-faros", "Pulido y restauración de faros"]
    ]],
    ["Climatización", [
      ["aire-acondicionado", "Aire acondicionado"],
      ["calefaccion-climatizacion", "Calefacción y climatización"]
    ]],
    ["Híbridos y eléctricos", [
      ["hibridos-electricos", "Vehículos híbridos y eléctricos"],
      ["baterias-alta-tension", "Baterías de alta tensión"],
      ["cargadores-vehiculo-electrico", "Cargadores para vehículo eléctrico"]
    ]],
    ["Vehículos especiales", [
      ["furgonetas", "Furgonetas"],
      ["vehiculos-industriales", "Vehículos industriales"],
      ["autocaravanas", "Autocaravanas"],
      ["vehiculos-4x4", "Vehículos 4x4"],
      ["motocicletas", "Motocicletas"],
      ["vehiculos-clasicos", "Vehículos clásicos"]
    ]],
    ["Personalización y multimedia", [
      ["equipos-sonido", "Equipos de sonido y audio para automóvil"],
      ["multimedia-navegacion", "Pantallas, multimedia y navegación"],
      ["vinilos-rotulacion", "Vinilos y rotulación"],
      ["wrapping", "Wrapping integral y cambio de color"],
      ["tuning-personalizacion", "Tuning y personalización"],
      ["iluminacion-automovil", "Iluminación y sistemas LED"]
    ]],
    ["Otros servicios", [
      ["grua-asistencia", "Grúa y asistencia en carretera"],
      ["lavado-detailing", "Lavado y detailing"],
      ["montaje-accesorios", "Montaje de accesorios"],
      ["homologaciones", "Homologaciones"],
      ["instalacion-glp", "Instalación y mantenimiento GLP"],
      ["recogida-entrega", "Recogida y entrega del vehículo"],
      ["gestion-traslado-itv", "Gestión y traslado a ITV"]
    ]],
    ["Concesionario y compraventa", [
      ["venta-vehiculos-nuevos", "Venta de vehículos nuevos"],
      ["venta-vehiculos-ocasion", "Venta de vehículos de ocasión"],
      ["recambios-originales", "Recambios originales"],
      ["garantia-oficial", "Garantía oficial y campañas de marca"],
      ["vehiculo-sustitucion", "Vehículo de sustitución"],
      ["tasacion-vehiculos", "Tasación de vehículos"]
    ]]
  ];

  const populateServiceSelect = () => {
    const previous = service.value;
    service.replaceChildren(new Option("Todos los servicios", ""));
    serviceGroups.forEach(([label, items]) => {
      const group = document.createElement("optgroup");
      group.label = label;
      items.forEach(([value, text]) => group.appendChild(new Option(text, value)));
      service.appendChild(group);
    });
    if (previous && [...service.options].some(option => option.value === previous)) {
      service.value = previous;
    }
  };

  populateServiceSelect();

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const province = code => ({
    "03": "Alicante / Alacant",
    "12": "Castellón / Castelló",
    "46": "Valencia / València"
  }[String(code || "").slice(0, 2)] || "Comunidad Valenciana");

  const prepared = catalog.map(item => ({
    ...item,
    searchName: normalize(item.nombre),
    aliases: String(item.nombre || "").split("/").map(normalize).filter(Boolean),
    postales: Array.isArray(item.postales) ? item.postales : []
  }));

  let suggestions = document.getElementById("sugerencias-poblacion");
  if (!suggestions) {
    suggestions = document.createElement("div");
    suggestions.id = "sugerencias-poblacion";
    suggestions.setAttribute("role", "listbox");
    suggestions.setAttribute("aria-label", "Sugerencias de población");
    suggestions.hidden = true;
    controls.appendChild(suggestions);
  }

  let locationButton = document.getElementById("usar-mi-ubicacion");
  if (!locationButton) {
    locationButton = document.createElement("button");
    locationButton.type = "button";
    locationButton.id = "usar-mi-ubicacion";
    locationButton.className = "boton";
    locationButton.textContent = "Usar mi ubicación";
    controls.appendChild(locationButton);
  }

  let locationStatus = document.getElementById("estado-ubicacion");
  if (!locationStatus) {
    locationStatus = document.createElement("small");
    locationStatus.id = "estado-ubicacion";
    locationStatus.setAttribute("aria-live", "polite");
    controls.appendChild(locationStatus);
  }

  const setStatus = (message, showDirectoryLink = false) => {
    if (!status) return;
    status.replaceChildren(document.createTextNode(message));
    if (showDirectoryLink) {
      status.append(document.createTextNode(" "));
      const link = document.createElement("a");
      link.href = "/municipios/";
      link.textContent = "Ver todos los municipios";
      status.appendChild(link);
    }
    status.hidden = !message;
  };

  const closeSuggestions = () => {
    suggestions.replaceChildren();
    suggestions.hidden = true;
    input.setAttribute("aria-expanded", "false");
  };

  const destination = item => {
    const url = new URL(item.ruta, window.location.origin);
    if (service.value) url.searchParams.set("servicio", service.value);
    url.hash = "talleres";
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const selectMunicipality = item => {
    input.value = item.nombre;
    input.dataset.rutaMunicipio = item.ruta;
    closeSuggestions();
    setStatus(`Población seleccionada: ${item.nombre}.`);
    input.focus();
  };

  const matching = rawTerm => {
    const term = normalize(rawTerm);
    if (!term) return [];
    const digits = String(rawTerm || "").replace(/\D/g, "");

    return prepared.filter(item =>
      item.searchName.includes(term)
      || item.aliases.some(alias => alias.includes(term))
      || (digits.length === 5 && item.postales.includes(digits))
    );
  };

  const exactMatching = rawTerm => {
    const term = normalize(rawTerm);
    const digits = String(rawTerm || "").replace(/\D/g, "");

    return prepared.filter(item =>
      item.searchName === term
      || item.aliases.includes(term)
      || (digits.length === 5 && item.postales.includes(digits))
    );
  };

  const renderSuggestions = items => {
    suggestions.replaceChildren();
    if (!items.length) {
      closeSuggestions();
      return;
    }

    items.slice(0, 8).forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sugerencia-poblacion";
      button.setAttribute("role", "option");

      const name = document.createElement("strong");
      name.textContent = item.nombre;
      const detail = document.createElement("span");
      const postales = item.postales.length ? ` · CP ${item.postales.join(", ")}` : "";
      detail.textContent = `${province(item.codigo)}${postales}`;

      button.append(name, detail);
      button.addEventListener("pointerdown", event => event.preventDefault());
      button.addEventListener("click", () => selectMunicipality(item));
      suggestions.appendChild(button);
    });

    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const locateMunicipality = () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = "Este navegador no permite obtener la ubicación.";
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = "Localizando…";
    locationStatus.textContent = "Buscando tu ubicación…";

    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const accuracy = Number(position.coords.accuracy);

        if (!Number.isFinite(accuracy) || accuracy > 1000) {
          locationStatus.textContent = "Tu ubicación es aproximada. Selecciona tu población o escribe el código postal.";
          setStatus("No podemos determinar tu municipio con suficiente precisión.");
          return;
        }

        const params = new URLSearchParams({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
          localityLanguage: "es"
        });
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("No se pudo identificar la población");
        const place = await response.json();
        const locality = String(place.locality || place.city || "").trim();
        const postcode = String(place.postcode || "").match(/\b\d{5}\b/)?.[0] || "";
        const candidates = locality ? exactMatching(locality) : [];
        const postcodeCandidates = postcode ? exactMatching(postcode) : [];
        const matches = candidates.length === 1 ? candidates : postcodeCandidates;

        if (matches.length !== 1) {
          if (locality) {
            input.value = locality;
            renderSuggestions(matching(locality));
          }
          throw new Error("La ubicación se obtuvo, pero no se pudo asociar a un único municipio de TallerMap");
        }

        input.value = matches[0].nombre;
        input.dataset.rutaMunicipio = matches[0].ruta;
        locationStatus.textContent = `Ubicación detectada: ${matches[0].nombre}.`;
        setStatus(`Abriendo talleres de ${matches[0].nombre}.`);
        window.location.assign(destination(matches[0]));
      } catch (error) {
        console.error("Ubicación TallerMap:", error);
        locationStatus.textContent = "No se pudo identificar tu municipio. Puedes escribir la población o el código postal.";
      } finally {
        locationButton.disabled = false;
        locationButton.textContent = "Usar mi ubicación";
      }
    }, () => {
      locationButton.disabled = false;
      locationButton.textContent = "Usar mi ubicación";
      locationStatus.textContent = "No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.";
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    });
  };

  locationButton.addEventListener("click", locateMunicipality);

  input.addEventListener("input", () => {
    delete input.dataset.rutaMunicipio;
    setStatus("");
    const term = normalize(input.value);
    if (term.length < 2) return closeSuggestions();
    renderSuggestions(matching(input.value));
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSuggestions();
    if (event.key !== "ArrowDown" || suggestions.hidden) return;
    event.preventDefault();
    suggestions.querySelector("button")?.focus();
  });

  suggestions.addEventListener("keydown", event => {
    const buttons = [...suggestions.querySelectorAll("button")];
    const current = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      buttons[Math.max(0, Math.min(buttons.length - 1, current + offset))]?.focus();
    }
    if (event.key === "Escape") {
      closeSuggestions();
      input.focus();
    }
  });

  document.addEventListener("pointerdown", event => {
    if (!controls.contains(event.target)) closeSuggestions();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const term = input.value.trim();

    if (!term) {
      window.location.assign(service.value
        ? `/servicios/${encodeURIComponent(service.value)}.html`
        : "/municipios/");
      return;
    }

    const selected = prepared.find(item => item.ruta === input.dataset.rutaMunicipio);
    const exact = selected ? [selected] : exactMatching(term);

    if (exact.length === 1) {
      window.location.assign(destination(exact[0]));
      return;
    }

    const candidates = exact.length ? exact : matching(term);
    if (candidates.length === 1) {
      window.location.assign(destination(candidates[0]));
      return;
    }
    renderSuggestions(candidates);
    setStatus(
      candidates.length
        ? "Selecciona una población de la lista para abrir su página estática."
        : "No encontramos esa población o código postal.",
      !candidates.length
    );
  });
})();
