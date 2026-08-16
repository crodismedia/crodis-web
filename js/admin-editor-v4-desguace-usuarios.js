(function(){
'use strict';
const $=id=>document.getElementById(id);
const sb=window.supabaseClient;
if(!sb)return;
const state={rows:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>String(v??'').trim();
function setStatus(msg,type=''){const e=$('v4du-estado');if(!e)return;e.textContent=msg;e.className='v4-status'+(type?` ${type}`:'');}
function labelEstado(v){return ({pendiente:'Pendiente',aprobado:'Aprobado',rechazado:'Rechazado',bloqueado:'Bloqueado'})[v]||v;}
async function requireAdmin(){
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session){location.replace('admin-login.html?next=admin-editor-v4-desguace-usuarios.html');return false;}
  const check=await sb.rpc('es_administrador');
  if(check.error||!check.data){await sb.auth.signOut();location.replace('admin-login.html');return false;}
  document.body.dataset.authState='ready';return true;
}
function render(){
  const q=text($('v4du-buscar')?.value).toLowerCase();
  const filtro=$('v4du-filtro')?.value||'todos';
  const rows=state.rows.filter(r=>(filtro==='todos'||r.estado===filtro)&&(!q||[r.nombre_contacto,r.email,r.telefono,r.desguace_nombre,r.municipio,r.provincia].some(v=>text(v).toLowerCase().includes(q))));
  $('v4du-total').textContent=state.rows.length;
  $('v4du-pendientes').textContent=state.rows.filter(r=>r.estado==='pendiente').length;
  $('v4du-aprobados').textContent=state.rows.filter(r=>r.estado==='aprobado').length;
  $('v4du-bloqueados').textContent=state.rows.filter(r=>r.estado==='bloqueado').length;
  $('v4du-lista').innerHTML=rows.length?rows.map(r=>`<article class="v4-user-access" data-id="${r.id}">
    <div class="v4-user-access-head"><div><strong>${esc(r.nombre_contacto||r.email||'Usuario')}</strong><small>${esc(r.email||'Sin email')} · ${esc(r.telefono||'Sin teléfono')}</small></div><span class="v4-access-badge v4-access-${esc(r.estado)}">${esc(labelEstado(r.estado))}</span></div>
    <div class="v4-user-access-body"><p><b>Desguace:</b> ${esc(r.desguace_nombre)} · ${esc(r.municipio)} · ${esc(r.provincia)}</p><p><b>Rol:</b> ${esc(r.rol||'propietario')}</p>${r.notas_admin?`<p><b>Notas:</b> ${esc(r.notas_admin)}</p>`:''}</div>
    <div class="v4-actions"><button class="v4-btn v4-green" data-action="aprobado" type="button">Aprobar</button><button class="v4-btn v4-soft" data-action="pendiente" type="button">Pendiente</button><button class="v4-btn v4-danger" data-action="bloqueado" type="button">Bloquear</button><button class="v4-btn v4-soft" data-action="rechazado" type="button">Rechazar</button></div>
  </article>`).join(''):'<p class="v4-status">No hay usuarios con estos criterios.</p>';
}
async function load(){
  setStatus('Cargando usuarios…');
  const {data,error}=await sb.rpc('admin_listar_desguace_usuarios');
  if(error){setStatus('No se pudieron cargar los usuarios: '+error.message,'error');return;}
  state.rows=data||[];render();setStatus(`${state.rows.length} registros de acceso cargados.`,'ok');
}
async function change(id,estado){
  const row=state.rows.find(r=>r.id===id);if(!row)return;
  let notas=row.notas_admin||'';
  if(estado==='rechazado'||estado==='bloqueado')notas=prompt('Nota administrativa opcional:',notas)||notas;
  const verbo=estado==='aprobado'?'aprobar':estado==='bloqueado'?'bloquear':estado==='rechazado'?'rechazar':'devolver a pendiente';
  if(!confirm(`¿Quieres ${verbo} el acceso de ${row.nombre_contacto||row.email||'este usuario'} a ${row.desguace_nombre}?`))return;
  setStatus('Actualizando acceso…');
  const {error}=await sb.rpc('admin_cambiar_estado_desguace_usuario',{p_id:id,p_estado:estado,p_notas:notas||null});
  if(error){setStatus('No se pudo actualizar: '+error.message,'error');return;}
  await load();setStatus('✓ Estado de acceso actualizado.','ok');
}
async function init(){
  const root=$('v4du-lista');if(!root)return;
  if(!await requireAdmin())return;
  $('v4du-recargar')?.addEventListener('click',load);$('v4du-buscar')?.addEventListener('input',render);$('v4du-filtro')?.addEventListener('change',render);
  $('v4du-logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.replace('admin-login.html');});
  root.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');const card=e.target.closest('[data-id]');if(btn&&card)change(card.dataset.id,btn.dataset.action);});
  await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
