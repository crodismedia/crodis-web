(function(){
  'use strict';

  function eliminarPruebaGuiada(){
    document.getElementById('prueba-guiada')?.remove();
    document.getElementById('reiniciar-prueba-guiada')?.remove();
    document.getElementById('pasos-prueba-guiada')?.remove();
    document.getElementById('resumen-prueba-guiada')?.remove();
  }

  eliminarPruebaGuiada();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',eliminarPruebaGuiada,{once:true});
  }

  const observer=new MutationObserver(eliminarPruebaGuiada);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.setTimeout(()=>observer.disconnect(),10000);
}());
