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
  const errores=[];

  function construir(){
    const body=document.querySelector('[data-pane="ficha"] .tm-body');
    if(!body||$('prueba-guiada'))return;
    const box=document.createElement('section');
    box.id='prueba-guiada';
    box.style.cssText='margin:0 0 14px;padding:12px;border:1px solid #dfe3e8;border-radius:14px;background:#f8fafc';
    box.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>Prueba guiada del editor</strong><p class="tm-status" style="margin:3px 0 0">No modifica datos por sí sola. Marca el flujo que completes manualmente.</p></div><button id="reiniciar-prueba-guiada" type="button" class="tm-btn tm-btn-soft">Reiniciar</button></div><div id="pasos-prueba-guiada" style="display:grid;gap:6px;margin-top:10px"></div><div id="resumen-prueba-guiada" style="margin-top:12px;padding:10px;border:1px solid #dfe3e8;border-radius:12px;background:#fff"></div>';
    body.insertBefore(box,body.firstChild);
    $('reiniciar-prueba-guiada').addEventListener('click',reiniciar);
    render();
  }

  function reiniciar(){
    Object.keys(estado).forEach(k=>estado[k]=false);
    errores.length=0;
    render();
    comprobarSesion();
  }

  function marcar(id){if(!estado[id]){estado[id]=true;render();}}
  function registrarError(origen,mensaje){
    const texto=`${origen}: ${mensaje||'error no especificado'}`;
    if(!errores.includes(texto))errores.push(texto);
    render();
  }

  function render(){
    const lista=$('pasos-prueba-guiada');if(!lista)return;
    lista.innerHTML=pasos.map(([id,texto])=>`<div style="font-size:.9rem;color:${estado[id]?'#15803d':'#667085'}"><strong>${estado[id]?'✓':'○'}</strong> ${texto}</div>`).join('');
    const hechos=Object.values(estado).filter(Boolean).length;
    const completa=hechos===pasos.length;
    const apto=completa&&!errores.length;
    const resumen=$('resumen-prueba-guiada');
    const titulo=apto?'Apto para uso diario':errores.length?'Requiere corrección':'Prueba todavía incompleta';
    const color=apto?'#15803d':errores.length?'#b91c1c':'#b45309';
    const pendientes=pasos.filter(([id])=>!estado[id]).map(([,texto])=>texto);
    resumen.innerHTML=`<strong style="color:${color};font-size:1rem">${titulo}</strong><div class="tm-status" style="margin-top:5px">${hechos} de ${pasos.length} pasos superados</div>${pendientes.length?`<div style="margin-top:8px;font-size:.86rem"><strong>Pendientes:</strong> ${pendientes.join(' · ')}</div>`:''}${errores.length?`<div style="margin-top:8px;font-size:.86rem;color:#b91c1c"><strong>Errores:</strong><br>${errores.map(e=>`• ${e}`).join('<br>')}</div>`:''}`;
  }

  async function comprobarSesion(){
    try{
      const r=await window.supabaseClient?.auth.getSession();
      if(r?.data?.session)marcar('sesion');
      else registrarError('Sesión','No hay una sesión administrativa activa');
    }catch(error){registrarError('Sesión',error.message);}
  }

  function conectar(){
    construir();
    comprobarSesion();
    $('btn-buscar')?.addEventListener('click',()=>marcar('busqueda'));
    $('buscar-taller')?.addEventListener('keydown',e=>{if(e.key==='Enter')marcar('busqueda');});
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(()=>{if($('taller-id')?.value)marcar('apertura');},80);});
    document.querySelectorAll('#form-taller input:not([type="hidden"]),#form-taller textarea,#form-taller select').forEach(n=>n.addEventListener('input',()=>{if($('taller-id')?.value)marcar('edicion');}));
    const validacion=$('resultado-validacion');
    if(validacion)new MutationObserver(()=>{if(validacion.textContent.trim())marcar('validacion');}).observe(validacion,{childList:true,subtree:true,characterData:true});
    document.addEventListener('tallermap:save-success',()=>marcar('guardado'));
    document.addEventListener('tallermap:save-error',e=>registrarError('Guardado',e.detail?.message||e.detail?.error?.message));
    document.addEventListener('tallermap:admin-modules-ready',e=>{
      (e.detail?.errores||[]).forEach(x=>registrarError('Módulo',`${x.src}: ${x.mensaje}`));
    });
    window.addEventListener('error',e=>registrarError('JavaScript',e.message));
    window.addEventListener('unhandledrejection',e=>registrarError('Promesa',e.reason?.message||String(e.reason||'')));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar,{once:true});else conectar();
}());
