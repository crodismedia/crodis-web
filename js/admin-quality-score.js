(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const valor=id=>$(id)?.value.trim()||'';
  const CAMPOS=[
    ['nombre','Nombre',14],['telefono','Teléfono',14],['direccion','Dirección',12],
    ['codigo_postal','Código postal',8],['ciudad','Población',10],['provincia','Provincia',8],
    ['web','Web',8],['servicios','Servicios',10],['horarios','Horarios',8],['descripcion','Descripción',8]
  ];
  function valido(id,v){
    if(!v)return false;
    if(id==='telefono')return /^\+?(?:34)?[6789]\d{8}$/.test(v.replace(/\D/g,''));
    if(id==='codigo_postal')return /^\d{5}$/.test(v);
    if(id==='web')return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(v);
    if(id==='direccion')return v.length>=5;
    if(id==='descripcion')return v.length>=20;
    if(id==='servicios')return v.split(/[\n,;]+/).filter(Boolean).length>=1;
    return true;
  }
  function construir(){
    const form=$('form-taller');
    if(!form||$('panel-calidad-ficha'))return;
    const panel=document.createElement('section');
    panel.id='panel-calidad-ficha';
    panel.className='tm-field full';
    panel.style.cssText='border:1px solid #dfe3e8;background:#f8fafc;border-radius:14px;padding:12px';
    panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><strong>Calidad de la ficha</strong><div id="calidad-prioridad" class="tm-status" style="margin-top:3px"></div></div><strong id="calidad-porcentaje" style="font-size:1.35rem">0%</strong></div><div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin:10px 0"><div id="calidad-barra" style="height:100%;width:0;background:#16a34a;transition:width .2s"></div></div><div id="calidad-faltantes" class="tm-status"></div>';
    form.insertBefore(panel,form.firstElementChild?.nextSibling||form.firstChild);
  }
  function renderizar(){
    if(!$('panel-calidad-ficha'))return;
    let puntos=0,total=0;const faltan=[];
    CAMPOS.forEach(([id,nombre,peso])=>{total+=peso;const v=valor(id);if(valido(id,v))puntos+=peso;else faltan.push(nombre);});
    const porcentaje=Math.round((puntos/total)*100);
    $('calidad-porcentaje').textContent=porcentaje+'%';
    $('calidad-barra').style.width=porcentaje+'%';
    $('calidad-prioridad').textContent=porcentaje<50?'Prioridad alta de revisión':porcentaje<80?'Prioridad media de revisión':'Ficha bien completada';
    $('calidad-faltantes').textContent=faltan.length?'Pendiente: '+faltan.join(' · '):'Todos los campos principales están completos.';
  }
  function iniciar(){
    construir();
    CAMPOS.forEach(([id])=>{const n=$(id);n?.addEventListener('input',renderizar);n?.addEventListener('change',renderizar);});
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(renderizar,40);},true);
    const estado=$('estado-ficha');
    if(estado)new MutationObserver(renderizar).observe(estado,{childList:true,subtree:true,characterData:true});
    renderizar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
}());