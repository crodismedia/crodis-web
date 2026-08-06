(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const pasos=[
    ['sesion','Sesión administrativa activa'],
    ['busqueda','Búsqueda ejecutada'],
    ['apertura','Ficha abierta'],
    ['edicion','Campo modificado'],
    ['validacion','Validación ejecutada'],
    ['guardado','Guardado confirmado por Supabase']
  ];
  const estado=Object.fromEntries(pasos.map(([id])=>[id,false]));

  function construir(){
    const body=document.querySelector('[data-pane="ficha"] .tm-body');
    if(!body||$('prueba-guiada'))return;
    const box=document.createElement('section');
    box.id='prueba-guiada';
    box.style.cssText='margin:0 0 14px;padding:12px;border:1px solid #dfe3e8;border-radius:14px;background:#f8fafc';
    box.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>Prueba guiada del editor</strong><p class="tm-status" style="margin:3px 0 0">No modifica datos por sí sola. Marca el flujo que completes manualmente.</p></div><button id="reiniciar-prueba-guiada" type="button" class="tm-btn tm-btn-soft">Reiniciar</button></div><div id="pasos-prueba-guiada" style="display:grid;gap:6px;margin-top:10px"></div><strong id="resultado-prueba-guiada" style="display:block;margin-top:10px">0 de 6 pasos completados</strong>';
    body.insertBefore(box,body.firstChild);
    $('reiniciar-prueba-guiada').addEventListener('click',()=>{Object.keys(estado).forEach(k=>estado[k]=false);render();comprobarSesion();});
    render();
  }

  function marcar(id){if(!estado[id]){estado[id]=true;render();}}
  function render(){
    const lista=$('pasos-prueba-guiada');if(!lista)return;
    lista.innerHTML=pasos.map(([id,texto])=>`<div style="font-size:.9rem;color:${estado[id]?'#15803d':'#667085'}"><strong>${estado[id]?'✓':'○'}</strong> ${texto}</div>`).join('');
    const hechos=Object.values(estado).filter(Boolean).length;
    $('resultado-prueba-guiada').textContent=hechos===pasos.length?'Editor probado de principio a fin':`${hechos} de ${pasos.length} pasos completados`;
  }

  async function comprobarSesion(){
    try{const r=await window.supabaseClient?.auth.getSession();if(r?.data?.session)marcar('sesion');}catch{}
  }

  function conectar(){
    construir();
    comprobarSesion();
    $('btn-buscar')?.addEventListener('click',()=>marcar('busqueda'));
    $('buscar-taller')?.addEventListener('keydown',e=>{if(e.key==='Enter')marcar('busqueda');});
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(()=>{if($('taller-id')?.value)marcar('apertura');},80);});
    document.querySelectorAll('#form-taller input:not([type="hidden"]),#form-taller textarea,#form-taller select').forEach(n=>n.addEventListener('input',()=>{if($('taller-id')?.value)marcar('edicion');},{once:true}));
    const validacion=$('resultado-validacion');
    if(validacion)new MutationObserver(()=>{if(validacion.textContent.trim())marcar('validacion');}).observe(validacion,{childList:true,subtree:true,characterData:true});
    const ficha=$('estado-ficha');
    if(ficha)new MutationObserver(()=>{if(/guardada correctamente/i.test(ficha.textContent||''))marcar('guardado');}).observe(ficha,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar,{once:true});else conectar();
}());
