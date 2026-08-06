(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const supabase = window.supabaseClient;
  const form = $('form-taller');
  const sourceText = $('dato-candidato');
  if (!form || !sourceText) return;

  const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(calle|c\/|avenida|avda\.?|av\.?|carretera|ctra\.?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  function cleanUrl(value) {
    let raw = String(value || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

    try {
      let url = new URL(raw);
      const redirect = url.searchParams.get('url') || url.searchParams.get('q') || url.searchParams.get('u');
      if (redirect && /^https?:\/\//i.test(decodeURIComponent(redirect))) {
        url = new URL(decodeURIComponent(redirect));
      }

      const blockedHosts = /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)facebook\.com$/i;
      if (blockedHosts.test(url.hostname) && !redirect) return raw;

      url.hash = '';
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','ref','source'].forEach((key) => url.searchParams.delete(key));
      url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

      const disposablePaths = /^\/(index\.(html?|php)|inicio|home|contacto|contact|es)?\/?$/i;
      if (disposablePaths.test(url.pathname)) url.pathname = '/';
      url.pathname = url.pathname.replace(/\/{2,}/g, '/');

      const result = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
      return result.replace(/\/$/, '');
    } catch {
      return raw;
    }
  }

  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    const national = digits.startsWith('34') && digits.length === 11 ? digits.slice(2) : digits;
    return national.length === 9 ? `+34 ${national.slice(0,3)} ${national.slice(3,6)} ${national.slice(6)}` : String(value || '').trim();
  }

  function ensureEmailField() {
    if ($('email')) return;
    const webField = $('web')?.closest('.tm-field');
    if (!webField) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'tm-field';
    wrapper.innerHTML = '<label>Correo electrónico</label><input id="email" type="email" autocomplete="email" data-drop="email" placeholder="correo@taller.es">';
    webField.insertAdjacentElement('afterend', wrapper);

    const destination = $('campo-destino');
    if (destination && !destination.querySelector('option[value="email"]')) {
      const option = document.createElement('option');
      option.value = 'email';
      option.textContent = 'Correo electrónico';
      destination.insertBefore(option, destination.querySelector('option[value="direccion"]'));
    }
  }

  function ensureComparisonPanel() {
    if ($('tm-comparison')) return;
    const inspector = document.querySelector('.tm-inspector');
    if (!inspector) return;
    const panel = document.createElement('section');
    panel.id = 'tm-comparison';
    panel.className = 'tm-inspector';
    panel.innerHTML = `
      <div class="tm-inspector-head"><strong>Coincidencia de fichas</strong><strong id="tm-match-score">0 %</strong></div>
      <div id="tm-match-message" class="tm-status">Selecciona una ficha y pega la información de la fuente.</div>
      <div id="tm-match-details" class="tm-inspector-list"></div>`;
    inspector.insertAdjacentElement('beforebegin', panel);
  }

  function similarity(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    if (!a || !b) return 0;
    if (a === b || a.includes(b) || b.includes(a)) return 1;
    const aa = new Set(a.split(' ').filter((x) => x.length > 1));
    const bb = new Set(b.split(' ').filter((x) => x.length > 1));
    const intersection = [...aa].filter((x) => bb.has(x)).length;
    const union = new Set([...aa, ...bb]).size;
    return union ? intersection / union : 0;
  }

  function extractSource(text) {
    const lines = String(text || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const phone = (text.match(/(?:\+34[\s.-]?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/) || [])[0] || '';
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const postal = (text.match(/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/) || [])[0] || '';
    const url = (text.match(/https?:\/\/[^\s<>()]+|www\.[^\s<>()]+/i) || [])[0] || '';
    const name = lines.find((line) => !/@|https?:|www\.|\b\d{5}\b|\b[6789]\d{2}/i.test(line)) || '';
    const address = lines.find((line) => /\b(calle|c\/|avenida|avda|carretera|ctra|plaza|pol[ií]gono|camino|paseo)\b/i.test(line)) || '';
    const cityLine = lines.find((line) => postal && line.includes(postal)) || '';
    const city = cityLine.replace(postal, '').replace(/^[,\s-]+|[,\s-]+$/g, '');
    return { name, address, postal, city, phone, email, web: cleanUrl(url) };
  }

  function updateComparison() {
    ensureComparisonPanel();
    const text = sourceText.value.trim();
    const details = $('tm-match-details');
    const scoreNode = $('tm-match-score');
    const message = $('tm-match-message');
    if (!details || !scoreNode || !message) return;

    if (!$('taller-id')?.value || !text) {
      scoreNode.textContent = '0 %';
      message.textContent = 'Selecciona una ficha y pega la información de la fuente.';
      details.innerHTML = '';
      return;
    }

    const candidate = extractSource(text);
    const checks = [
      ['Nombre', $('nombre')?.value, candidate.name, 35],
      ['Dirección', $('direccion')?.value, candidate.address, 30],
      ['Código postal', $('codigo_postal')?.value, candidate.postal, 20],
      ['Municipio', $('ciudad')?.value, candidate.city, 15]
    ];

    let obtained = 0;
    let available = 0;
    details.innerHTML = checks.map(([label, left, right, weight]) => {
      const comparable = Boolean(String(left || '').trim() && String(right || '').trim());
      const value = comparable ? similarity(left, right) : 0;
      if (comparable) {
        available += weight;
        obtained += weight * value;
      }
      const state = !comparable ? 'Sin dato comparable' : value >= .85 ? 'Coincide' : value >= .55 ? 'Parecido' : 'Diferente';
      return `<div class="tm-suggestion"><div><small>${label} · ${state}</small><span>${String(right || 'No detectado').replace(/[<>]/g, '')}</span></div><strong>${comparable ? Math.round(value * 100) + ' %' : '—'}</strong></div>`;
    }).join('');

    const score = available ? Math.round((obtained / available) * 100) : 0;
    scoreNode.textContent = `${score} %`;
    message.textContent = score >= 90 ? 'Coincidencia muy alta: probablemente es el mismo taller.' : score >= 70 ? 'Coincidencia razonable: revisa las diferencias antes de copiar.' : 'Coincidencia baja o datos insuficientes: comprueba la fuente.';
  }

  function addDetectedEmail() {
    const text = sourceText.value;
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0];
    if (!email || !$('inspector-resultados') || $('tm-email-suggestion')) return;
    const card = document.createElement('article');
    card.id = 'tm-email-suggestion';
    card.className = 'tm-suggestion';
    card.innerHTML = `<div><small>Correo electrónico · ${$('email')?.value ? 'Revisar' : 'Campo vacío'}</small><span>${email.toLowerCase()}</span><small>Actual: ${$('email')?.value || 'vacío'}</small></div><button type="button" class="tm-btn tm-btn-soft">Usar</button>`;
    card.querySelector('button').addEventListener('click', () => {
      $('email').value = email.toLowerCase();
      $('email').dispatchEvent(new Event('input', { bubbles: true }));
      updateComparison();
    });
    $('inspector-resultados').prepend(card);
  }

  async function loadEmail() {
    const id = $('taller-id')?.value;
    if (!id || !supabase || !$('email')) return;
    const { data, error } = await supabase.from('talleres').select('email').eq('id', id).maybeSingle();
    if (!error) $('email').value = data?.email || '';
  }

  async function saveEnrichment() {
    const id = $('taller-id')?.value;
    if (!id || !supabase) return;
    const web = cleanUrl($('web')?.value);
    const email = String($('email')?.value || '').trim().toLowerCase();
    const phone = normalizePhone($('telefono')?.value);
    if ($('web')) $('web').value = web;
    if ($('telefono')) $('telefono').value = phone;
    await supabase.from('talleres').update({ web, email, telefono: phone }).eq('id', id);
  }

  ensureEmailField();
  ensureComparisonPanel();

  sourceText.addEventListener('input', () => {
    document.getElementById('tm-email-suggestion')?.remove();
    updateComparison();
  });
  $('btn-analizar')?.addEventListener('click', () => setTimeout(() => { addDetectedEmail(); updateComparison(); }, 0));
  $('btn-pegar-candidato')?.addEventListener('click', () => setTimeout(() => { addDetectedEmail(); updateComparison(); }, 150));
  $('inspector-resultados')?.addEventListener('click', () => setTimeout(() => {
    if ($('web')) $('web').value = cleanUrl($('web').value);
    updateComparison();
  }, 0));

  $('web')?.addEventListener('blur', (event) => { event.target.value = cleanUrl(event.target.value); });
  $('telefono')?.addEventListener('blur', (event) => { event.target.value = normalizePhone(event.target.value); });
  form.addEventListener('submit', () => {
    if ($('web')) $('web').value = cleanUrl($('web').value);
    setTimeout(saveEnrichment, 150);
  }, true);

  $('resultados-talleres')?.addEventListener('click', () => setTimeout(async () => {
    await loadEmail();
    updateComparison();
  }, 80));

  ['nombre','direccion','codigo_postal','ciudad','telefono','web','email'].forEach((id) => {
    $(id)?.addEventListener('input', updateComparison);
  });
}());
