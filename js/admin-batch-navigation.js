(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  let guardarYSiguiente=false;

  function resultados(){
    return Array.from(document.querySelectorAll('#resultados-talleres .tm-result[data-i]'));
  }

  function indiceActivo(){
    return resultados().findIndex(nodo=>nodo.classList.contains('active'));
  }

  function actualizar(){
    const lista=resultados();
    const indice=indiceActivo();
    const anterior=$('btn-taller-anterior');
    const siguiente=$('btn-taller-siguiente');
    const guardar=$('btn-guardar-siguiente');
    if(anterior)anterior.disabled=indice<=0;
    if(siguiente)siguiente.disabled=indice<0||indice>=lista.length-1;
    if(guardar)guardar.disabled=indice<0||indice>=lista.length-1;
    const estado=$('estado-navegacion-lote');
    if(estado)estado.textContent=indice>=0?`Taller ${indice+1} de ${lista.length} en estos resultados`:'Selecciona un taller.';
  }

  function abrirDesplazado(delta){
    const lista=resultados();
    const indice=indiceActivo();
    const destino=lista[indice+delta];
    if(!destino)return;
    destino.click();
    destino.scrollIntoView({behavior:'smooth',block:'nearest'});
    setTimeout(actualizar,50);
  }

  function construir(){
    const form=$('form-taller');
    if(!form||$('navegacion-lote'))return;
    const panel=document.createElement('section');
    panel.id='navegacion-lote';
    panel.className='tm-field full';
    panel.innerHTML='<label>Navegación de revisión</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="btn-taller-anterior" type="button" class="tm-btn tm-btn-soft" disabled>← Anterior</button><button id="btn-taller-siguiente" type="button" class="tm-btn tm-btn-soft" disabled>Siguiente →</button><button id="btn-guardar-siguiente" type="button" class="tm-btn tm-btn-primary" disabled>Guardar y siguiente</button></div><p id="estado-navegacion-lote" class="tm-status">Selecciona un taller.</p>';
    const savebar=form.querySelector('.tm-savebar');
    form.insertBefore(panel,savebar||null);

    $('btn-taller-anterior').addEventListener('click',()=>abrirDesplazado(-1));
    $('btn-taller-siguiente').addEventListener('click',()=>abrirDesplazado(1));
    $('btn-guardar-siguiente').addEventListener('click',()=>{
      guardarYSiguiente=true;
      form.requestSubmit();
    });

    new MutationObserver(actualizar).observe($('resultados-talleres'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    const estado=$('estado-ficha');
    if(estado){
      new MutationObserver(()=>{
        const texto=estado.textContent||'';
        if(guardarYSiguiente&&/guardada correctamente/i.test(texto)){
          guardarYSiguiente=false;
          setTimeout(()=>abrirDesplazado(1),80);
        }else if(guardarYSiguiente&&/(no se pudo guardar|corrige|duplicado|error)/i.test(texto)){
          guardarYSiguiente=false;
        }
      }).observe(estado,{childList:true,characterData:true,subtree:true});
    }
    actualizar();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',construir);else construir();
}());