(function(){
'use strict';
const $=id=>document.getElementById(id);
const sb=window.supabaseClient;
if(!sb)return;
const state={rows:[],actual:null};
const text=v=>String(v??'').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(msg,type=''){const e=$('v4d-estado');if(!e)return;e.textContent=msg;e.className='v4-status'+(type?` ${type}`:'');}
function listStatus(msg,type=''){const e=$('v4d-lista-estado');e.textContent=msg;e.className='v4-status'+(type?` ${type}`:'');}
async function requireAdmin(){
  const next='admin-login.html?next=admin-editor-v4-desguaces.html';
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session){location.replace(next);return false;}
  const check=await sb.rpc('es_administrador');
  if(check.error||!check.data){await sb.auth.signOut();location.replace(next);return false;}
  document.body.dataset.authState='ready';return true;
}
function render(){
  const q=text($('v4d-buscar').value).toLowerCase();
  const rows=state.rows.filter(r=>!q||[r.nombre,r.municipio,r.provincia,r.telefono].some(v=>text(v).toLowerCase().includes(q)));
  $('v4d-total').textContent=state.rows.length;
  $('v4d-activos').textContent=state.rows.filter(r=>r.activo).length;
  $('v4d-verificados').textContent=state.rows.filter(r=>r.verificado).length;
  $('v4d-lista').innerHTML=rows.length?rows.map(r=>`<div class="v4-item ${state.actual?.id===r.id?'active':''}" data-id="${r.id}"><button class="v4d-open" type="button"><strong>${esc(r.nombre)}</strong><small>${esc(r.municipio)} · ${esc(r.provincia)} · ${esc(r.telefono||'Sin teléfono')}</small></button><span class="v4-score">${r.activo?'Activo':'Inactivo'}</span></div>`).join(''):'<p class="v4-status">No hay fichas.</p>';
}
async function load(){
  listStatus('Cargando desguaces…');
  const {data,error}=await sb.rpc('admin_listar_desguaces');
  if(error){listStatus('No se pudieron cargar: '+error.message,'error');return;}
  state.rows=data||[];render();listStatus(`${state.rows.length} fichas cargadas.`,'ok');
}
function fill(id,v){$(id).value=v??'';}
function openRow(id){
  const r=state.rows.find(x=>x.id===id);if(!r)return;
  state.actual=r;fill('v4d-id',r.id);fill('v4d-nombre',r.nombre);fill('v4d-telefono',r.telefono);fill('v4d-web',r.web);fill('v4d-direccion',r.direccion);fill('v4d-cp',r.codigo_postal);fill('v4d-municipio',r.municipio);fill('v4d-provincia',r.provincia);fill('v4d-slug',r.slug);fill('v4d-maps-url',r.google_maps_url);fill('v4d-servicios',(r.servicios||[]).join(', '));fill('v4d-descripcion',r.descripcion);$('v4d-activo').value=String(r.activo!==false);$('v4d-verificado').value=String(!!r.verificado);window.TallerMapHorariosV4?.cargar(r.horarios||null);$('v4d-form').hidden=false;$('v4d-vacio').hidden=true;render();status('Ficha cargada.');
}
function fresh(){
  state.actual={id:null};$('v4d-form').reset();fill('v4d-id','');$('v4d-activo').value='true';$('v4d-verificado').value='false';window.TallerMapHorariosV4?.cargar(null);$('v4d-form').hidden=false;$('v4d-vacio').hidden=true;render();status('Nueva ficha preparada.');$('v4d-nombre').focus();
}
function schedule(){const r=window.TallerMapHorariosV4?.obtener();if(!r)return null;if(!r.valido)throw new Error(r.mensaje);return r.valor;}
function payload(){return{
  nombre:text($('v4d-nombre').value),telefono:text($('v4d-telefono').value)||null,web:text($('v4d-web').value)||null,direccion:text($('v4d-direccion').value)||null,codigo_postal:text($('v4d-cp').value)||null,municipio:text($('v4d-municipio').value),provincia:text($('v4d-provincia').value),slug:text($('v4d-slug').value)||null,google_maps_url:text($('v4d-maps-url').value)||null,servicios:text($('v4d-servicios').value).split(',').map(x=>x.trim()).filter(Boolean),horarios:schedule(),descripcion:$('v4d-descripcion').value||null,activo:$('v4d-activo').value==='true',verificado:$('v4d-verificado').value==='true'};}
async function save(ev){
  ev?.preventDefault();
  if(!text($('v4d-nombre').value)||!text($('v4d-municipio').value)||!text($('v4d-provincia').value)){status('Nombre, municipio y provincia son obligatorios.','error');return;}
  try{status('Guardando…');const p_id=text($('v4d-id').value)||null;const {data,error}=await sb.rpc('admin_guardar_desguace',{p_id,p_datos:payload()});if(error)throw error;state.actual=data;await load();if(data?.id)openRow(data.id);status('✓ Ficha guardada en Supabase.','ok');}catch(e){status('No se pudo guardar: '+(e.message||e),'error');}
}
async function remove(){
  const id=text($('v4d-id').value);if(!id){status('La ficha todavía no está guardada.','error');return;}
  if(!confirm('Vas a eliminar definitivamente esta ficha de desguace. ¿Continuar?'))return;
  const {data,error}=await sb.rpc('admin_eliminar_desguace',{p_id:id});if(error){status('No se pudo eliminar: '+error.message,'error');return;}if(!data){status('No se encontró la ficha.','error');return;}state.actual=null;$('v4d-form').hidden=true;$('v4d-vacio').hidden=false;await load();listStatus('✓ Ficha eliminada de Supabase.','ok');
}
function maps(){const url=text($('v4d-maps-url').value);if(url){window.open(url,'_blank','noopener');return;}const q=[$('v4d-nombre').value,$('v4d-direccion').value,$('v4d-cp').value,$('v4d-municipio').value,$('v4d-provincia').value].filter(Boolean).join(', ');window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener');}
async function init(){
  if(!await requireAdmin())return;
  $('v4d-recargar').addEventListener('click',load);$('v4d-nuevo').addEventListener('click',fresh);$('v4d-buscar').addEventListener('input',render);$('v4d-form').addEventListener('submit',save);$('v4d-eliminar').addEventListener('click',remove);$('v4d-maps').addEventListener('click',maps);$('v4d-lista').addEventListener('click',e=>{const row=e.target.closest('[data-id]');if(row)openRow(row.dataset.id);});$('v4d-logout').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('admin-login.html');});await load();
}
init().catch(e=>{console.error(e);listStatus('Error: '+(e.message||e),'error');});
})();
