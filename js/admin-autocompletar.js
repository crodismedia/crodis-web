(function(){
  'use strict';
  const supabase=window.supabaseClient;
  const $=id=>document.getElementById(id);
  const CLAVE_LOTE='tm_lote_revision';
  let filas=[];
  let procesando=false;
  let detener=false;

  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function txt(v){return String(v??'').trim();}
  function norm(v){return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function digitos(v){return txt(v).replace(/\D/g,'');}
  function tamanoLote(){return Math.max(1,Math.min(100,Number($('lote-tamano')?.value||50)));}

  async function proteger(){
    if(!supabase){$('admin-estado').textContent='Sin conexión';return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace('admin-login.html');return false;}
    const {data:admin,error}=await supabase.rpc('es_administrador');
    if(error||!admin){await supabase.auth.signOut();location.replace('admin-login.html');return false;}
    $('admin-usuario').textContent=session.user?.email||'Administrador';
    $('admin-estado').textContent='Acceso verificado';
    return true;
  }

  async function cargarTodos(){
    const todos=[];const lote=1000;
    for(let desde=0;;desde+=lote){
      const {data,error}=await supabase.from('talleres')
        .select('id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,verificado,servicios,horarios')
        .order('id',{ascending:true}).range(desde,desde+lote-1);
      if(error)throw error;
      todos.push(...(data||[]));
      if(!data||data.length<lote)break;
    }
    return todos;
  }

  function vacioComplejo(v){
    if(v==null)return true;
    if(Array.isArray(v))return v.length===0;
    if(typeof v==='object')return Object.keys(v).length===0;
    const s=txt(v);return !s||s==='{}'||s==='[]';
  }

  function evaluar(t){
    const faltan=[];
    if(!txt(t.telefono))faltan.push({clave:'telefono',etiqueta:'Teléfono'});
    if(!txt(t.web))faltan.push({clave:'web',etiqueta:'Web'});
    if(!txt(t.direccion))faltan.push({clave:'direccion',etiqueta:'Dirección'});
    if(!txt(t.codigo_postal))faltan.push({clave:'codigo_postal',etiqueta:'Código postal'});
    if(!txt(t.ciudad))faltan.push({clave:'ciudad',etiqueta:'Población'});
    if(!txt(t.provincia))faltan.push({clave:'provincia',etiqueta:'Provincia'});
    if(vacioComplejo(t.horarios))faltan.push({clave:'horarios',etiqueta:'Horario'});
    if(vacioComplejo(t.servicios))faltan.push({clave:'servicios',etiqueta:'Servicios'});
    if(t.verificado!==true)faltan.push({clave:'verificado',etiqueta:'Sin verificar'});
    return {...t,faltan};
  }

  function provinciaCanonica(v){
    const p=norm(v);
    if(p.includes('alicante')||p.includes('alacant'))return 'Alicante';
    if(p.includes('castellon')||p.includes('castello'))return 'Castellón';
    if(p.includes('valencia'))return 'Valencia';
    return txt(v);
  }

  function provinciaPorCp(cp){
    const p=digitos(cp).slice(0,2);
    if(p==='03')return 'Alicante';
    if(p==='12')return 'Castellón';
    if(p==='46')return 'Valencia';
    return '';
  }

  function cambiosSeguros(t){
    const cambios={};
    const cp=digitos(t.codigo_postal);
    if(!txt(t.provincia)&&cp.length===5){const provincia=provinciaPorCp(cp);if(provincia)cambios.provincia=provincia;}
    const tel=digitos(t.telefono);
    if(txt(t.telefono)&&tel.length===9&&txt(t.telefono)!==tel)cambios.telefono=tel;
    const web=txt(t.web);
    if(web&&!/^https?:\/\//i.test(web)&&/^[^\s]+\.[a-z]{2,}(?:\/.*)?$/i.test(web))cambios.web=`https://${web}`;
    return cambios;
  }

  function metricas(todos){
    $('cola-total').textContent=todos.length.toLocaleString('es-ES');
    $('cola-pendientes').textContent=filas.length.toLocaleString('es-ES');
    $('cola-sin-telefono').textContent=filas.filter(f=>f.faltan.some(x=>x.clave==='telefono')).length.toLocaleString('es-ES');
    $('cola-sin-web').textContent=filas.filter(f=>f.faltan.some(x=>x.clave==='web')).length.toLocaleString('es-ES');
  }

  function listaFiltrada(){
    const termino=norm($('cola-buscar').value);
    const filtro=$('cola-filtro').value;
    const provincia=$('cola-provincia').value;
    return filas.filter(t=>{
      if(provincia&&provinciaCanonica(t.provincia)!==provincia)return false;
      if(filtro!=='todas'&&!t.faltan.some(x=>x.clave===filtro))return false;
      if(!termino)return true;
      return [t.nombre,t.ciudad,t.codigo_postal,t.id].some(v=>norm(v).includes(termino));
    });
  }

  function render(){
    const lista=listaFiltrada();
    const body=$('cola-tabla');
    body.innerHTML=lista.slice(0,300).map(t=>{
      const ubic=[t.ciudad,provinciaCanonica(t.provincia),t.codigo_postal].filter(Boolean).join(' · ')||'—';
      const faltan=t.faltan.map(x=>`<span class="admin-chip soft">${esc(x.etiqueta)}</span>`).join(' ');
      return `<tr><td><strong>${esc(t.nombre||'Sin nombre')}</strong><small>${esc(t.id)}</small></td><td>${esc(ubic)}</td><td>${faltan}</td><td><a class="admin-btn primary" href="admin-editor.html?id=${encodeURIComponent(t.id)}&cola=1">Editar</a></td></tr>`;
    }).join('')||'<tr><td colspan="4">No hay fichas con estos filtros.</td></tr>';
    if(!procesando)$('admin-estado').textContent=lista.length>300?`Mostrando 300 de ${lista.length.toLocaleString('es-ES')} pendientes`:`${lista.length.toLocaleString('es-ES')} pendientes`;
  }

  function iniciarRevisionLote(){
    const lista=listaFiltrada().slice(0,tamanoLote());
    if(!lista.length){alert('No hay fichas pendientes con los filtros actuales.');return;}
    const lote={
      ids:lista.map(x=>String(x.id)),
      indice:0,
      creadas:0,
      omitidas:0,
      creado:Date.now(),
      origen:'admin-autocompletar.html'
    };
    localStorage.setItem(CLAVE_LOTE,JSON.stringify(lote));
    location.href=`admin-editor.html?id=${encodeURIComponent(lote.ids[0])}&lote=1`;
  }

  function bloquearLote(activo){
    procesando=activo;
    ['btn-recargar','btn-revisar-lote','btn-lote-seguro','lote-tamano','cola-buscar','cola-filtro','cola-provincia'].forEach(id=>{const el=$(id);if(el)el.disabled=activo;});
    if($('btn-detener-lote'))$('btn-detener-lote').hidden=!activo;
    if($('lote-progreso'))$('lote-progreso').hidden=!activo;
  }

  function progreso(actual,total,texto){
    const porcentaje=total?Math.round(actual*100/total):0;
    if($('lote-barra'))$('lote-barra').value=porcentaje;
    if($('lote-estado'))$('lote-estado').textContent=texto;
  }

  async function fichaActual(id){
    const {data,error}=await supabase.from('talleres').select('id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia').eq('id',id).maybeSingle();
    if(error)throw error;return data;
  }

  async function aplicarLoteSeguro(){
    if(procesando)return;
    const candidatos=listaFiltrada().slice(0,tamanoLote());
    if(!candidatos.length){alert('No hay fichas en el lote actual.');return;}
    const previstos=candidatos.filter(t=>Object.keys(cambiosSeguros(t)).length>0);
    if(!previstos.length){alert('En este lote no hay normalizaciones automáticas seguras. Usa “Revisar lote” para completar datos manualmente.');return;}
    if(!confirm(`Se revisarán ${candidatos.length} fichas y solo se modificarán campos seguros en ${previstos.length} de ellas.\n\nNo se inventarán teléfonos, webs, horarios ni servicios. ¿Continuar?`))return;

    detener=false;bloquearLote(true);
    let actualizadas=0,omitidas=0,errores=0;
    try{
      for(let i=0;i<candidatos.length;i++){
        if(detener)break;
        const item=candidatos[i];
        progreso(i,candidatos.length,`Procesando ${i+1} de ${candidatos.length} · actualizadas ${actualizadas} · omitidas ${omitidas}`);
        try{
          const actual=await fichaActual(item.id);
          if(!actual){omitidas++;continue;}
          const cambios=cambiosSeguros(actual);
          if(!Object.keys(cambios).length){omitidas++;continue;}
          const {error}=await supabase.rpc('aplicar_autocompletado_seguro_admin',{p_taller_id:actual.id,p_cambios:cambios});
          if(error)throw error;
          actualizadas++;
        }catch(error){
          console.error('Error en lote seguro',item.id,error);errores++;break;
        }
      }
      progreso(candidatos.length,candidatos.length,`Finalizado · ${actualizadas} actualizadas · ${omitidas} omitidas · ${errores} errores${detener?' · detenido':''}`);
      await cargar();
      alert(`Lote terminado.\n\nActualizadas: ${actualizadas}\nOmitidas: ${omitidas}\nErrores: ${errores}${detener?'\nProceso detenido por el administrador.':''}`);
    }finally{
      bloquearLote(false);
    }
  }

  async function cargar(){
    if(procesando)return;
    $('admin-estado').textContent='Cargando fichas…';
    $('cola-tabla').innerHTML='<tr><td colspan="4">Cargando…</td></tr>';
    try{
      const todos=await cargarTodos();
      filas=todos.map(evaluar).filter(t=>t.faltan.length>0).sort((a,b)=>b.faltan.length-a.faltan.length||String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
      metricas(todos);render();
    }catch(error){
      console.error(error);$('admin-estado').textContent=`Error: ${error.message||'no se pudo cargar'}`;
      $('cola-tabla').innerHTML='<tr><td colspan="4">No se pudieron cargar las fichas.</td></tr>';
    }
  }

  $('btn-recargar')?.addEventListener('click',cargar);
  $('cola-buscar')?.addEventListener('input',render);
  $('cola-filtro')?.addEventListener('change',render);
  $('cola-provincia')?.addEventListener('change',render);
  $('btn-revisar-lote')?.addEventListener('click',iniciarRevisionLote);
  $('btn-lote-seguro')?.addEventListener('click',aplicarLoteSeguro);
  $('btn-detener-lote')?.addEventListener('click',()=>{detener=true;$('lote-estado').textContent='Deteniendo al terminar la ficha actual…';});
  $('btn-cerrar-sesion')?.addEventListener('click',async()=>{if(procesando)return;await supabase.auth.signOut();location.replace('admin-login.html');});
  proteger().then(ok=>{if(ok)cargar();});
}());