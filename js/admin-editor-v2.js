(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const form=$('form-taller');
  const resultados=$('resultados-talleres');
  const campos=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];
  const editables=[...campos,'servicios','horarios'];
  let originales={};

  function valor(id){return String($(id)?.value||'').trim();}
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function msg(t,ok=false){$('estado-ficha').textContent=t;$('estado-ficha').style.color=ok?'#15803d':'#667085';}
  function urlWeb(v){const x=String(v||'').trim();return !x?'':/^https?:\/\//i.test(x)?x:`https://${x}`;}
  function consultaActual(){return [valor('nombre'),valor('direccion'),valor('codigo_postal'),valor('ciudad'),valor('provincia')].filter(Boolean).join(' ');}

  function consultaModulo(base,modulo){
    if(modulo==='oficial')return `${base} sitio oficial taller`;
    if(modulo==='contacto')return `${base} teléfono email contacto`;
    if(modulo==='social')return `${base} (site:facebook.com OR site:instagram.com OR site:linkedin.com)`;
    return base;
  }

  function activarModulo(modulo){
    $('modulo-busqueda').value=modulo;
    document.querySelectorAll('[data-modulo]').forEach(b=>b.classList.toggle('active',b.dataset.modulo===modulo));
    $('resultados-web').hidden=false;$('mapa-panel').hidden=true;
  }

  async function buscarWeb(){
    const base=valor('busqueda-web')||consultaActual();
    if(base.length<2){$('estado-busqueda-web').textContent='Escribe al menos 2 caracteres.';return;}
    const modulo=$('modulo-busqueda').value;
    activarModulo(modulo);
    const q=consultaModulo(base,modulo);
    $('estado-busqueda-web').textContent='Buscando en la web…';
    $('resultados-web').innerHTML='<div class="tm-empty">Buscando…</div>';
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Sesión caducada');
      const r=await fetch(`/api/busqueda-web?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'No se pudo buscar');
      const lista=data.resultados||[];
      $('estado-busqueda-web').textContent=`${lista.length} resultados · ${data.fuente||'web'}`;
      $('resultados-web').innerHTML=lista.length?lista.map((x,i)=>`<article class="tm-web-card" data-web="${i}"><strong>${esc(x.titulo||x.url)}</strong><span class="tm-web-url">${esc(x.url)}</span><p>${esc(x.descripcion||'Sin descripción disponible.')}</p><div class="tm-web-actions"><button type="button" class="tm-btn tm-btn-soft" data-copiar="${i}">Copiar URL</button><button type="button" class="tm-btn tm-btn-soft" data-usar-web="${i}">Usar como web</button><button type="button" class="tm-btn tm-btn-soft" data-buscar-dominio="${i}">Buscar dominio</button></div></article>`).join(''):'<div class="tm-empty">No se encontraron resultados.</div>';
      $('resultados-web').querySelectorAll('[data-copiar]').forEach(b=>b.addEventListener('click',async()=>{const x=lista[Number(b.dataset.copiar)];try{await navigator.clipboard.writeText(x.url);$('estado-busqueda-web').textContent='URL copiada.';}catch{}}));
      $('resultados-web').querySelectorAll('[data-usar-web]').forEach(b=>b.addEventListener('click',()=>{const x=lista[Number(b.dataset.usarWeb)];if(!$('web'))return;if(!$('web').value||confirm(`Sustituir la web actual por:\n${x.url}`)){$('web').value=x.url;$('web').dispatchEvent(new Event('input',{bubbles:true}));msg('Web preparada. Revisa y guarda la ficha.',true);}}));
      $('resultados-web').querySelectorAll('[data-buscar-dominio]').forEach(b=>b.addEventListener('click',()=>{const x=lista[Number(b.dataset.buscarDominio)];try{$('busqueda-web').value=new URL(x.url).hostname.replace(/^www\./,'');$('modulo-busqueda').value='general';buscarWeb();}catch{}}));
    }catch(error){
      console.error(error);
      $('estado-busqueda-web').textContent=error.message||'Error de búsqueda';
      $('resultados-web').innerHTML='<div class="tm-empty">No se pudo completar la búsqueda.</div>';
    }
  }

  function abrirMaps(){
    const q=valor('busqueda-web')||consultaActual();
    if(!q)return;
    $('resultados-web').hidden=true;$('mapa-panel').hidden=false;
    $('visor-maps').src=`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    document.querySelectorAll('[data-modulo]').forEach(b=>b.classList.remove('active'));
    $('estado-busqueda-web').textContent='Google Maps · ubicación de la búsqueda actual';
  }

  async function proteger(){
    if(!supabase){msg('Sin conexión con Supabase.');return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace('admin-login.html');return false;}
    const {data:admin,error}=await supabase.rpc('es_administrador');
    if(error||!admin){await supabase.auth.signOut();location.replace('admin-login.html');return false;}
    $('estado-acceso-admin').textContent='Acceso verificado';return true;
  }

  async function buscar(){
    const termino=valor('buscar-taller');
    if(termino.length<2){resultados.innerHTML='';msg('Escribe al menos 2 caracteres y pulsa Buscar.');return;}
    resultados.innerHTML='<div class="tm-result">Buscando…</div>';
    const seguro=termino.replace(/[,%().]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    const {data,error}=await supabase.from('talleres').select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios').or(`nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,ciudad.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`).order('nombre').limit(25);
    if(error){resultados.innerHTML='';msg(`Error al consultar: ${error.message}`);return;}
    resultados.innerHTML=(data||[]).map((t,i)=>`<button type="button" class="tm-result" data-i="${i}"><strong>${esc(t.nombre||'Sin nombre')}</strong><span>${esc(t.telefono||'')} · ${esc(t.ciudad||'')} ${esc(t.codigo_postal||'')}</span></button>`).join('')||'<div class="tm-result">No hay resultados.</div>';
    resultados.querySelectorAll('[data-i]').forEach(btn=>btn.addEventListener('click',()=>cargar(data[Number(btn.dataset.i)])));
  }

  function cargar(t){
    $('taller-id').value=t.id;
    campos.forEach(c=>$(c).value=t[c]??'');
    $('servicios').value=Array.isArray(t.servicios)?t.servicios.join('\n'):(t.servicios??'');
    $('horarios').value=typeof t.horarios==='string'?t.horarios:JSON.stringify(t.horarios??{},null,2);
    originales=Object.fromEntries(editables.map(id=>[id,valor(id)]));
    form.hidden=false;resultados.innerHTML='';
    editables.forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));
    $('busqueda-web').value=consultaActual();
    $('estado-busqueda-web').textContent='Búsqueda preparada para esta ficha. Pulsa Buscar.';
    $('resultados-web').hidden=false;$('mapa-panel').hidden=true;
    msg(`Editando: ${t.nombre}`,true);
  }

  function serviciosPayload(){return valor('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horariosPayload(){const txt=valor('horarios');if(!txt)return {};try{return JSON.parse(txt);}catch{return {texto:txt};}}

  async function guardar(e){
    e.preventDefault();const id=valor('taller-id');if(!id)return;
    const payload={};campos.forEach(c=>payload[c]=valor(c));payload.web=urlWeb(payload.web);payload.servicios=serviciosPayload();payload.horarios=horariosPayload();
    msg('Guardando cambios…');
    const {error}=await supabase.from('talleres').update(payload).eq('id',id);
    if(error){msg(`No se pudo guardar: ${error.message}`);return;}
    originales=Object.fromEntries(editables.map(id=>[id,valor(id)]));msg('Ficha guardada correctamente en Supabase.',true);
    if(new URLSearchParams(location.search).get('cola')==='1'){
      const bar=form.querySelector('.tm-savebar');
      if(bar&&!document.getElementById('btn-volver-cola')){
        const volver=document.createElement('a');volver.id='btn-volver-cola';volver.className='tm-btn tm-btn-soft';volver.href='admin-autocompletar.html';volver.textContent='Volver a pendientes';bar.prepend(volver);
      }
    }
  }

  $('btn-busqueda-web')?.addEventListener('click',buscarWeb);
  $('busqueda-web')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();buscarWeb();}});
  $('modulo-busqueda')?.addEventListener('change',e=>activarModulo(e.target.value));
  document.querySelectorAll('[data-modulo]').forEach(b=>b.addEventListener('click',()=>{activarModulo(b.dataset.modulo);buscarWeb();}));
  $('btn-maps')?.addEventListener('click',abrirMaps);
  $('btn-buscar')?.addEventListener('click',buscar);
  $('buscar-taller')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();buscar();}});
  $('buscar-taller')?.addEventListener('input',()=>{if(valor('buscar-taller').length<2)resultados.innerHTML='';});
  form?.addEventListener('submit',guardar);
  $('boton-cerrar-sesion')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});

  proteger().then(ok=>{
    if(!ok)return;
    const id=new URLSearchParams(location.search).get('id');
    if(id){$('buscar-taller').value=id;supabase.from('talleres').select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios').eq('id',id).maybeSingle().then(({data})=>{if(data)cargar(data);});}
  });
}());