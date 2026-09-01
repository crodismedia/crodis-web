(function () {
  'use strict';

  const sb = window.supabaseClient;
  if (!sb) {
    console.error('No se pudo iniciar Supabase para el directorio de desguaces.');
    return;
  }

  const grupos = {
    'Alicante/Alacant': document.getElementById('lista-desguaces-alicante'),
    'Castellón/Castelló': document.getElementById('lista-desguaces-castellon'),
    'Valencia/València': document.getElementById('lista-desguaces-valencia')
  };

  const secciones = {
    alicante: document.getElementById('alicante'),
    castellon: document.getElementById('castellon'),
    valencia: document.getElementById('valencia')
  };

  const provinciaPorClave = {
    alicante: 'Alicante/Alacant',
    castellon: 'Castellón/Castelló',
    valencia: 'Valencia/València'
  };

  const aliasProvincia = new Map([
    ['alicante', 'Alicante/Alacant'],
    ['alacant', 'Alicante/Alacant'],
    ['alicante/alacant', 'Alicante/Alacant'],
    ['castellon', 'Castellón/Castelló'],
    ['castelló', 'Castellón/Castelló'],
    ['castello', 'Castellón/Castelló'],
    ['castellón/castelló', 'Castellón/Castelló'],
    ['castellon/castello', 'Castellón/Castelló'],
    ['valencia', 'Valencia/València'],
    ['valència', 'Valencia/València'],
    ['valencia/valència', 'Valencia/València'],
    ['valencia/valencia', 'Valencia/València']
  ]);

  let datosPorProvincia = new Map(Object.keys(grupos).map(p => [p, []]));

  function normalizarTexto(valor) {
    return String(valor || '').trim().toLowerCase();
  }

  function provinciaCanonica(valor) {
    return aliasProvincia.get(normalizarTexto(valor)) || String(valor || '').trim();
  }

  function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function urlSegura(valor) {
    if (!valor) return '';
    try {
      const u = new URL(String(valor));
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  }

  function telefonoHref(valor) {
    const limpio = String(valor || '').replace(/[^+\d]/g, '');
    return limpio ? `tel:${limpio}` : '';
  }

  function slugSeguro(valor) {
    const slug = String(valor || '').trim().toLowerCase();
    return /^[a-z0-9-]+$/.test(slug) ? slug : '';
  }

  function tarjeta(d) {
    const direccion = [d.direccion, d.codigo_postal, d.municipio].filter(Boolean).join(', ');
    const telefono = String(d.telefono || '').trim();
    const web = urlSegura(d.web);
    const maps = urlSegura(d.google_maps_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.nombre, direccion, d.provincia].filter(Boolean).join(', '))}`;
    const servicios = Array.isArray(d.servicios) ? d.servicios.filter(Boolean).slice(0, 5) : [];
    const slug = slugSeguro(d.slug);
    const fichaUrl = slug ? `/desguace/${esc(slug)}` : '';
    const accesoSolicitud = d.id ? `/api/desguaces-solicitar-acceso?id=${encodeURIComponent(d.id)}` : '';
    const nombre = esc(d.nombre || 'Desguace');
    const nombreHtml = fichaUrl
      ? `<a href="${fichaUrl}" style="color:inherit;text-decoration:none">${nombre}</a>`
      : nombre;

    return `<article class="desguace-card">
      <div class="desguace-card-cabecera">
        <div>
          <p class="desguace-localidad">${esc(d.municipio || '')}</p>
          <h3>${nombreHtml}</h3>
        </div>
        <span class="desguace-verificado">Verificado</span>
      </div>
      ${direccion ? `<p class="desguace-direccion">${esc(direccion)}</p>` : ''}
      ${d.descripcion ? `<p class="desguace-descripcion">${esc(d.descripcion)}</p>` : ''}
      ${servicios.length ? `<div class="desguace-servicios">${servicios.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      <div class="desguace-acciones">
        ${fichaUrl ? `<a href="${fichaUrl}">Ver ficha</a>` : ''}
        ${telefono ? `<a href="${esc(telefonoHref(telefono))}">Llamar · ${esc(telefono)}</a>` : ''}
        <a href="${esc(maps)}" target="_blank" rel="noopener">Cómo llegar</a>
        ${web ? `<a href="${esc(web)}" target="_blank" rel="noopener">Web</a>` : ''}
        <a href="/acceso-desguaces.html">Acceso profesional</a>
        ${accesoSolicitud ? `<a href="${esc(accesoSolicitud)}">Solicitar acceso</a>` : ''}
      </div>
    </article>`;
  }

  function estadoInicial() {
    Object.values(grupos).forEach(c => {
      if (c) c.innerHTML = '<p class="desguaces-estado">Cargando desguaces publicados…</p>';
    });
  }

  function mostrarProvincia(clave, hacerScroll = true) {
    if (!provinciaPorClave[clave]) return;

    Object.entries(secciones).forEach(([nombre, seccion]) => {
      if (seccion) seccion.hidden = nombre !== clave;
    });

    document.querySelectorAll('.selector-provincia').forEach(boton => {
      const activa = boton.getAttribute('href') === `#${clave}`;
      boton.setAttribute('aria-current', activa ? 'true' : 'false');
    });

    const provincia = provinciaPorClave[clave];
    const total = (datosPorProvincia.get(provincia) || []).length;
    const contador = document.getElementById('contador-desguaces-publicados');
    if (contador) contador.textContent = `${total.toLocaleString('es-ES')} ${total === 1 ? 'desguace publicado' : 'desguaces publicados'} en ${provincia.split('/')[0]}`;

    if (window.location.hash !== `#${clave}`) {
      history.replaceState(null, '', `#${clave}`);
    }

    if (hacerScroll && secciones[clave]) {
      secciones[clave].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function activarBotones() {
    document.querySelectorAll('.selector-provincia').forEach(boton => {
      boton.addEventListener('click', evento => {
        const clave = boton.getAttribute('href').replace('#', '');
        if (!provinciaPorClave[clave]) return;
        evento.preventDefault();
        mostrarProvincia(clave, true);
      });
    });
  }

  async function cargar() {
    estadoInicial();

    const { data, error } = await sb
      .from('desguaces')
      .select('id,nombre,slug,direccion,codigo_postal,municipio,provincia,telefono,web,google_maps_url,servicios,descripcion,activo,verificado,updated_at')
      .eq('activo', true)
      .eq('verificado', true)
      .order('municipio', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('No se pudieron cargar los desguaces públicos:', error);
      Object.values(grupos).forEach(c => {
        if (c) c.innerHTML = '<p class="desguaces-estado desguaces-error">No se pudieron cargar los desguaces. Vuelve a intentarlo.</p>';
      });
      return;
    }

    datosPorProvincia = new Map(Object.keys(grupos).map(p => [p, []]));
    (data || []).forEach(d => {
      const provincia = provinciaCanonica(d.provincia);
      if (datosPorProvincia.has(provincia)) datosPorProvincia.get(provincia).push(d);
    });

    Object.entries(grupos).forEach(([provincia, contenedor]) => {
      if (!contenedor) return;
      const filas = datosPorProvincia.get(provincia) || [];
      contenedor.innerHTML = filas.length
        ? filas.map(tarjeta).join('')
        : '<p class="desguaces-estado">Todavía no hay desguaces verificados publicados en esta provincia.</p>';
    });

    const hashInicial = window.location.hash.replace('#', '').toLowerCase();
    const claveInicial = provinciaPorClave[hashInicial] ? hashInicial : 'alicante';
    mostrarProvincia(claveInicial, false);
  }

  function iniciar() {
    activarBotones();
    cargar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
}());
