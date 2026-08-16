(function(){
"use strict";
const $=id=>document.getElementById(id);
const sb=window.supabaseClient;
if(!sb){console.error('Supabase no disponible');return;}
const PROVINCIAS={"Alicante/Alacant":"03","Castellón/Castelló":"12","Valencia/València":"46"};
const state={municipios:[],talleres:[],servicios:[],actual:null,seleccionados:new Set(),soloIncompletos:false};
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const incomplete=t=>!text(t.telefono)||!text(t.direccion)||!text(t.codigo_postal)||!text(t.ciudad)||!Array.isArray(t.servicios)||!t.servicios.length||!t.horarios;
const score=t=>{const checks=[t.nombre,t.telefono,t.web,t.direccion,t.codigo_postal,t.ciudad,t.provincia,t.descripcion,Array.isArray(t.servicios)&&t.servicios.length,t.horarios];return Math.round(checks.filter(Boolean).length/checks.length*100);};
function setStatus(msg,type=''){const el=$('v4-estado');if(!el)return;el.textContent=msg;el.className='v4-status'+(type?` ${type}`:'');}
function setTerritoryStatus(msg,type=''){const el=$('v4-territorio-estado');el.textContent=msg;el.className='v4-status'+(type?` ${type}`:'');}
async function requireAdmin(){
  const next='admin-login.html?next=admin-editor-v4.html';
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session){location.replace(next);return false;}
  const check=await sb.rpc('es_administrador');
  if(check.error||!check.data){await sb.auth.signOut();location.replace(next);return false;}
  document.body.dataset.authState='ready';
  return true;
}
async function loadServicios(){
  const {data,error}=await sb.from('servicios').select('slug,nombre,categoria,orden').eq('activo',true).order('orden',{ascending:true}).order('nombre',{ascending:true}).limit(500);
  if(error)throw error;
  state.servicios=data||[];
  renderServicios([]);
}
function renderServicios(selected){
  const set=new Set(selected||[]),groups=new Map();
  for(const s of state.servicios){const g=text(s.categoria)||'Otros';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(s);}
  $('v4-servicios').innerHTML=[...groups.entries()].map(([g,items])=>`<section><strong>${esc(g)}</strong><div class="v4-services">${items.map(s=>`<label class="v4-service"><input type="checkbox" name="v4-servicio" value="${esc(s.slug)}" ${set.has(s.slug)?'checked':''}><span>${esc(s.nombre)}</span></label>`).join('')}</div></section>`).join('');
}
function selectedServicios(){return [...document.querySelectorAll('input[name="v4-servicio"]:checked')].map(x=>x.value);}
async function loadMunicipios(){
  const provincia=$('v4-provincia').value,code=PROVINCIAS[provincia];
  $('v4-municipio').disabled=true;$('v4-cargar').disabled=true;$('v4-nuevo').disabled=true;
  $('v4-municipio').innerHTML='<option value="">Seleccionar municipio…</option>';
  if(!code){state.municipios=[];return;}
  setTerritoryStatus('Cargando municipios…');
  const {data,error}=await sb.from('municipios').select('nombre,codigo_municipal,activo').eq('activo',true).like('codigo_municipal',`${code}%`).order('nombre',{ascending:true}).limit(2000);
  if(error)throw error;
  state.municipios=(data||[]).map(m=>({...m,provincia}));
  $('v4-municipio').innerHTML='<option value="">Seleccionar municipio…</option>'+state.municipios.map(m=>`<option value="${esc(m.nombre)}">${esc(m.nombre)}</option>`).join('');
  $('v4-municipios-lista').innerHTML=state.municipios.map(m=>`<option value="${esc(m.nombre)}"></option>`).join('');
  $('v4-municipio').disabled=false;
  setTerritoryStatus(`${state.municipios.length} municipios disponibles.`,'ok');
}
function municipioActual(){return state.municipios.find(m=>m.nombre===$('v4-municipio').value)||null;}
async function loadTalleres(){
  const m=municipioActual();if(!m)return;
  setTerritoryStatus('Cargando talleres…');
  let all=[],desde=0,total=null;
  do{
    const {data,error}=await sb.rpc('buscar_talleres_municipio',{p_codigo_municipal:m.codigo_municipal,p_servicio:'',p_desde:desde,p_limite:100});
    if(error)throw error;
    const page=data||[];
    if(total===null)total=page.length?Number(page[0].total_resultados||page.length):0;
    all.push(...page);desde+=page.length;
    if(!page.length||page.length<100)break;
  }while(total===null||all.length<total);
  state.talleres=all;state.actual=null;state.seleccionados.clear();
  $('v4-form').hidden=true;$('v4-vacio').hidden=false;
  renderLista();
  setTerritoryStatus(all.length?`${all.length} talleres cargados en ${m.nombre}.`:`No hay talleres en ${m.nombre}. Puedes crear el primero.`,'ok');
}
function renderLista(){
  const rows=state.soloIncompletos?state.talleres.filter(incomplete):state.talleres;
  $('v4-total').textContent=state.talleres.length;
  $('v4-pendientes').textContent=state.talleres.filter(incomplete).length;
  $('v4-seleccionados').textContent=state.seleccionados.size;
  $('v4-borrar').disabled=!state.seleccionados.size;
  $('v4-lista').innerHTML=rows.length?rows.map(t=>`<div class="v4-item ${state.actual?.id===t.id?'active':''}" data-id="${t.id}"><input class="v4-pick" type="checkbox" ${state.seleccionados.has(t.id)?'checked':''}><button class="v4-open" type="button"><strong>${esc(t.nombre)}</strong><small>${esc(t.direccion||'Sin dirección')} · ${esc(t.telefono||'Sin teléfono')}</small></button><span class="v4-score">${score(t)}%</span></div>`).join(''):'<p class="v4-status">No hay fichas en este filtro.</p>';
}
function fillField(id,value){$(id).value=value??'';}
async function openTaller(id){
  setStatus('Cargando ficha…');
  const {data,error}=await sb.rpc('admin_obtener_taller_editor_v4',{p_taller_id:id});
  if(error)throw error;
  const t=data?.[0];if(!t)throw new Error('No se ha encontrado la ficha.');
  state.actual=t;
  const idx=state.talleres.findIndex(x=>x.id===id);if(idx>=0)state.talleres[idx]={...state.talleres[idx],...t};
  fillField('v4-id',t.id);fillField('v4-nombre',t.nombre);fillField('v4-telefono',t.telefono);fillField('v4-web',t.web);fillField('v4-direccion',t.direccion);fillField('v4-cp',t.codigo_postal);fillField('v4-ciudad',t.ciudad);fillField('v4-provincia-ficha',t.provincia);fillField('v4-motivo',t.motivo_cierre_temporal);fillField('v4-reapertura',t.fecha_reapertura_prevista);fillField('v4-tipo',t.tipo_negocio||'taller');fillField('v4-marcas',t.marcas_servicio_oficial);fillField('v4-descripcion',t.descripcion);
  $('v4-cerrado').value=String(!!t.cerrado_temporalmente);$('v4-oficial').value=String(!!t.servicio_oficial);
  renderServicios(t.servicios||[]);window.TallerMapHorariosV4?.cargar(t.horarios||null);
  $('v4-form').hidden=false;$('v4-vacio').hidden=true;
  validateTerritory();updateConditionalFields();updatePublicButton();renderLista();setStatus('Ficha cargada.');
}
function newTaller(){
  const m=municipioActual(),provincia=$('v4-provincia').value;if(!m)return;
  state.actual={id:null,nuevo:true,slug:'',ciudad:m.nombre,provincia};
  $('v4-form').reset();
  ['v4-id','v4-nombre','v4-telefono','v4-web','v4-direccion','v4-cp','v4-motivo','v4-reapertura','v4-marcas','v4-descripcion'].forEach(id=>fillField(id,''));
  fillField('v4-ciudad',m.nombre);fillField('v4-provincia-ficha',provincia);$('v4-cerrado').value='false';$('v4-oficial').value='false';$('v4-tipo').value='taller';
  renderServicios([]);window.TallerMapHorariosV4?.cargar(null);
  $('v4-form').hidden=false;$('v4-vacio').hidden=true;validateTerritory();updateConditionalFields();updatePublicButton();renderLista();setStatus('Nueva ficha preparada. Completa los datos y guarda.');$('v4-nombre').focus();
}
function validateTerritory(){
  const cp=text($('v4-cp').value),city=text($('v4-ciudad').value),prov=text($('v4-provincia-ficha').value),code=PROVINCIAS[prov]||'';
  const m=state.municipios.find(x=>x.nombre.split('/').some(a=>norm(a)===norm(city))||norm(x.nombre)===norm(city));
  const ok=!!m&&/^\d{5}$/.test(cp)&&cp.slice(0,2)===code&&String(m.codigo_municipal).slice(0,2)===code;
  for(const id of ['v4-cp','v4-ciudad','v4-provincia-ficha']){$(id).classList.toggle('v4-valid',ok);$(id).classList.toggle('v4-invalid',!ok&&!!text($(id).value));}
  const e=$('v4-validacion-territorio');e.textContent=ok?`✓ Ubicación válida: ${m.nombre} · ${prov} · ${cp}`:'Ubicación pendiente o no coincidente con el catálogo.';e.className='v4-status v4-full '+(ok?'ok':'error');return ok;
}
function updateConditionalFields(){const cerrado=$('v4-cerrado').value==='true';$('v4-motivo').disabled=!cerrado;$('v4-reapertura').disabled=!cerrado;const oficial=$('v4-oficial').value==='true';$('v4-marcas').disabled=!oficial;}
function scheduleValue(){const r=window.TallerMapHorariosV4?.obtener();if(!r)return null;if(!r.valido)throw new Error(r.mensaje);return r.valor;}
function payload(){return{p_taller_id:text($('v4-id').value)||null,p_nombre:text($('v4-nombre').value),p_telefono:text($('v4-telefono').value)||null,p_web:text($('v4-web').value)||null,p_direccion:text($('v4-direccion').value)||null,p_codigo_postal:text($('v4-cp').value),p_ciudad:text($('v4-ciudad').value),p_provincia:text($('v4-provincia-ficha').value),p_descripcion:$('v4-descripcion').value||null,p_servicios:selectedServicios(),p_horarios:scheduleValue(),p_cerrado_temporalmente:$('v4-cerrado').value==='true',p_motivo_cierre_temporal:text($('v4-motivo').value)||null,p_fecha_reapertura_prevista:$('v4-reapertura').value||null,p_tipo_negocio:$('v4-tipo').value,p_servicio_oficial:$('v4-oficial').value==='true',p_marcas_servicio_oficial:text($('v4-marcas').value)||null};}
async function save(next=false){
  if(!state.actual)return false;
  if(!text($('v4-nombre').value)){setStatus('Falta el nombre.','error');return false;}
  if(!validateTerritory()){setStatus('No se guarda: revisa municipio, provincia y código postal.','error');return false;}
  try{
    setStatus(state.actual.nuevo?'Creando taller…':'Guardando ficha…');
    const p=payload();
    if(state.actual.nuevo){const {p_taller_id,...createPayload}=p;const r=await sb.rpc('admin_crear_taller_editor_v4',createPayload);if(r.error)throw r.error;state.actual.id=r.data;state.actual.nuevo=false;fillField('v4-id',r.data);}else{const r=await sb.rpc('admin_actualizar_taller_editor_v4',p);if(r.error)throw r.error;}
    const refreshed=await sb.rpc('admin_obtener_taller_editor_v4',{p_taller_id:state.actual.id});if(refreshed.error)throw refreshed.error;
    if(refreshed.data?.[0]){const t=refreshed.data[0],idx=state.talleres.findIndex(x=>x.id===t.id);state.actual=t;if(idx>=0)state.talleres[idx]={...state.talleres[idx],...t};else state.talleres.unshift(t);}
    renderLista();updatePublicButton();setStatus('✓ Ficha guardada correctamente.','ok');
    if(next)await openNext();return true;
  }catch(e){setStatus('No se pudo guardar: '+(e.message||e),'error');return false;}
}
async function openNext(){const rows=state.seleccionados.size?state.talleres.filter(t=>state.seleccionados.has(t.id)):state.talleres;const i=rows.findIndex(t=>t.id===state.actual?.id);if(i>=0&&rows[i+1])await openTaller(rows[i+1].id);}
function updatePublicButton(){const b=$('v4-publica'),slug=text(state.actual?.slug);b.disabled=!slug;b.dataset.url=slug?`https://www.tallermap.es/talleres/${encodeURIComponent(slug)}`:'';}
function maps(){const q=[$('v4-nombre').value,$('v4-direccion').value,$('v4-cp').value,$('v4-ciudad').value,$('v4-provincia-ficha').value].filter(Boolean).join(', ');window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener');}
async function borrarSeleccionados(){const ids=[...state.seleccionados];if(!ids.length)return;if(ids.length>100){setTerritoryStatus('Solo se pueden borrar hasta 100 fichas de una vez.','error');return;}if(!confirm(`Vas a borrar permanentemente ${ids.length} ficha(s). Esta acción no se puede deshacer. ¿Continuar?`))return;const r=await sb.rpc('admin_borrar_talleres_editor_v4',{p_taller_ids:ids});if(r.error){setTerritoryStatus('No se pudo borrar: '+r.error.message,'error');return;}setTerritoryStatus(`✓ ${r.data} ficha(s) borrada(s).`,'ok');await loadTalleres();}
function exportCSV(){const rows=state.talleres.filter(t=>state.seleccionados.has(t.id));if(!rows.length){setTerritoryStatus('Selecciona al menos un taller para exportar.','error');return;}const cols=['id','nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','slug'];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv='\ufeff'+[cols.join(';'),...rows.map(r=>cols.map(c=>q(r[c])).join(';'))].join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tallermap-${norm($('v4-municipio').value).replace(/ /g,'-')||'talleres'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function wire(){
  $('v4-provincia').addEventListener('change',()=>loadMunicipios().catch(e=>setTerritoryStatus(e.message,'error')));
  $('v4-municipio').addEventListener('change',()=>{$('v4-cargar').disabled=!$('v4-municipio').value;$('v4-nuevo').disabled=!$('v4-municipio').value;});
  $('v4-cargar').addEventListener('click',()=>loadTalleres().catch(e=>setTerritoryStatus(e.message,'error')));
  $('v4-nuevo').addEventListener('click',newTaller);
  $('v4-incompletos').addEventListener('click',()=>{state.soloIncompletos=!state.soloIncompletos;$('v4-incompletos').textContent=state.soloIncompletos?'Mostrar todos':'Solo incompletos';renderLista();});
  $('v4-lista').addEventListener('click',e=>{const row=e.target.closest('.v4-item');if(!row)return;const id=row.dataset.id;if(e.target.classList.contains('v4-pick')){e.target.checked?state.seleccionados.add(id):state.seleccionados.delete(id);renderLista();return;}if(e.target.closest('.v4-open'))openTaller(id).catch(err=>setStatus(err.message,'error'));});
  $('v4-seleccionar-todos').addEventListener('click',()=>{for(const t of state.talleres)state.seleccionados.add(t.id);renderLista();});
  $('v4-limpiar').addEventListener('click',()=>{state.seleccionados.clear();renderLista();});
  $('v4-borrar').addEventListener('click',borrarSeleccionados);
  $('v4-exportar').addEventListener('click',exportCSV);
  $('v4-form').addEventListener('submit',e=>{e.preventDefault();save(false);});
  $('v4-guardar-siguiente').addEventListener('click',()=>save(true));
  $('v4-cp').addEventListener('input',validateTerritory);$('v4-ciudad').addEventListener('input',validateTerritory);
  $('v4-cerrado').addEventListener('change',updateConditionalFields);$('v4-oficial').addEventListener('change',updateConditionalFields);
  $('v4-maps').addEventListener('click',maps);$('v4-publica').addEventListener('click',()=>{const u=$('v4-publica').dataset.url;if(u)window.open(u,'_blank','noopener');});
  $('v4-logout').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('admin-login.html');});
}
document.addEventListener('DOMContentLoaded',async()=>{try{if(!await requireAdmin())return;wire();await loadServicios();}catch(e){document.body.dataset.authState='ready';setTerritoryStatus('Error al iniciar el editor: '+(e.message||e),'error');}});
}());
