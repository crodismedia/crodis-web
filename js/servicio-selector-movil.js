(() => {
  const select = document.getElementById("servicio");
  if (!select) return;

  const mobile = window.matchMedia("(max-width: 750px)");
  if (!mobile.matches) return;

  const wrapper = document.createElement("div");
  wrapper.className = "servicio-movil-wrapper";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "servicio-movil-boton";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "servicio-movil-panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;

  select.insertAdjacentElement("afterend", wrapper);
  wrapper.append(button, panel);

  const actualizarBoton = () => {
    const selected = select.options[select.selectedIndex];
    button.textContent = selected?.textContent || "Todos los servicios";
  };

  const construir = () => {
    panel.replaceChildren();

    [...select.children].forEach(node => {
      if (node.tagName === "OPTION") {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "servicio-movil-opcion";
        item.dataset.value = node.value;
        item.textContent = node.textContent;
        panel.appendChild(item);
      }

      if (node.tagName === "OPTGROUP") {
        const title = document.createElement("div");
        title.className = "servicio-movil-categoria";
        title.textContent = node.label;
        panel.appendChild(title);

        [...node.children].forEach(option => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "servicio-movil-opcion servicio-movil-opcion-grupo";
          item.dataset.value = option.value;
          item.textContent = option.textContent;
          panel.appendChild(item);
        });
      }
    });
  };

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
  });

  panel.addEventListener("click", event => {
    const item = event.target.closest(".servicio-movil-opcion");
    if (!item) return;

    select.value = item.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    actualizarBoton();
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("pointerdown", event => {
    if (!wrapper.contains(event.target)) {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });

  const observer = new MutationObserver(() => {
    construir();
    actualizarBoton();
  });

  observer.observe(select, { childList: true, subtree: true });

  construir();
  actualizarBoton();
})();