(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const escape=(v)=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fecha=(v)=>v?new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
  let cargando=false;

  async function proteger(){
    if(!supabase){$('admin-estado').textContent='Sin conexión';return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace('admin-login.html');return false;}
    const {data:admin,error}=await supabase.rpc('es_administrador');
    if(error||!admin){await supabase.auth.signOut();location.replace('admin-login.html');return false;}
    $('admin-usuario').textContent=session.user.email||'Administrador';
    $('admin-estado').textContent='Acceso verificado';
    return true;
  }

  async function contar(estado){
    const {count,error}=await supabase.from('reclamaciones_taller').select('id',{count:'exact',head:true}).eq('estado',estado);
    return error?null:count;
  }

  async function metricas(){
    const [p,a,r,v]=await Promise.all([contar('pendiente'),contar('aprobada'),contar('rechazada'),contar('revocada')]);
    $('claim-pending').textContent=p??'—';
    $('claim-approved').textContent=a??'—';
    $('claim-rejected').textContent=r??'—';
    $('claim-revoked').textContent=v??'—';
  }

  function etiquetaEstado(v){
    const clase=v==='aprobada'?'ok':v==='pendiente'?'warn':'bad';
    return `<span class="admin-badge ${clase}">${escape(v)}</span>`;
  }

  function accionesFila(r){
    if(r.estado==='pendiente'){
      return `<div class="admin-row-actions"><button class="admin-btn primary" data-approve="${r.id}" type="button">Aprobar</button><button class="admin-btn" data-reject="${r.id}" type="button">Rechazar</button></div>`;
    }
    if(r.estado==='aprobada'){
      return `<div class="admin-row-actions"><button class="admin-btn" data-revoke="${r.id}" type="button">Revocar acceso</button></div>`;
    }
    return '—';
  }

  function render(rows){
    const body=$('claim-table');
    if(!rows.length){body.innerHTML='<tr><td colspan="7">No hay reclamaciones con este filtro.</td></tr>';return;}
    body.innerHTML=rows.map(r=>{
      const t=r.talleres||{};
      const taller=[t.nombre,t.ciudad,t.provincia].filter(Boolean).join(' · ');
      const info=[r.telefono?`Tel: ${r.telefono}`:'',r.mensaje||''].filter(Boolean).join(' — ');
      return `<tr><td><strong>${escape(taller||r.taller_id)}</strong></td><td>${escape(r.nombre_solicitante)}<br><small>${escape(r.email)}</small></td><td>${escape(r.relacion)}</td><td>${escape(info||'—')}</td><td>${etiquetaEstado(r.estado)}</td><td>${escape(fecha(r.created_at))}</td><td>${accionesFila(r)}</td></tr>`;
    }).join('');
    body.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>resolver(b.dataset.approve,true)));
    body.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>resolver(b.dataset.reject,false)));
    body.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',()=>revocar(b.dataset.revoke)));
  }

  async function cargar(){
    if(cargando)return;cargando=true;$('claim-table').innerHTML='<tr><td colspan="7">Cargando…</td></tr>';
    let q=supabase.from('reclamaciones_taller').select('id,taller_id,usuario_id,email,nombre_solicitante,telefono,relacion,mensaje,estado,created_at,reviewed_at,revoked_at,talleres(nombre,ciudad,provincia)').order('created_at',{ascending:false}).limit(200);
    const filtro=$('claim-filter').value;if(filtro!=='todas')q=q.eq('estado',filtro);
    const {data,error}=await q;cargando=false;
    if(error){$('claim-table').innerHTML=`<tr><td colspan="7">Error: ${escape(error.message)}</td></tr>`;return;}
    render(data||[]);
  }

  async function resolver(id,aprobar){
    const texto=aprobar?'aprobar esta reclamación y asociar el taller a la cuenta':'rechazar esta reclamación';
    if(!confirm(`¿Quieres ${texto}?`))return;
    $('admin-estado').textContent=aprobar?'Aprobando reclamación…':'Rechazando reclamación…';
    const {data,error}=await supabase.rpc('resolver_reclamacion_taller',{p_reclamacion_id:id,p_aprobar:aprobar});
    if(error){$('admin-estado').textContent=`Error: ${error.message}`;return;}
    $('admin-estado').textContent=`Reclamación ${data|| (aprobar?'aprobada':'rechazada')}`;
    await Promise.all([metricas(),cargar()]);
  }

  async function revocar(id){
    if(!confirm('¿Quieres revocar el acceso de este propietario? La reclamación quedará en el historial como revocada.'))return;
    $('admin-estado').textContent='Revocando acceso…';
    const {data,error}=await supabase.rpc('revocar_reclamacion_taller',{p_reclamacion_id:id});
    if(error){$('admin-estado').textContent=`Error: ${error.message}`;return;}
    $('admin-estado').textContent=`Acceso ${data||'revocado'}`;
    await Promise.all([metricas(),cargar()]);
  }

  $('btn-recargar')?.addEventListener('click',()=>Promise.all([metricas(),cargar()]));
  $('claim-filter')?.addEventListener('change',cargar);
  $('btn-cerrar-sesion')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});

  proteger().then(ok=>{if(ok)Promise.all([metricas(),cargar()]);});
}());
