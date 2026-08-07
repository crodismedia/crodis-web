(function(){
  'use strict';
  const form=document.getElementById('form-taller');
  if(!form||document.getElementById('url-interna-ficha'))return;
  const campo=document.createElement('div');
  campo.className='tm-field full';
  campo.innerHTML='<label for="url-interna-ficha">URL interna de la ficha</label><div style="display:grid;grid-template-columns:1fr auto auto;gap:8px"><input id="url-interna-ficha" type="url" readonly placeholder="Selecciona una ficha"><button id="copiar-url-interna" type="button" class="tm-btn tm-btn-soft">Copiar</button><button id="abrir-url-interna" type="button" class="tm-btn tm-btn-soft">Abrir</button></div>';
  const nombre=document.getElementById('nombre')?.closest('.tm-field');
  if(nombre)nombre.insertAdjacentElement('beforebegin',campo);else form.prepend(campo);
  function actualizar(){const id=document.getElementById('taller-id')?.value||'';document.getElementById('url-interna-ficha').value=id?`https://www.tallermap.es/pages/taller.html?id=${encodeURIComponent(id)}`:'';}
  document.getElementById('resultados-talleres')?.addEventListener('click',()=>setTimeout(actualizar,50));
  document.getElementById('copiar-url-interna')?.addEventListener('click',async()=>{const v=document.getElementById('url-interna-ficha').value;if(v)await navigator.clipboard.writeText(v);});
  document.getElementById('abrir-url-interna')?.addEventListener('click',()=>{const v=document.getElementById('url-interna-ficha').value;if(v)window.open(v,'_blank','noopener,noreferrer');});
}());