(function(){
  'use strict';

  const IDS=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','servicios','horarios','descripcion'];
  const MODULOS=[
    ['../js/admin-validation.js','data-admin-validation'],
    ['../js/admin-activity-log.js','data-admin-activity'],
    ['../js/admin-quick-actions.js','data-admin-quick-actions'],
    ['../js/admin-quality-score.js','data-admin-quality'],
    ['../js/admin-batch-navigation.js','data-admin-batch-navigation'],
    ['../js/admin-runtime-status.js','data-admin-runtime-status'],
    ['../js/admin-guided-test.js','data-admin-guided-test']
  ];
  let original={};
  let tallerId='';
  let restaurando=false;

  const $=(id)=>document.getElementById(id);
  const valor=(id)=>$(id)?.value??'';
  const snapshot=()=>Object.fromEntries(IDS.map(id=>[id,valor(id)]));
  const nombreCampo=(id)=>({nombre:'Nombre',telefono:'Teléfono',web:'Web',direccion:'Dirección',codigo_postal:'Código postal',ciudad:'Población',provincia:'Provincia',servicios:'Servicios',horarios:'Horarios',descripcion:'Descripción'}[id]||id);

  function diferencias(){
    if(!tallerId)return [];
    return IDS.filter(id=>valor(id)!==(original[id]??''));
  }

  function construir(){
    const form=$('form-taller');
    if(!form||$('resumen-cambios'))return;
    const panel=document.createElement('section');
    panel.id='resumen-cambios';
    panel.className='tm-field full';
    panel.style.cssText='position:sticky;bottom:64px;z-index:4;border:1px solid #dfe3e8;background:#fff;border-radius:14px;padding:10px;box-shadow:0 -4px 18px rgba(15,23,42,.08)';
    panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong id="contador-cambios">Sin cambios pendientes</strong><div id="lista-cambios" class="tm-status" style="margin-top:3px"></div></div><button id="btn-restaurar-ficha" type="button" class="tm-btn tm-btn-soft" disabled>Restaurar ficha</button></div>';
    const savebar=form.querySelector('.tm-savebar');
    form.insertBefore(panel,savebar||null);
    $('btn-restaurar-ficha').addEventListener('click',restaurar);
  }

  function renderizar(){
    const diff=diferencias();
    const contador=$('contador-cambios'),lista=$('lista-cambios'),boton=$('btn-restaurar-ficha');
    if(!contador||!lista||!boton)return;
    if(!diff.length){contador.textContent='Sin cambios pendientes';lista.textContent='';boton.disabled=true;return;}
    contador.textContent=`${diff.length} cambio${diff.length===1?'':'s'} pendiente${diff.length===1?'':'s'}`;
    lista.textContent=diff.map(nombreCampo).join(' · ');
    boton.disabled=false;
  }

  function capturar(){
    const id=valor('taller-id');
    if(!id)return;
    tallerId=id;
    original=snapshot();
    renderizar();
  }

  function restaurar(){
    const diff=diferencias();
    if(!diff.length)return;
    if(!window.confirm(`Se restaurarán ${diff.length} campo${diff.length===1?'':'s'} al valor cargado. ¿Continuar?`))return;
    restaurando=true;
    IDS.forEach(id=>{const nodo=$(id);if(!nodo)return;nodo.value=original[id]??'';nodo.dispatchEvent(new Event('input',{bubbles:true}));nodo.dispatchEvent(new Event('change',{bubbles:true}));});
    restaurando=false;
    renderizar();
  }

  function hayCambios(){return diferencias().length>0;}

  function cargarModulo(src,atributo){
    return new Promise((resolve,reject)=>{
      const existente=document.querySelector(`script[${atributo}]`);
      if(existente){
        if(existente.dataset.loaded==='true')return resolve();
        existente.addEventListener('load',resolve,{once:true});
        existente.addEventListener('error',()=>reject(new Error(`No se pudo cargar ${src}`)),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=src;
      script.setAttribute(atributo,'true');
      script.async=false;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
      script.addEventListener('error',()=>reject(new Error(`No se pudo cargar ${src}`)),{once:true});
      document.body.appendChild(script);
    });
  }

  async function cargarModulosEnOrden(){
    window.TallerMapAdminModules={estado:'cargando',cargados:[],errores:[]};
    for(const [src,atributo] of MODULOS){
      try{
        await cargarModulo(src,atributo);
        window.TallerMapAdminModules.cargados.push(src);
      }catch(error){
        console.error(error);
        window.TallerMapAdminModules.errores.push({src,mensaje:error.message});
      }
    }
    window.TallerMapAdminModules.estado=window.TallerMapAdminModules.errores.length?'con_errores':'listo';
    document.dispatchEvent(new CustomEvent('tallermap:admin-modules-ready',{detail:window.TallerMapAdminModules}));
  }

  async function conectar(){
    construir();
    IDS.forEach(id=>{const nodo=$(id);if(!nodo)return;nodo.addEventListener('input',()=>{if(!restaurando)renderizar();});nodo.addEventListener('change',()=>{if(!restaurando)renderizar();});});

    document.addEventListener('click',e=>{
      const resultado=e.target.closest('.tm-result');
      if(!resultado)return;
      if(hayCambios()&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otro taller?')){
        e.preventDefault();e.stopImmediatePropagation();return;
      }
      setTimeout(capturar,30);
    },true);

    const estado=$('estado-ficha');
    if(estado){
      new MutationObserver(()=>{
        if(/guardada correctamente/i.test(estado.textContent||''))capturar();
      }).observe(estado,{childList:true,characterData:true,subtree:true});
    }

    window.addEventListener('beforeunload',e=>{
      if(!hayCambios())return;
      e.preventDefault();e.returnValue='';
    });

    const cerrar=$('boton-cerrar-sesion');
    cerrar?.addEventListener('click',e=>{
      if(hayCambios()&&!window.confirm('Hay cambios sin guardar. ¿Cerrar sesión igualmente?')){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);

    await cargarModulosEnOrden();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar,{once:true});else conectar();
}());