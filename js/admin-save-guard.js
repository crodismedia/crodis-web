(function(){
  'use strict';

  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const CAMPOS=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];
  let guardando=false;

  function valor(id){return $(id)?.value.trim()||'';}
  function normalizarUrl(v){const x=String(v||'').trim();return !x?'':/^https?:\/\//i.test(x)?x:`https://${x}`;}
  function servicios(){return valor('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horarios(){
    const x=valor('horarios');
    if(!x)return null;
    try{
      const dato=JSON.parse(x);
      if(!dato||typeof dato!=='object'||Array.isArray(dato)||!Object.keys(dato).length)return null;
      if(dato['miércoles']&&!dato.miercoles)dato.miercoles=dato['miércoles'];
      if(dato['sábado']&&!dato.sabado)dato.sabado=dato['sábado'];
      delete dato['miércoles'];
      delete dato['sábado'];
      return dato;
    }catch{
      return null;
    }
  }
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
      const {data:actual,error:errorLectura}=await supabase
        .from('talleres')
        .select('fotos,verificado,activo')
        .eq('id',id)
        .single();
      if(errorLectura)throw errorLectura;

      const {data:idGuardado,error}=await supabase.rpc('admin_guardar_taller_opcional',{
        p_taller_id:id,
        p_nombre:payload.nombre,
        p_propietario:null,
        p_cif:null,
        p_email:null,
        p_telefono:payload.telefono||null,
        p_web:payload.web||null,
        p_direccion:payload.direccion||null,
        p_codigo_postal:payload.codigo_postal||null,
        p_ciudad:payload.ciudad||null,
        p_provincia:payload.provincia||null,
        p_horarios:payload.horarios,
        p_servicios:payload.servicios,
        p_fotos:Array.isArray(actual?.fotos)?actual.fotos:[],
        p_descripcion:payload.descripcion||null,
        p_verificado:Boolean(actual?.verificado),
        p_activo:actual?.activo!==false
      });
      if(error)throw error;
      if(!idGuardado)throw new Error('Supabase no confirmó la ficha actualizada.');
      estado(`Ficha “${nombre}” guardada correctamente en Supabase.`, 'ok');
      document.dispatchEvent(new CustomEvent('tallermap:ficha-guardada',{detail:{id:idGuardado,nombre}}));
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
