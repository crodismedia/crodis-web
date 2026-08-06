(function(){
  'use strict';

  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const CAMPOS=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];
  let guardando=false;

  function valor(id){return $(id)?.value.trim()||'';}
  function normalizarUrl(v){const x=String(v||'').trim();return !x?'':/^https?:\/\//i.test(x)?x:`https://${x}`;}
  function servicios(){return valor('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horarios(){const x=valor('horarios');if(!x)return {};try{return JSON.parse(x);}catch{return {texto:x};}}
  function estado(texto,tipo='info'){
    const nodo=$('estado-ficha');if(!nodo)return;
    nodo.textContent=texto;
    nodo.style.color=tipo==='ok'?'#15803d':tipo==='error'?'#b91c1c':'#667085';
  }
  function botonGuardar(){return $('form-taller')?.querySelector('button[type="submit"]')||null;}
  function bloquear(si,nombre=''){
    const boton=botonGuardar();if(!boton)return;
    boton.disabled=si;
    boton.setAttribute('aria-busy',si?'true':'false');
    boton.textContent=si?`Guardando${nombre?` · ${nombre}`:''}…`:'Guardar en Supabase';
  }
  function mensajeError(error){
    const codigo=error?.code?` [${error.code}]`:'';
    const detalle=error?.details||error?.hint||'';
    return `${error?.message||'Error desconocido'}${codigo}${detalle?` · ${detalle}`:''}`;
  }

  async function guardar(e){
    const form=$('form-taller');
    if(!form||e.target!==form)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(guardando)return;

    const id=valor('taller-id');
    const nombre=valor('nombre')||'Taller sin nombre';
    if(!id){estado('No se puede guardar: no hay un taller seleccionado.','error');return;}
    if(!supabase){estado('No se puede guardar: Supabase no está disponible.','error');return;}

    guardando=true;bloquear(true,nombre);estado(`Guardando “${nombre}”…`);
    const payload={};
    CAMPOS.forEach(c=>payload[c]=valor(c));
    payload.web=normalizarUrl(payload.web);
    payload.servicios=servicios();
    payload.horarios=horarios();

    try{
      const {data,error}=await supabase.from('talleres').update(payload).eq('id',id).select('id,nombre').single();
      if(error)throw error;
      if(!data?.id)throw new Error('Supabase no confirmó la ficha actualizada.');
      estado(`Ficha “${data.nombre||nombre}” guardada correctamente en Supabase.`, 'ok');
      document.dispatchEvent(new CustomEvent('tallermap:ficha-guardada',{detail:{id:data.id,nombre:data.nombre||nombre}}));
      document.querySelectorAll('.tm-field-dirty').forEach(n=>{n.classList.remove('tm-field-dirty');n.classList.add('tm-field-ok');});
    }catch(error){
      console.error('Error al guardar ficha',error);
      estado(`No se pudo guardar “${nombre}”: ${mensajeError(error)}`,'error');
      document.dispatchEvent(new CustomEvent('tallermap:ficha-error',{detail:{id,nombre,error:mensajeError(error)}}));
    }finally{
      guardando=false;bloquear(false);
    }
  }

  function conectar(){
    document.addEventListener('submit',guardar,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar,{once:true});else conectar();
}());
