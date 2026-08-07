(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('lote')!=='1')return;

  const CLAVE='tm_lote_revision';
  const form=document.getElementById('form-taller');
  const estado=document.getElementById('estado-ficha');
  if(!form||!estado)return;

  function leer(){
    try{
      const lote=JSON.parse(sessionStorage.getItem(CLAVE)||'null');
      if(!lote||!Array.isArray(lote.ids)||!lote.ids.length)return null;
      lote.indice=Math.max(0,Math.min(Number(lote.indice)||0,lote.ids.length-1));
      return lote;
    }catch{return null;}
  }

  function guardarLote(lote){sessionStorage.setItem(CLAVE,JSON.stringify(lote));}
  function terminar(){sessionStorage.removeItem(CLAVE);location.href='admin-autocompletar.html';}
  function irA(indice){
    const lote=leer();
    if(!lote)return terminar();
    if(indice>=lote.ids.length)return terminar();
    lote.indice=indice;guardarLote(lote);
    location.href=`admin-editor.html?id=${encodeURIComponent(lote.ids[indice])}&lote=1`;
  }

  const lote=leer();
  if(!lote)return;
  const idActual=params.get('id');
  const encontrado=lote.ids.indexOf(String(idActual||''));
  if(encontrado>=0&&encontrado!==lote.indice){lote.indice=encontrado;guardarLote(lote);}

  const barra=form.querySelector('.tm-savebar');
  if(!barra)return;

  const indicador=document.createElement('span');
  indicador.style.cssText='margin-right:auto;align-self:center;font-weight:700;color:#475467';
  indicador.textContent=`Lote ${lote.indice+1} de ${lote.ids.length}`;

  const omitir=document.createElement('button');
  omitir.type='button';omitir.className='tm-btn tm-btn-soft';omitir.textContent='Omitir y siguiente';
  omitir.addEventListener('click',()=>irA((leer()?.indice||0)+1));

  const guardarSiguiente=document.createElement('button');
  guardarSiguiente.type='button';guardarSiguiente.className='tm-btn tm-btn-primary';guardarSiguiente.textContent='Guardar y siguiente';
  let avanzarTrasGuardar=false;
  guardarSiguiente.addEventListener('click',()=>{
    avanzarTrasGuardar=true;
    guardarSiguiente.disabled=true;
    const submit=barra.querySelector('button[type="submit"]');
    if(submit)submit.click();else form.requestSubmit();
  });

  const observador=new MutationObserver(()=>{
    if(!avanzarTrasGuardar)return;
    const texto=String(estado.textContent||'').toLowerCase();
    if(texto.includes('guardada correctamente')){
      avanzarTrasGuardar=false;
      irA((leer()?.indice||0)+1);
    }else if(texto.includes('no se pudo guardar')||texto.includes('error')){
      avanzarTrasGuardar=false;guardarSiguiente.disabled=false;
    }
  });
  observador.observe(estado,{childList:true,subtree:true,characterData:true});

  barra.prepend(indicador,omitir,guardarSiguiente);
}());
