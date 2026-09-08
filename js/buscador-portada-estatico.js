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
