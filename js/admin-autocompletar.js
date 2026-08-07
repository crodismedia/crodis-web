(function(){
  'use strict';
  const supabase=window.supabaseClient;
  const $=id=>document.getElementById(id);
  let filas=[];

  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function txt(v){return String(v??'').trim();}
  function norm(v){return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}

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
    const todos=[];
    const lote=1000;
    for(let desde=0;;desde+=lote){
      const {data,error}=await supabase.from('talleres')
        .select('id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,verificado,servicios,horarios')
        .order('id',{ascending:true})
        .range(desde,desde+lote-1);
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
    const s=txt(v);
    return !s||s==='{}'||s==='[]';
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

  function metricas(todos){
    $('cola-total').textContent=todos.length.toLocaleString('es-ES');
    $('cola-pendientes').textContent=filas.length.toLocaleString('es-ES');
    $('cola-sin-telefono').textContent=filas.filter(f=>f.faltan.some(x=>x.clave==='telefono')).length.toLocaleString('es-ES');
    $('cola-sin-web').textContent=filas.filter(f=>f.faltan.some(x=>x.clave==='web')).length.toLocaleString('es-ES');
  }

  function render(){
    const termino=norm($('cola-buscar').value);
    const filtro=$('cola-filtro').value;
    const provincia=$('cola-provincia').value;
    let lista=filas.filter(t=>{
      if(provincia&&provinciaCanonica(t.provincia)!==provincia)return false;
      if(filtro!=='todas'&&!t.faltan.some(x=>x.clave===filtro))return false;
      if(!termino)return true;
      return [t.nombre,t.ciudad,t.codigo_postal,t.id].some(v=>norm(v).includes(termino));
    });
    const body=$('cola-tabla');
    body.innerHTML=lista.slice(0,300).map(t=>{
      const ubic=[t.ciudad,provinciaCanonica(t.provincia),t.codigo_postal].filter(Boolean).join(' · ')||'—';
      const faltan=t.faltan.map(x=>`<span class="admin-chip soft">${esc(x.etiqueta)}</span>`).join(' ');
      return `<tr><td><strong>${esc(t.nombre||'Sin nombre')}</strong><small>${esc(t.id)}</small></td><td>${esc(ubic)}</td><td>${faltan}</td><td><a class="admin-btn primary" href="admin-editor.html?id=${encodeURIComponent(t.id)}&cola=1">Editar</a></td></tr>`;
    }).join('')||'<tr><td colspan="4">No hay fichas con estos filtros.</td></tr>';
    $('admin-estado').textContent=lista.length>300?`Mostrando 300 de ${lista.length.toLocaleString('es-ES')} pendientes`:`${lista.length.toLocaleString('es-ES')} pendientes`;
  }

  async function cargar(){
    $('admin-estado').textContent='Cargando fichas…';
    $('cola-tabla').innerHTML='<tr><td colspan="4">Cargando…</td></tr>';
    try{
      const todos=await cargarTodos();
      filas=todos.map(evaluar).filter(t=>t.faltan.length>0).sort((a,b)=>b.faltan.length-a.faltan.length||String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
      metricas(todos);
      render();
    }catch(error){
      console.error(error);
      $('admin-estado').textContent=`Error: ${error.message||'no se pudo cargar'}`;
      $('cola-tabla').innerHTML='<tr><td colspan="4">No se pudieron cargar las fichas.</td></tr>';
    }
  }

  $('btn-recargar')?.addEventListener('click',cargar);
  $('cola-buscar')?.addEventListener('input',render);
  $('cola-filtro')?.addEventListener('change',render);
  $('cola-provincia')?.addEventListener('change',render);
  $('btn-cerrar-sesion')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});
  proteger().then(ok=>{if(ok)cargar();});
}());
