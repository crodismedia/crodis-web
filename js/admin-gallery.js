(function(){
  'use strict';

  const supabase = window.supabaseClient;
  const BUCKET = 'fotos-talleres';
  const MAX_FOTOS = 5;
  const MAX_BYTES = 5 * 1024 * 1024;
  const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
  let pendientes = [];
  let existentes = [];
  let tallerActual = '';

  const $ = (id) => document.getElementById(id);

  function mensaje(texto, ok = false) {
    const nodo = $('estado-galeria');
    if (!nodo) return;
    nodo.textContent = texto;
    nodo.style.color = ok ? '#15803d' : '#667085';
  }

  function escapar(valor) {
    return String(valor || '').replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function limpiarNombre(nombre) {
    return String(nombre || 'foto')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 70) || 'foto';
  }

  function construirInterfaz() {
    const form = $('form-taller');
    if (!form || $('galeria-admin')) return;
    const bloque = document.createElement('section');
    bloque.id = 'galeria-admin';
    bloque.className = 'tm-field full';
    bloque.innerHTML = `
      <label>Fotografías <span id="contador-galeria">0/${MAX_FOTOS}</span></label>
      <div id="zona-fotos" tabindex="0" role="button" aria-label="Añadir fotografías" style="border:2px dashed #94a3b8;border-radius:14px;padding:18px;text-align:center;background:#f8fafc;cursor:pointer">
        <strong>Arrastra imágenes aquí</strong><br>
        <small>o pulsa para elegir desde ordenador, móvil o tablet · JPG, PNG o WebP · máximo 5 MB</small>
      </div>
      <input id="selector-fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
      <div id="lista-fotos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="subir-fotos" type="button" class="tm-btn tm-btn-primary">Subir imágenes pendientes</button>
        <button id="descartar-fotos" type="button" class="tm-btn tm-btn-soft">Descartar pendientes</button>
      </div>
      <p id="estado-galeria" class="tm-status">Selecciona un taller para gestionar sus fotografías.</p>`;
    const savebar = form.querySelector('.tm-savebar');
    form.insertBefore(bloque, savebar || null);
    conectarEventos();
  }

  async function urlFirmada(ruta) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 900);
    return error ? '' : data.signedUrl;
  }

  async function cargarExistentes() {
    tallerActual = $('taller-id')?.value || '';
    pendientes.forEach((x) => URL.revokeObjectURL(x.preview));
    pendientes = [];
    existentes = [];
    if (!tallerActual || !supabase) { renderizar(); return; }
    mensaje('Cargando fotografías…');
    const { data, error } = await supabase.from('talleres').select('fotos').eq('id', tallerActual).single();
    if (error) { mensaje(`No se pudieron cargar las fotografías: ${error.message}`); renderizar(); return; }
    const rutas = Array.isArray(data?.fotos) ? data.fotos.slice(0, MAX_FOTOS) : [];
    existentes = await Promise.all(rutas.map(async (ruta, indice) => ({ ruta, principal: indice === 0, url: await urlFirmada(ruta) })));
    mensaje(rutas.length ? `${rutas.length} fotografía${rutas.length === 1 ? '' : 's'} guardada${rutas.length === 1 ? '' : 's'}.` : 'Este taller todavía no tiene fotografías.', true);
    renderizar();
  }

  function validarArchivos(archivos) {
    const aceptados = [];
    for (const file of archivos) {
      if (!TIPOS.has(file.type)) { mensaje(`Formato no permitido: ${file.name}`); continue; }
      if (file.size > MAX_BYTES) { mensaje(`La imagen ${file.name} supera 5 MB.`); continue; }
      if (existentes.length + pendientes.length + aceptados.length >= MAX_FOTOS) { mensaje(`Solo se permiten ${MAX_FOTOS} fotografías por taller.`); break; }
      aceptados.push({ file, preview: URL.createObjectURL(file), principal: existentes.length === 0 && pendientes.length === 0 && aceptados.length === 0 });
    }
    pendientes.push(...aceptados);
    renderizar();
    if (aceptados.length) mensaje(`${aceptados.length} imagen${aceptados.length === 1 ? '' : 'es'} preparada${aceptados.length === 1 ? '' : 's'} para subir.`, true);
  }

  function marcarPrincipal(tipo, indice) {
    existentes.forEach((x) => x.principal = false);
    pendientes.forEach((x) => x.principal = false);
    (tipo === 'existente' ? existentes : pendientes)[indice].principal = true;
    renderizar();
  }

  function renderizar() {
    const lista = $('lista-fotos');
    if (!lista) return;
    $('contador-galeria').textContent = `${existentes.length + pendientes.length}/${MAX_FOTOS}`;
    const guardadas = existentes.map((foto, i) => `
      <article style="border:1px solid #dfe3e8;border-radius:12px;padding:8px;background:#fff">
        <img src="${escapar(foto.url)}" alt="Fotografía guardada" style="width:100%;height:110px;object-fit:cover;border-radius:8px;background:#eef2f7">
        <label style="display:flex;gap:6px;align-items:center;margin-top:7px"><input type="radio" name="foto-principal" data-principal-existente="${i}" ${foto.principal ? 'checked' : ''}> Principal</label>
        <button type="button" class="tm-btn tm-btn-soft" data-eliminar-existente="${i}" style="width:100%;margin-top:6px">Eliminar</button>
      </article>`).join('');
    const nuevas = pendientes.map((foto, i) => `
      <article style="border:1px solid #93c5fd;border-radius:12px;padding:8px;background:#eff6ff">
        <img src="${escapar(foto.preview)}" alt="Vista previa" style="width:100%;height:110px;object-fit:cover;border-radius:8px">
        <small style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(foto.file.name)}</small>
        <label style="display:flex;gap:6px;align-items:center;margin-top:7px"><input type="radio" name="foto-principal" data-principal-pendiente="${i}" ${foto.principal ? 'checked' : ''}> Principal</label>
        <button type="button" class="tm-btn tm-btn-soft" data-quitar-pendiente="${i}" style="width:100%;margin-top:6px">Descartar</button>
      </article>`).join('');
    lista.innerHTML = guardadas + nuevas || '<p class="tm-empty">No hay fotografías.</p>';
    lista.querySelectorAll('[data-principal-existente]').forEach((n) => n.addEventListener('change', () => marcarPrincipal('existente', Number(n.dataset.principalExistente))));
    lista.querySelectorAll('[data-principal-pendiente]').forEach((n) => n.addEventListener('change', () => marcarPrincipal('pendiente', Number(n.dataset.principalPendiente))));
    lista.querySelectorAll('[data-quitar-pendiente]').forEach((n) => n.addEventListener('click', () => { const i = Number(n.dataset.quitarPendiente); URL.revokeObjectURL(pendientes[i].preview); pendientes.splice(i, 1); renderizar(); }));
    lista.querySelectorAll('[data-eliminar-existente]').forEach((n) => n.addEventListener('click', () => eliminarExistente(Number(n.dataset.eliminarExistente))));
  }

  async function eliminarExistente(indice) {
    if (!tallerActual || !window.confirm('¿Eliminar esta fotografía de la ficha y de Storage?')) return;
    const foto = existentes[indice];
    const nuevasRutas = existentes.filter((_, i) => i !== indice).map((x) => x.ruta);
    const { error: dbError } = await supabase.from('talleres').update({ fotos: nuevasRutas }).eq('id', tallerActual);
    if (dbError) { mensaje(`No se pudo actualizar la ficha: ${dbError.message}`); return; }
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([foto.ruta]);
    if (storageError) mensaje(`La ficha se actualizó, pero Storage no pudo eliminar el archivo: ${storageError.message}`);
    await cargarExistentes();
  }

  async function subirPendientes() {
    tallerActual = $('taller-id')?.value || '';
    if (!tallerActual) { mensaje('Selecciona primero un taller.'); return; }
    if (!pendientes.length) { mensaje('No hay imágenes pendientes.'); return; }
    mensaje('Subiendo fotografías…');
    const subidas = [];
    for (let i = 0; i < pendientes.length; i += 1) {
      const item = pendientes[i];
      const extension = item.file.type === 'image/png' ? 'png' : item.file.type === 'image/webp' ? 'webp' : 'jpg';
      const base = limpiarNombre(item.file.name.replace(/\.[^.]+$/, ''));
      const ruta = `talleres/${tallerActual}/${Date.now()}-${i + 1}-${base}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(ruta, item.file, { contentType: item.file.type, upsert: false });
      if (error) {
        if (subidas.length) await supabase.storage.from(BUCKET).remove(subidas.map((x) => x.ruta));
        mensaje(`Error al subir ${item.file.name}: ${error.message}`);
        return;
      }
      subidas.push({ ruta, principal: item.principal });
    }
    const combinadas = [
      ...existentes.map((x) => ({ ruta: x.ruta, principal: x.principal })),
      ...subidas
    ];
    combinadas.sort((a, b) => Number(b.principal) - Number(a.principal));
    const rutas = combinadas.slice(0, MAX_FOTOS).map((x) => x.ruta);
    const { error: dbError } = await supabase.from('talleres').update({ fotos: rutas }).eq('id', tallerActual);
    if (dbError) {
      await supabase.storage.from(BUCKET).remove(subidas.map((x) => x.ruta));
      mensaje(`Las imágenes no se vincularon a la ficha: ${dbError.message}`);
      return;
    }
    mensaje('Fotografías subidas y vinculadas correctamente.', true);
    await cargarExistentes();
  }

  function conectarEventos() {
    const zona = $('zona-fotos');
    const input = $('selector-fotos');
    zona.addEventListener('click', () => input.click());
    zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.style.borderColor = '#16a34a'; });
    zona.addEventListener('dragleave', () => { zona.style.borderColor = '#94a3b8'; });
    zona.addEventListener('drop', (e) => { e.preventDefault(); zona.style.borderColor = '#94a3b8'; validarArchivos([...e.dataTransfer.files]); });
    input.addEventListener('change', () => { validarArchivos([...input.files]); input.value = ''; });
    $('subir-fotos').addEventListener('click', subirPendientes);
    $('descartar-fotos').addEventListener('click', () => { pendientes.forEach((x) => URL.revokeObjectURL(x.preview)); pendientes = []; renderizar(); mensaje('Imágenes pendientes descartadas.'); });

    const tallerId = $('taller-id');
    if (tallerId) {
      const observer = new MutationObserver(cargarExistentes);
      observer.observe(tallerId, { attributes: true, attributeFilter: ['value'] });
      document.addEventListener('click', (e) => {
        if (e.target.closest('.tm-result')) setTimeout(cargarExistentes, 0);
      });
    }
  }

  function iniciar() {
    construirInterfaz();
    renderizar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
}());
