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
  function msg(t,ok=false){if(!$('estado-ficha'))return;$('estado-ficha').textContent=t;$('estado-ficha').style.color=ok?'#15803d':'#667085';}
  function urlWeb(v){const x=String(v||'').trim();return !x?'':/^https?:\/\//i.test(x)?x:`https://${x}`;}

  async function proteger(){
    if(!supabase){msg('Sin conexión con Supabase.');return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace('admin-login.html');return false;}
    const {data:admin,error}=await supabase.rpc('es_administrador');
    if(error||!admin){await supabase.auth.signOut();location.replace('admin-login.html');return false;}
    if($('estado-acceso-admin'))$('estado-acceso-admin').textContent='Acceso verificado';
    return true;
  }

  async function buscar(){
    const termino=valor('buscar-taller');
    if(termino.length<2){resultados.innerHTML='';msg('Escribe al menos 2 caracteres y pulsa Buscar.');return;}
    resultados.innerHTML='<div class="tm-result">Buscando…</div>';
    const seguro=termino.replace(/[,%().]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    const {data,error}=await supabase.from('talleres')
      .select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios')
      .or(`nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,ciudad.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`)
      .order('nombre')
      .limit(25);
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
    form.hidden=false;
    resultados.innerHTML='';
    editables.forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));
    msg(`Editando: ${t.nombre}`,true);
  }

  function serviciosPayload(){return valor('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horariosPayload(){const txt=valor('horarios');if(!txt)return {};try{return JSON.parse(txt);}catch{return {texto:txt};}}

  async function guardar(e){
    e.preventDefault();
    const id=valor('taller-id');
    if(!id)return;
    const payload={};
    campos.forEach(c=>payload[c]=valor(c));
    payload.web=urlWeb(payload.web);
    payload.servicios=serviciosPayload();
    payload.horarios=horariosPayload();
    msg('Guardando cambios…');
    const {error}=await supabase.from('talleres').update(payload).eq('id',id);
    if(error){msg(`No se pudo guardar: ${error.message}`);return;}
    originales=Object.fromEntries(editables.map(id=>[id,valor(id)]));
    msg('Ficha guardada correctamente en Supabase.',true);
    if(new URLSearchParams(location.search).get('cola')==='1'){
      const bar=form.querySelector('.tm-savebar');
      if(bar&&!document.getElementById('btn-volver-cola')){
        const volver=document.createElement('a');
        volver.id='btn-volver-cola';volver.className='tm-btn tm-btn-soft';volver.href='admin-autocompletar.html';volver.textContent='Volver a pendientes';bar.prepend(volver);
      }
    }
  }

  $('btn-buscar')?.addEventListener('click',buscar);
  $('buscar-taller')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();buscar();}});
  $('buscar-taller')?.addEventListener('input',()=>{if(valor('buscar-taller').length<2)resultados.innerHTML='';});
  form?.addEventListener('submit',guardar);
  $('boton-cerrar-sesion')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});

  proteger().then(ok=>{
    if(!ok)return;
    const id=new URLSearchParams(location.search).get('id');
    if(id){
      $('buscar-taller').value=id;
      supabase.from('talleres')
        .select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios')
        .eq('id',id)
        .maybeSingle()
        .then(({data,error})=>{if(error)msg(`Error al abrir la ficha: ${error.message}`);else if(data)cargar(data);else msg('No se encontró la ficha solicitada.');});
    }
  });
}());