(() => {
  const form = document.getElementById('buscador-municipio');
  const select = document.getElementById('servicio');
  const list = document.getElementById('lista-talleres');
  if (!form || !select || !list) return;

  const slugify = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const options = Array.from(select.options);
  const wrapper = document.createElement('div');
  wrapper.className = 'servicio-personalizado';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'servicio-personalizado-boton';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'servicio-personalizado-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const setValue = (value, close = true) => {
    select.value = value;
    const selected = options.find(option => option.value === value) || options[0];
    button.textContent = selected?.textContent || 'Todos los servicios';
    menu.querySelectorAll('[role="option"]').forEach(item => {
      const active = item.dataset.value === select.value;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.classList.toggle('seleccionado', active);
    });
    if (close) {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  };

  options.forEach(option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'servicio-personalizado-opcion';
    item.setAttribute('role', 'option');
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.addEventListener('click', () => {
      setValue(option.value);
      button.focus();
    });
    menu.appendChild(item);
  });

  button.addEventListener('click', () => {
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    }
  });

  select.classList.add('select-nativo-oculto');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.insertAdjacentElement('afterend', wrapper);
  wrapper.append(button, menu);

  const cards = Array.from(list.querySelectorAll('.taller-card'));
  const counter = document.querySelector('.orden-talleres.mapa-estado');

  const cardServices = card => Array.from(card.querySelectorAll('.especialidades span'))
    .map(span => slugify(span.textContent));

  const applyFilter = (updateUrl = true) => {
    const service = select.value;
    let visible = 0;

    cards.forEach(card => {
      const matches = !service || cardServices(card).includes(service);
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (counter) {
      counter.textContent = `${visible} ${visible === 1 ? 'taller publicado' : 'talleres publicados'}`;
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (service) url.searchParams.set('servicio', service);
      else url.searchParams.delete('servicio');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    applyFilter(true);
    document.getElementById('talleres')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const initial = new URLSearchParams(window.location.search).get('servicio') || '';
  setValue(options.some(option => option.value === initial) ? initial : '', false);
  if (initial) applyFilter(false);
})();