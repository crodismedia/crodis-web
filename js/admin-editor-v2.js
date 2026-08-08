(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const form=$('form-taller');
  const resultados=$('resultados-talleres');
  const botonEliminar=$('btn-eliminar-ficha');
  const campos=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];
  const editables=[...campos,'servicios','horarios'];
  let originales={};

  function valor(id){return String($(id)?.value||'').trim();}
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function msg(t,ok=false){if(!$('estado-ficha'))return;$('estado-ficha').textContent=t;$('estado-ficha').style.color=ok?'#15803d':'#667085';}
  function urlWeb(v){const x=String(v||'').trim();return !x?'':/^https?:\/\//i.test(x)?x:`https://${x}`;}

  function retirarDelLote(id){
    try{
      const clave='tm_lote_revision';
      const lote=JSON.parse(localStorage.getItem(clave)||'null');
      if(!lote||!Array.isArray(lote.ids))return;
      const indice=lote.ids.indexOf(id);
      if(indice<0)return;
      lote.ids.splice(indice,1);
      lote.indice=Math.max(0,Math.min(indice,lote.ids.length-1));
      lote.eliminadas=(Number(lote.eliminadas)||0)+1;
      if(lote.ids.length)localStorage.setItem(clave,JSON.stringify(lote));
      else localStorage.removeItem(clave);
    }catch(error){
      console.error('No se pudo actualizar el lote después de eliminar:',error);
    }
  }

  async function eliminarFicha(){
    const id=valor('taller-id');
    if(!id||!botonEliminar)return;

    const nombre=valor('nombre')||'esta ficha';
    if(!window.confirm(`Vas a eliminar permanentemente la ficha “${nombre}”. Esta acción no se puede deshacer. ¿Continuar?`))return;

    const confirmacion=window.prompt('Para confirmar la eliminación, escribe ELIMINAR:');
    if(String(confirmacion||'').trim().toUpperCase()!=='ELIMINAR'){
      msg('Eliminación cancelada. La ficha no se ha modificado.');
      return;
    }

    const botonGuardar=form?.querySelector('button[type="submit"]');
    botonEliminar.disabled=true;
    if(botonGuardar)botonGuardar.disabled=true;
    msg('Eliminando ficha de Supabase…');

    const {data,error}=await supabase
      .from('talleres')
      .delete()
      .eq('id',id)
      .select('id')
      .maybeSingle();

    if(error){
      botonEliminar.disabled=false;
      if(botonGuardar)botonGuardar.disabled=false;
      msg(`No se pudo eliminar: ${error.message}`);
      return;
    }

    if(!data?.id){
      botonEliminar.disabled=false;
      if(botonGuardar)botonGuardar.disabled=false;
      msg('No se eliminó la ficha. Comprueba el permiso de eliminación en Supabase.');
      return;
    }

    retirarDelLote(id);
    document.dispatchEvent(new CustomEvent('tallermap:ficha-eliminada',{detail:{id,nombre}}));
    msg(`Ficha “${nombre}” eliminada correctamente. Volviendo a Pendientes…`,true);
    setTimeout(()=>location.replace('admin-autocompletar.html'),700);
  }

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
    if(botonEliminar)botonEliminar.disabled=false;
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
  botonEliminar?.addEventListener('click',eliminarFicha);
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