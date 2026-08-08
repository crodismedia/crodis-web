(function(){
  'use strict';

  const params = new URLSearchParams(location.search);
  if(params.get('lote') !== '1') return;

  const CLAVE = 'tm_lote_revision';
  const $ = id => document.getElementById(id);

  function leer(){
    try{
      const lote = JSON.parse(localStorage.getItem(CLAVE) || 'null');

      if(!lote || !Array.isArray(lote.ids) || !lote.ids.length){
        return null;
      }

      lote.indice = Math.max(
        0,
        Math.min(Number(lote.indice) || 0, lote.ids.length - 1)
      );

      lote.creadas = Number(lote.creadas) || 0;
      lote.omitidas = Number(lote.omitidas) || 0;

      return lote;
    }catch(error){
      console.error('No se pudo leer el lote:', error);
      return null;
    }
  }

  function guardarLote(lote){
    localStorage.setItem(CLAVE, JSON.stringify(lote));
  }

  function terminar(){
    const lote = leer();

    localStorage.removeItem(CLAVE);

    const resumen = lote
      ? `Lote finalizado · revisadas ${lote.creadas || 0} · omitidas ${lote.omitidas || 0}`
      : 'Lote finalizado';

    sessionStorage.setItem('tm_lote_resumen', resumen);
    location.href = 'admin-autocompletar.html';
  }

  function irA(indice, accion){
    const lote = leer();

    if(!lote){
      terminar();
      return;
    }

    if(accion === 'guardada'){
      lote.creadas = (lote.creadas || 0) + 1;
    }

    if(accion === 'omitida'){
      lote.omitidas = (lote.omitidas || 0) + 1;
    }

    if(indice >= lote.ids.length){
      guardarLote(lote);
      terminar();
      return;
    }

    lote.indice = indice;
    guardarLote(lote);

    location.href =
      `admin-editor.html?id=${encodeURIComponent(lote.ids[indice])}&lote=1`;
  }

  function montar(){
    const form = $('form-taller');
    const estado = $('estado-ficha');
    const idActual = String(params.get('id') || '');
    const lote = leer();

    if(!form || !estado || !lote){
      return false;
    }

    const indiceReal = lote.ids.indexOf(idActual);

    if(indiceReal < 0){
      estado.textContent = 'Esta ficha no pertenece al lote activo.';
      return true;
    }

    if(indiceReal !== lote.indice){
      lote.indice = indiceReal;
      guardarLote(lote);
    }

    const barra = form.querySelector('.tm-savebar');

    if(!barra){
      return false;
    }

    if($('tm-lote-controles')){
      return true;
    }

    const bloque = document.createElement('div');
    bloque.id = 'tm-lote-controles';
    bloque.style.cssText = [
      'display:flex',
      'gap:8px',
      'align-items:center',
      'flex-wrap:wrap',
      'margin-right:auto'
    ].join(';');

    const indicador = document.createElement('strong');
    indicador.textContent = `Ficha ${indiceReal + 1} de ${lote.ids.length}`;
    indicador.style.cssText = 'color:#475467;margin-right:4px';

    const omitir = document.createElement('button');
    omitir.type = 'button';
    omitir.className = 'tm-btn tm-btn-soft';
    omitir.textContent = 'Omitir y siguiente';
    omitir.disabled = true;

    const guardarSiguiente = document.createElement('button');
    guardarSiguiente.type = 'button';
    guardarSiguiente.className = 'tm-btn tm-btn-primary';
    guardarSiguiente.textContent = 'Guardar y siguiente';
    guardarSiguiente.disabled = true;

    bloque.append(indicador, omitir, guardarSiguiente);
    barra.prepend(bloque);

    let fichaLista = false;
    let avanzarTrasGuardar = false;

    function actualizarDisponibilidad(){
      const idCargado = String($('taller-id')?.value || '');
      const cargada = !form.hidden && idCargado === idActual;

      fichaLista = cargada;
      omitir.disabled = !cargada;
      guardarSiguiente.disabled = !cargada;

      if(cargada){
        const texto = `Ficha ${indiceReal + 1} de ${lote.ids.length}`;

        if(indicador.textContent !== texto){
          indicador.textContent = texto;
        }
      }
    }

    /*
     * Solo observamos si el formulario pasa de oculto a visible.
     * No observamos cambios internos porque el contador y los botones
     * también modifican el formulario y provocarían un ciclo infinito.
     */
    const observadorForm = new MutationObserver(() => {
      actualizarDisponibilidad();
    });

    observadorForm.observe(form, {
      attributes: true,
      attributeFilter: ['hidden']
    });

    $('taller-id')?.addEventListener('input', actualizarDisponibilidad);

    omitir.addEventListener('click', () => {
      if(!fichaLista) return;
      irA(indiceReal + 1, 'omitida');
    });

    guardarSiguiente.addEventListener('click', () => {
      if(!fichaLista) return;

      avanzarTrasGuardar = true;
      guardarSiguiente.disabled = true;
      omitir.disabled = true;

      if(typeof form.requestSubmit === 'function'){
        form.requestSubmit();
      }else{
        form.querySelector('button[type="submit"]')?.click();
      }
    });

    const observadorEstado = new MutationObserver(() => {
      if(!avanzarTrasGuardar) return;

      const texto = String(estado.textContent || '').toLowerCase();

      if(texto.includes('guardada correctamente')){
        avanzarTrasGuardar = false;
        irA(indiceReal + 1, 'guardada');
        return;
      }

      if(
        texto.includes('no se pudo guardar') ||
        texto.includes('error')
      ){
        avanzarTrasGuardar = false;
        actualizarDisponibilidad();
      }
    });

    observadorEstado.observe(estado, {
      childList: true,
      subtree: true,
      characterData: true
    });

    actualizarDisponibilidad();
    return true;
  }

  if(!montar()){
    let intentos = 0;

    const temporizador = setInterval(() => {
      intentos += 1;

      if(montar() || intentos > 40){
        clearInterval(temporizador);
      }
    }, 250);
  }
}());
