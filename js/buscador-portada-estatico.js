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
