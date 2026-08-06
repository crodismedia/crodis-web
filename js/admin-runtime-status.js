(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const MODULOS=[
    ['Editor','admin-shell.js'],
    ['Galería','admin-gallery.js'],
    ['Servicios y horarios','admin-structured-fields.js'],
    ['Protección de cambios','admin-change-guard.js'],
    ['Validación','admin-validation.js'],
    ['Historial','admin-activity-log.js'],
    ['Acciones rápidas','admin-quick-actions.js'],
    ['Calidad','admin-quality-score.js'],
    ['Navegación por lote','admin-batch-navigation.js'],
    ['Guardado robusto','admin-save-guard.js']
  ];

  function cargarGuardado(){
    if([...document.scripts].some(s=>(s.src||'').endsWith('admin-save-guard.js')))return;
    const script=document.createElement('script');
    script.src='../js/admin-save-guard.js';
    script.async=false;
    document.body.appendChild(script);
  }

  function construir(){
    cargarGuardado();
    const form=$('form-taller');
    if(!form||$('estado-plataforma'))return;
    const panel=document.createElement('section');
    panel.id='estado-plataforma';
    panel.className='tm-field full';
    panel.innerHTML='<label>Estado de la plataforma</label><div id="estado-plataforma-contenido" style="display:grid;gap:7px;padding:10px;border:1px solid #dfe3e8;border-radius:12px;background:#f8fafc"><span class="tm-status">Comprobando conexión, sesión y módulos…</span></div><button id="btn-recomprobar-plataforma" type="button" class="tm-btn tm-btn-soft" style="justify-self:start">Comprobar de nuevo</button>';
    form.insertBefore(panel,form.firstElementChild?.nextSibling||null);
    $('btn-recomprobar-plataforma')?.addEventListener('click',comprobar);
    setTimeout(comprobar,50);
  }

  function fila(ok,texto,detalle=''){
    const color=ok?'#15803d':'#b91c1c';
    return `<div style="color:${color};font-size:.88rem"><strong>${ok?'✓':'✕'}</strong> ${texto}${detalle?` <span style="color:#667085">${detalle}</span>`:''}</div>`;
  }

  async function comprobar(){
    const box=$('estado-plataforma-contenido');
    if(!box)return;
    box.innerHTML='<span class="tm-status">Comprobando…</span>';
    const resultados=[];
    resultados.push(fila(Boolean(window.supabase),'Biblioteca de Supabase'));
    resultados.push(fila(Boolean(supabase),'Cliente de Supabase'));

    let sesion=false;
    let admin=false;
    if(supabase){
      try{
        const {data:{session}}=await supabase.auth.getSession();
        sesion=Boolean(session);
        resultados.push(fila(sesion,'Sesión administrativa'));
        if(sesion){
          const {data,error}=await supabase.rpc('es_administrador');
          admin=!error&&Boolean(data);
          resultados.push(fila(admin,'Permiso de administrador',error?`(${error.message})`:''));
        }
      }catch(error){
        resultados.push(fila(false,'Comprobación de acceso',`(${error.message})`));
      }
    }

    MODULOS.forEach(([nombre,archivo])=>{
      const cargado=[...document.scripts].some(script=>(script.src||'').endsWith('/js/'+archivo)||script.src?.endsWith(archivo));
      resultados.push(fila(cargado,nombre,cargado?'':'(módulo no cargado)'));
    });

    const operativo=Boolean(supabase&&sesion&&admin&&$('form-taller')&&$('btn-buscar'));
    resultados.unshift(`<div style="font-weight:800;color:${operativo?'#15803d':'#b45309'}">${operativo?'Editor preparado para trabajar':'Editor requiere atención'}</div>`);
    box.innerHTML=resultados.join('');
  }

  document.addEventListener('tallermap:ficha-guardada',()=>setTimeout(comprobar,50));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',construir);else construir();
}());
