(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const valor=id=>$(id)?.value.trim()||'';
  const abrir=url=>{if(url)window.open(url,'_blank','noopener,noreferrer');};
  const webNormalizada=()=>{const web=valor('web');return !web?'':/^https?:\/\//i.test(web)?web:`https://${web}`;};
  const direccion=()=>[valor('direccion'),valor('codigo_postal'),valor('ciudad'),valor('provincia')].filter(Boolean).join(', ');
  function estado(texto,ok=false){const n=$('estado-acciones-rapidas');if(n){n.textContent=texto;n.style.color=ok?'#15803d':'#667085';}}
  function actualizar(){
    const seleccionado=Boolean(valor('taller-id'));
    const telefono=valor('telefono').replace(/\D/g,'');
    const web=webNormalizada();
    const dir=direccion();
    const reglas={
      'abrir-ficha-publica':seleccionado,
      'abrir-google-maps':seleccionado&&Boolean(dir),
      'llamar-taller':seleccionado&&telefono.length>=9,
      'abrir-web-taller':seleccionado&&Boolean(web),
      'copiar-direccion':seleccionado&&Boolean(dir)
    };
    Object.entries(reglas).forEach(([id,activo])=>{const b=$(id);if(b)b.disabled=!activo;});
    estado(seleccionado?'Acciones disponibles para el taller seleccionado.':'Selecciona un taller.');
  }
  async function copiarDireccion(){
    const dir=direccion();if(!dir)return;
    try{await navigator.clipboard.writeText(dir);estado('Dirección copiada.',true);}catch{estado('No se pudo copiar la dirección.');}
  }
  function iniciar(){
    const form=$('form-taller');if(!form||$('acciones-rapidas-taller'))return;
    const panel=document.createElement('section');
    panel.id='acciones-rapidas-taller';panel.className='tm-field full';
    panel.innerHTML='<label>Acciones rápidas</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="abrir-ficha-publica" type="button" class="tm-btn tm-btn-primary">Vista pública</button><button id="abrir-google-maps" type="button" class="tm-btn tm-btn-soft">Google Maps</button><button id="llamar-taller" type="button" class="tm-btn tm-btn-soft">Llamar</button><button id="abrir-web-taller" type="button" class="tm-btn tm-btn-soft">Abrir web</button><button id="copiar-direccion" type="button" class="tm-btn tm-btn-soft">Copiar dirección</button></div><p id="estado-acciones-rapidas" class="tm-status">Selecciona un taller.</p>';
    form.insertBefore(panel,form.querySelector('.tm-field'));
    $('abrir-ficha-publica').addEventListener('click',()=>abrir('/pages/taller.html?id='+encodeURIComponent(valor('taller-id'))));
    $('abrir-google-maps').addEventListener('click',()=>abrir('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([valor('nombre'),direccion(),'España'].filter(Boolean).join(', '))));
    $('llamar-taller').addEventListener('click',()=>{const t=valor('telefono').replace(/[^\d+]/g,'');if(t)location.href='tel:'+t;});
    $('abrir-web-taller').addEventListener('click',()=>abrir(webNormalizada()));
    $('copiar-direccion').addEventListener('click',copiarDireccion);
    ['taller-id','nombre','telefono','web','direccion','codigo_postal','ciudad','provincia'].forEach(id=>{$(id)?.addEventListener('input',actualizar);$(id)?.addEventListener('change',actualizar);});
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(actualizar,40);},true);
    actualizar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
}());