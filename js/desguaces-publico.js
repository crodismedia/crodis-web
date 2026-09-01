(function () {
  'use strict';

  const secciones = {
    alicante: document.getElementById('alicante'),
    castellon: document.getElementById('castellon'),
    valencia: document.getElementById('valencia')
  };

  const contenedores = {
    alicante: document.getElementById('lista-desguaces-alicante'),
    castellon: document.getElementById('lista-desguaces-castellon'),
    valencia: document.getElementById('lista-desguaces-valencia')
  };

  const nombresProvincia = {
    alicante: 'Alicante',
    castellon: 'Castellón',
    valencia: 'Valencia'
  };

  const botonesProvincia = Array.from(document.querySelectorAll('.selector-provincia'));
  const cache = new Map();

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

  function provinciaDesdeHash() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(secciones, hash) ? hash : '';
  }

  function mostrarSoloProvincia(provincia) {
    Object.entries(secciones).forEach(([clave, seccion]) => {
      if (seccion) seccion.hidden = clave !== provincia;
    });
    botonesProvincia.forEach(boton => {
      const activa = boton.getAttribute('href') === `#${provincia}`;
      if (activa) boton.setAttribute('aria-current', 'true');
      else boton.removeAttribute('aria-current');
    });
  }

  function aplicarFiltroConsulta(query, provincia) {
    if (provincia === 'alicante') {
      return query.or('provincia.ilike.%Alicante%,provincia.ilike.%Alacant%');
    }
    if (provincia === 'castellon') {
      return query.or('provincia.ilike.%Castellón%,provincia.ilike.%Castelló%,provincia.ilike.%Castellon%');
    }
    return query.or('provincia.ilike.%Valencia%,provincia.ilike.%València%');
  }

  async function cargarProvincia(provincia, hacerScroll) {
    if (!provincia || !secciones[provincia]) return;

    mostrarSoloProvincia(provincia);
    const contenedor = contenedores[provincia];
    if (!contenedor) return;

    if (cache.has(provincia)) {
      const filas = cache.get(provincia);
      contenedor.innerHTML = filas.length
        ? filas.map(tarjeta).join('')
        : '<p class="desguaces-estado">No hay desguaces publicados en esta provincia.</p>';
      if (hacerScroll) secciones[provincia].scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const sb = window.supabaseClient;
    if (!sb) {
      contenedor.innerHTML = '<p class="desguaces-estado desguaces-error">No se pudo conectar con el directorio de desguaces.</p>';
      return;
    }

    contenedor.innerHTML = `<p class="desguaces-estado">Buscando desguaces en ${esc(nombresProvincia[provincia])}…</p>`;

    let query = sb
      .from('desguaces')
      .select('id,nombre,slug,direccion,codigo_postal,municipio,provincia,telefono,web,google_maps_url,servicios,descripcion,activo,verificado,updated_at')
      .eq('activo', true)
      .eq('verificado', true)
      .order('municipio', { ascending: true })
      .order('nombre', { ascending: true });

    query = aplicarFiltroConsulta(query, provincia);
    const { data, error } = await query;

    if (error) {
      console.error(`No se pudieron cargar los desguaces de ${provincia}:`, error);
      contenedor.innerHTML = '<p class="desguaces-estado desguaces-error">No se pudieron cargar los desguaces. Vuelve a intentarlo.</p>';
      return;
    }

    const filas = Array.isArray(data) ? data : [];
    cache.set(provincia, filas);
    contenedor.innerHTML = filas.length
      ? filas.map(tarjeta).join('')
      : '<p class="desguaces-estado">No hay desguaces publicados en esta provincia.</p>';

    const contador = document.getElementById('contador-desguaces-publicados');
    if (contador) contador.textContent = `${filas.length.toLocaleString('es-ES')} ${filas.length === 1 ? 'desguace' : 'desguaces'} en ${nombresProvincia[provincia]}`;

    if (hacerScroll) secciones[provincia].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function iniciar() {
    botonesProvincia.forEach(boton => {
      boton.addEventListener('click', evento => {
        const provincia = boton.getAttribute('href').replace('#', '').toLowerCase();
        if (!secciones[provincia]) return;
        evento.preventDefault();
        history.replaceState(null, '', `#${provincia}`);
        cargarProvincia(provincia, true);
      });
    });

    const inicial = provinciaDesdeHash();
    if (inicial) cargarProvincia(inicial, false);

    window.addEventListener('hashchange', () => {
      const provincia = provinciaDesdeHash();
      if (provincia) cargarProvincia(provincia, false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
}());
