(function(){
  'use strict';
  const input=document.getElementById('buscar-taller');
  const boton=document.getElementById('btn-buscar');
  const resultados=document.getElementById('resultados-talleres');
  if(!input||!boton||!resultados)return;

  let busquedaSolicitada=false;
  let temporizador=null;

  function terminoValido(){return input.value.trim().length>=2;}
  function limpiar(){
    if(!busquedaSolicitada)resultados.innerHTML='';
  }
  function autorizarBusqueda(){
    busquedaSolicitada=terminoValido();
    if(!busquedaSolicitada){
      resultados.innerHTML='';
      input.focus();
    }
  }

  boton.addEventListener('pointerdown',autorizarBusqueda,true);
  boton.addEventListener('click',autorizarBusqueda,true);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter')autorizarBusqueda();
  },true);
  input.addEventListener('input',()=>{
    busquedaSolicitada=false;
    resultados.innerHTML='';
  });
  resultados.addEventListener('click',e=>{
    if(e.target.closest('[data-i]')){
      busquedaSolicitada=false;
      setTimeout(()=>{resultados.innerHTML='';},0);
    }
  });

  new MutationObserver(()=>{
    clearTimeout(temporizador);
    temporizador=setTimeout(limpiar,0);
  }).observe(resultados,{childList:true,subtree:true});

  // El editor antiguo ejecuta una consulta vacía al iniciar. Se elimina su resultado.
  resultados.innerHTML='';
  setTimeout(limpiar,150);
  setTimeout(limpiar,600);
  setTimeout(limpiar,1500);
}());
