(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const valor=id=>$(id)?.value.trim()||'';
  function iniciar(){
    const form=$('form-taller');
    if(!form||$('acciones-rapidas-taller'))return;
    const panel=document.createElement('section');
    panel.id='acciones-rapidas-taller';
    panel.className='tm-field full';
    panel.innerHTML='<label>Acciones rápidas</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="abrir-ficha-publica" type="button" class="tm-btn tm-btn-primary">Vista pública</button><button id="copiar-direccion" type="button" class="tm-btn tm-btn-soft">Copiar dirección</button></div><p id="estado-acciones-rapidas" class="tm-status">Selecciona un taller.</p>';
    form.insertBefore(panel,form.querySelector('.tm-field'));
    $('abrir-ficha-publica').addEventListener('click',()=>{
      const id=valor('taller-id');
      if(!id)return;
      window.open('/pages/taller.html?id='+encodeURIComponent(id),'_blank','noopener,noreferrer');
    });
    $('copiar-direccion').addEventListener('click',async()=>{
      const direccion=[valor('direccion'),valor('codigo_postal'),valor('ciudad'),valor('provincia')].filter(Boolean).join(', ');
      if(!direccion)return;
      try{await navigator.clipboard.writeText(direccion);$('estado-acciones-rapidas').textContent='Dirección copiada.';}catch{$('estado-acciones-rapidas').textContent='No se pudo copiar.';}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
}());