(function(){
  'use strict';

  function limpiar(){
    document.getElementById('horario-partido-grid')?.remove();

    const boton=document.getElementById('btn-google');
    if(boton&&boton.dataset.limpio!=='1'){
      const nuevo=boton.cloneNode(true);
      nuevo.id='btn-google';
      nuevo.dataset.limpio='1';
      nuevo.textContent='Investigar ficha';
      boton.replaceWith(nuevo);
      nuevo.addEventListener('click',()=>{
        const tab=document.querySelector('[data-tab="fuente"]');
        tab?.click();
        document.getElementById('dato-candidato')?.focus();
        document.getElementById('estado-ficha').textContent='Investiga únicamente la ficha abierta y copia aquí los datos encontrados.';
      });
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',limpiar);
  else limpiar();

  new MutationObserver(limpiar).observe(document.body,{childList:true,subtree:true});
}());