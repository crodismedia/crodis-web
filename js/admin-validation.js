(function(){
  'use strict';
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const CAMPOS=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia'];
  let temporizador=null;

  function normalizarTelefono(v){
    let n=String(v||'').replace(/\D/g,'');
    if(n.startsWith('34')&&n.length===11)n=n.slice(2);
    return n;
  }
  function normalizarTexto(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
  function valor(id){return $(id)?.value.trim()||'';}
  function escapar(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}

  function construir(){
    const form=$('form-taller');if(!form||$('validacion-ficha'))return;
    const box=document.createElement('section');
    box.id='validacion-ficha';box.className='tm-field full';
    box.innerHTML='<label>Validación de la ficha</label><div id="resultado-validacion" style="display:grid;gap:7px;padding:10px;border:1px solid #dfe3e8;border-radius:12px;background:#f8fafc"><span class="tm-status">Selecciona un taller para validar sus datos.</span></div><button id="btn-validar-ficha" type="button" class="tm-btn tm-btn-soft" style="justify-self:start">Comprobar ahora</button>';
    const savebar=form.querySelector('.tm-savebar');form.insertBefore(box,savebar||null);
    $('btn-validar-ficha').addEventListener('click',validarTodo);
    CAMPOS.forEach(id=>$(id)?.addEventListener('input',programar));
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(validarTodo,100);});
    form.addEventListener('submit',async e=>{
      const r=await validarTodo();
      if(r.bloqueantes.length){e.preventDefault();e.stopImmediatePropagation();alert('No se puede guardar todavía:\n\n- '+r.bloqueantes.join('\n- '));}
    },true);
  }

  function programar(){clearTimeout(temporizador);temporizador=setTimeout(validarTodo,450);}

  function validarLocal(){
    const errores=[],avisos=[],ok=[];
    const nombre=valor('nombre');
    const tel=normalizarTelefono(valor('telefono'));
    const web=valor('web');
    const cp=valor('codigo_postal');
    const direccion=valor('direccion');
    if(nombre.length<2)errores.push('El nombre debe tener al menos 2 caracteres.');else ok.push('Nombre válido.');
    if(valor('telefono')&&tel.length!==9)errores.push('El teléfono debe tener 9 dígitos españoles.');else if(tel)ok.push('Teléfono con formato válido.');else avisos.push('La ficha no tiene teléfono.');
    if(web){try{new URL(/^https?:\/\//i.test(web)?web:'https://'+web);ok.push('Web con formato válido.');}catch{errores.push('La dirección web no tiene un formato válido.');}}else avisos.push('La ficha no tiene web.');
    if(cp&&!/^\d{5}$/.test(cp))errores.push('El código postal debe contener exactamente 5 dígitos.');else if(cp)ok.push('Código postal válido.');else avisos.push('La ficha no tiene código postal.');
    if(direccion&&direccion.length<5)avisos.push('La dirección parece demasiado corta.');
    if(!valor('ciudad'))avisos.push('Falta la población.');
    if(!valor('provincia'))avisos.push('Falta la provincia.');
    return {errores,avisos,ok,tel};
  }

  async function buscarDuplicados(tel){
    const id=valor('taller-id');const hallazgos=[];
    if(!supabase||!id)return hallazgos;
    if(tel){
      const {data}=await supabase.from('talleres').select('id,nombre,telefono,ciudad').neq('id',id).not('telefono','is',null).limit(1000);
      (data||[]).filter(t=>normalizarTelefono(t.telefono)===tel).forEach(t=>hallazgos.push(`Teléfono ya usado por ${t.nombre}${t.ciudad?' ('+t.ciudad+')':''}.`));
    }
    const nombre=normalizarTexto(valor('nombre')),ciudad=normalizarTexto(valor('ciudad'));
    if(nombre){
      const termino=valor('nombre').replace(/[,%().]/g,' ').trim().slice(0,80);
      const {data}=await supabase.from('talleres').select('id,nombre,ciudad,direccion').neq('id',id).ilike('nombre',`%${termino}%`).limit(20);
      (data||[]).filter(t=>normalizarTexto(t.nombre)===nombre&&(!ciudad||normalizarTexto(t.ciudad)===ciudad)).forEach(t=>hallazgos.push(`Posible duplicado por nombre: ${t.nombre}${t.ciudad?' ('+t.ciudad+')':''}.`));
    }
    return [...new Set(hallazgos)];
  }

  function pintar(local,duplicados){
    const box=$('resultado-validacion');if(!box)return;
    const items=[...local.errores.map(x=>({t:x,c:'#b91c1c',i:'✕'})),...duplicados.map(x=>({t:x,c:'#b45309',i:'⚠'})),...local.avisos.map(x=>({t:x,c:'#b45309',i:'⚠'})),...local.ok.map(x=>({t:x,c:'#15803d',i:'✓'}))];
    box.innerHTML=items.map(x=>`<div style="color:${x.c};font-size:.88rem"><strong>${x.i}</strong> ${escapar(x.t)}</div>`).join('')||'<span class="tm-status">Sin datos para validar.</span>';
  }

  async function validarTodo(){
    if(!$('taller-id')?.value)return {bloqueantes:[]};
    const local=validarLocal();
    const duplicados=await buscarDuplicados(local.tel);
    pintar(local,duplicados);
    return {bloqueantes:[...local.errores,...duplicados],avisos:local.avisos};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',construir);else construir();
}());
