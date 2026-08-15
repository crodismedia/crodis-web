(function(){
  'use strict';
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const CAMPOS=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia'];
  let temporizador=null;
  let cacheTalleres=null;
  let cacheEn=0;

  function normalizarTelefono(v){
    let n=String(v||'').replace(/\D/g,'');
    if(n.startsWith('34')&&n.length===11)n=n.slice(2);
    return n.length>=9?n.slice(-9):n;
  }
  function normalizarTexto(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
  function nombreBase(v){return normalizarTexto(v).replace(/\b(s l u|s l|slu|sl|s a|sa|sociedad limitada|sociedad anonima)\b/g,' ').replace(/\b(talleres|taller)\b/g,' ').replace(/\s+/g,' ').trim();}
  function valor(id){return $(id)?.value.trim()||'';}
  function escapar(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function tokens(v){return new Set(nombreBase(v).split(' ').filter(x=>x.length>1));}
  function similitudNombre(a,b){
    const na=nombreBase(a),nb=nombreBase(b);
    if(!na||!nb)return 0;
    if(na===nb)return 1;
    if(Math.min(na.length,nb.length)>=5&&(na.includes(nb)||nb.includes(na)))return .92;
    const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
    let comunes=0;A.forEach(x=>{if(B.has(x))comunes++;});
    return comunes/Math.max(A.size,B.size);
  }

  function construir(){
    const form=$('form-taller');if(!form||$('validacion-ficha'))return;
    const box=document.createElement('section');
    box.id='validacion-ficha';box.className='tm-field full';
    box.innerHTML='<label>Validación de la ficha y duplicados</label><div id="resultado-validacion" style="display:grid;gap:7px;padding:10px;border:1px solid #dfe3e8;border-radius:12px;background:#f8fafc"><span class="tm-status">Selecciona un taller para validar sus datos.</span></div><button id="btn-validar-ficha" type="button" class="tm-btn tm-btn-soft" style="justify-self:start">Comprobar ahora</button>';
    const savebar=form.querySelector('.tm-savebar');form.insertBefore(box,savebar||null);
    $('btn-validar-ficha').addEventListener('click',()=>validarTodo(true));
    CAMPOS.forEach(id=>$(id)?.addEventListener('input',programar));
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(()=>validarTodo(false),120);});
    form.addEventListener('submit',async e=>{
      const r=await validarTodo(true);
      if(r.bloqueantes.length){e.preventDefault();e.stopImmediatePropagation();alert('No se puede guardar todavía:\n\n- '+r.bloqueantes.join('\n- '));}
    },true);
  }

  function programar(){clearTimeout(temporizador);temporizador=setTimeout(()=>validarTodo(false),550);}

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

  async function cargarIndice(force=false){
    if(!supabase)return [];
    if(!force&&cacheTalleres&&Date.now()-cacheEn<120000)return cacheTalleres;
    const filas=[];const paso=1000;
    for(let desde=0;;desde+=paso){
      const {data,error}=await supabase.from('talleres').select('id,nombre,telefono,ciudad,direccion,codigo_postal,provincia,activo').range(desde,desde+paso-1);
      if(error)throw error;
      filas.push(...(data||[]));
      if(!data||data.length<paso)break;
      if(desde>10000)break;
    }
    cacheTalleres=filas;cacheEn=Date.now();return filas;
  }

  async function buscarDuplicados(tel,force=false){
    const id=valor('taller-id');
    if(!supabase||!id)return {bloqueantes:[],avisos:[]};
    const nombre=valor('nombre'),ciudad=normalizarTexto(valor('ciudad')),cp=valor('codigo_postal'),direccion=normalizarTexto(valor('direccion'));
    let talleres=[];
    try{talleres=await cargarIndice(force);}catch(error){console.error('No se pudo cargar el índice de duplicados:',error);return {bloqueantes:[],avisos:['No se pudo completar la comprobación global de duplicados.']};}
    const fuertes=[],posibles=[];
    for(const t of talleres){
      if(String(t.id)===id)continue;
      const tTel=normalizarTelefono(t.telefono),tCiudad=normalizarTexto(t.ciudad),tCp=String(t.codigo_postal||'').trim(),tDir=normalizarTexto(t.direccion);
      const mismaZona=(ciudad&&tCiudad===ciudad)||(cp&&tCp===cp);
      const sim=similitudNombre(nombre,t.nombre);
      const etiqueta=`${t.nombre||'Sin nombre'}${t.ciudad?' ('+t.ciudad+')':''}`;
      if(tel&&tTel&&tel===tTel){fuertes.push(`Teléfono ya usado por ${etiqueta}.`);continue;}
      if(nombre&&sim===1&&mismaZona){fuertes.push(`Mismo nombre en la misma zona: ${etiqueta}.`);continue;}
      if(direccion&&tDir&&direccion===tDir&&mismaZona){fuertes.push(`Misma dirección en la misma zona: ${etiqueta}.`);continue;}
      if(nombre&&mismaZona&&sim>=.72)posibles.push(`Nombre muy parecido en la misma zona (${Math.round(sim*100)}%): ${etiqueta}.`);
    }
    return {bloqueantes:[...new Set(fuertes)].slice(0,10),avisos:[...new Set(posibles)].slice(0,10)};
  }

  function pintar(local,duplicados){
    const box=$('resultado-validacion');if(!box)return;
    const items=[...local.errores.map(x=>({t:x,c:'#b91c1c',i:'✕'})),...duplicados.bloqueantes.map(x=>({t:x,c:'#b91c1c',i:'✕'})),...duplicados.avisos.map(x=>({t:x,c:'#b45309',i:'⚠'})),...local.avisos.map(x=>({t:x,c:'#b45309',i:'⚠'})),...local.ok.map(x=>({t:x,c:'#15803d',i:'✓'}))];
    box.innerHTML=items.map(x=>`<div style="color:${x.c};font-size:.88rem"><strong>${x.i}</strong> ${escapar(x.t)}</div>`).join('')||'<span class="tm-status">Sin datos para validar.</span>';
  }

  async function validarTodo(force=false){
    if(!$('taller-id')?.value)return {bloqueantes:[]};
    const local=validarLocal();
    const duplicados=await buscarDuplicados(local.tel,force);
    pintar(local,duplicados);
    return {bloqueantes:[...local.errores,...duplicados.bloqueantes],avisos:[...local.avisos,...duplicados.avisos]};
  }

  document.addEventListener('tallermap:ficha-guardada',()=>{cacheTalleres=null;cacheEn=0;});
  document.addEventListener('tallermap:ficha-eliminada',()=>{cacheTalleres=null;cacheEn=0;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',construir);else construir();
}());
