(function(){
  'use strict';

  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  let ultimoTaller='';

  function escapar(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function fecha(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return v||'';}}
  function nombreCampo(v){return ({nombre:'Nombre',telefono:'Teléfono',web:'Web',direccion:'Dirección',codigo_postal:'Código postal',ciudad:'Población',provincia:'Provincia',servicios:'Servicios',horarios:'Horarios',descripcion:'Descripción',fotos:'Fotografías',activo:'Estado',verificado:'Verificación'}[v]||v);}

  function construir(){
    const form=$('form-taller');
    if(!form||$('historial-actividad'))return;
    const bloque=document.createElement('section');
    bloque.id='historial-actividad';
    bloque.className='tm-field full';
    bloque.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <label>Registro de actividad</label>
        <button id="btn-recargar-historial" type="button" class="tm-btn tm-btn-soft">Actualizar historial</button>
      </div>
      <div id="lista-historial" style="display:grid;gap:8px">
        <p class="tm-empty">Selecciona un taller para consultar su historial.</p>
      </div>`;
    const savebar=form.querySelector('.tm-savebar');
    form.insertBefore(bloque,savebar||null);
    $('btn-recargar-historial').addEventListener('click',cargar);
  }

  function detalleCambio(item){
    const campos=Array.isArray(item.campos_modificados)?item.campos_modificados:[];
    if(!campos.length)return '';
    return campos.slice(0,8).map(c=>nombreCampo(c)).join(' · ')+(campos.length>8?' · …':'');
  }

  async function cargar(){
    const tallerId=$('taller-id')?.value||'';
    const lista=$('lista-historial');
    if(!lista||!supabase)return;
    ultimoTaller=tallerId;
    if(!tallerId){lista.innerHTML='<p class="tm-empty">Selecciona un taller para consultar su historial.</p>';return;}
    lista.innerHTML='<p class="tm-empty">Cargando historial…</p>';
    const {data,error}=await supabase
      .from('registro_actividad')
      .select('id,usuario_id,accion,origen,campos_modificados,creado_at')
      .eq('taller_id',tallerId)
      .order('creado_at',{ascending:false})
      .limit(20);
    if(error){lista.innerHTML=`<p class="tm-empty">El historial todavía no está disponible: ${escapar(error.message)}</p>`;return;}
    if(!data?.length){lista.innerHTML='<p class="tm-empty">No hay movimientos registrados para este taller.</p>';return;}
    lista.innerHTML=data.map(item=>`
      <article style="border:1px solid #dfe3e8;border-radius:12px;padding:10px;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <strong>${escapar(item.accion.replaceAll('_',' '))}</strong>
          <time style="color:#667085;font-size:.84rem">${escapar(fecha(item.creado_at))}</time>
        </div>
        <div style="margin-top:5px;color:#475467;font-size:.88rem">${escapar(detalleCambio(item)||'Sin detalle de campos')}</div>
        <small style="display:block;margin-top:5px;color:#98a2b3">${item.usuario_id?`Usuario: ${escapar(item.usuario_id)}`:'Acción del sistema'} · ${escapar(item.origen||'base_datos')}</small>
      </article>`).join('');
  }

  function conectar(){
    construir();
    document.addEventListener('click',e=>{
      if(e.target.closest('.tm-result'))setTimeout(cargar,50);
    });
    const estado=$('estado-ficha');
    if(estado)new MutationObserver(()=>{
      if(/guardada correctamente/i.test(estado.textContent||''))setTimeout(cargar,150);
    }).observe(estado,{childList:true,characterData:true,subtree:true});
    setInterval(()=>{
      const actual=$('taller-id')?.value||'';
      if(actual&&actual!==ultimoTaller)cargar();
    },1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar);else conectar();
}());
