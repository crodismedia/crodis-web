(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sb = window.supabaseClient;
  if (!sb) { console.error('Supabase no disponible'); return; }

  const state = { talleres: [], municipios: [], actual: null, seleccionados: new Set(), guardados: new Set(), soloIncompletos: false };
  const servicios = [
    ['Mecánica y mantenimiento',[['🔧','mecanica-general','Mecánica general'],['🛢️','cambio-aceite','Cambio de aceite'],['⚙️','embrague','Embrague'],['⛓️','distribucion','Distribución'],['🛑','frenos','Frenos'],['🔋','baterias','Baterías']]],
    ['Diagnosis y electricidad',[['⚡','electricidad','Electricidad'],['🖥️','diagnosis','Diagnosis electrónica'],['💡','iluminacion','Iluminación']]],
    ['Ruedas y suspensión',[['🛞','neumaticos','Neumáticos'],['🧭','alineacion','Alineación'],['🚗','suspension','Suspensión']]],
    ['Carrocería',[['🎨','chapa-pintura','Chapa y pintura'],['🪟','lunas','Lunas y cristales']]],
    ['Climatización',[['❄️','aire-acondicionado','Aire acondicionado']]],
    ['Vehículos y asistencia',[['🚘','vehiculos-segunda-mano','Venta de vehículos de segunda mano'],['🚚','grua-asistencia','Servicio de grúa'],['🧽','lavado-coches','Lavado de coches'],['🏢','concesionario','Concesionario'],['⭐','concesionario-oficial','Concesionario oficial']]]
  ];

  const text = v => String(v ?? '').trim();
  const slug = s => text(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const incomplete = t => !text(t.telefono) || !text(t.web) || !text(t.direccion) || !text(t.codigo_postal) || !text(t.ciudad) || !Array.isArray(t.servicios) || !t.servicios.length || !t.horarios || !text(t.descripcion);
  const score = t => { const checks=[t.nombre,t.telefono,t.web,t.direccion,t.codigo_postal,t.ciudad,t.provincia,t.descripcion,Array.isArray(t.servicios)&&t.servicios.length,t.horarios]; return Math.round(checks.filter(Boolean).length/checks.length*100); };
  const status = (msg, ok=false, err=false) => { const el=$('v4-estado'); if(!el)return; el.textContent=msg; el.className='v4-status'+(ok?' ok':'')+(err?' error':''); };

  function renderServicios(selected=[]) {
    const set=new Set(selected||[]); $('v4-servicios').innerHTML=servicios.map(([g,items])=>`<div class="v4-service-group"><h3>${esc(g)}</h3><div class="v4-service-grid">${items.map(([i,v,n])=>`<label class="v4-service"><span class="v4-icon">${i}</span><input type="checkbox" name="v4-servicio" value="${v}" ${set.has(v)?'checked':''}> <span>${esc(n)}</span></label>`).join('')}</div></div>`).join('');
  }
  function selectedServicios(){ return [...document.querySelectorAll('input[name="v4-servicio"]:checked')].map(x=>x.value); }

  async function auth(){ const {data:{session}}=await sb.auth.getSession(); if(!session){ location.href='admin.html'; return false; } return true; }
  async function loadProvincias(){
    const {data,error}=await sb.from('municipios').select('provincia').not('provincia','is',null).limit(10000); if(error) throw error;
    const arr=[...new Set((data||[]).map(x=>text(x.provincia)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    $('v4-provincia').innerHTML='<option value="">Seleccionar provincia…</option>'+arr.map(x=>`<option>${esc(x)}</option>`).join('');
  }
  async function loadMunicipios(){
    const p=$('v4-provincia').value; $('v4-municipio').disabled=true; $('v4-cargar-municipio').disabled=true;
    if(!p)return;
    const {data,error}=await sb.from('municipios').select('*').eq('provincia',p).order('nombre',{ascending:true}).limit(2000); if(error) throw error;
    state.municipios=data||[]; $('v4-municipio').innerHTML='<option value="">Seleccionar municipio…</option>'+state.municipios.map(m=>`<option value="${esc(m.nombre)}">${esc(m.nombre)}</option>`).join('');
    $('v4-municipios-lista').innerHTML=state.municipios.map(m=>`<option value="${esc(m.nombre)}"></option>`).join(''); $('v4-municipio').disabled=false;
  }
  async function loadTalleres(){
    const city=$('v4-municipio').value, prov=$('v4-provincia').value; if(!city)return;
    $('v4-territorio-estado').textContent='Cargando talleres…';
    const {data,error}=await sb.from('talleres').select('*').eq('ciudad',city).eq('provincia',prov).order('nombre',{ascending:true}).limit(1000); if(error) throw error;
    state.talleres=data||[]; state.seleccionados.clear(); state.guardados.clear(); state.actual=null; renderLista();
    $('v4-territorio-estado').textContent=`${state.talleres.length} talleres cargados en ${city}.`;
  }
  function renderLista(){
    const rows=state.soloIncompletos?state.talleres.filter(incomplete):state.talleres;
    $('v4-total').textContent=state.talleres.length; $('v4-incompletos').textContent=state.talleres.filter(incomplete).length; $('v4-seleccionados').textContent=state.seleccionados.size; $('v4-guardados').textContent=state.guardados.size;
    $('v4-lista').innerHTML=rows.map(t=>`<div class="v4-item ${state.actual?.id===t.id?'active':''}" data-id="${t.id}"><input class="v4-pick" type="checkbox" ${state.seleccionados.has(t.id)?'checked':''}><button type="button" class="v4-open" style="all:unset;cursor:pointer"><strong>${esc(t.nombre)}</strong><small>${esc(t.direccion||'Sin dirección')}</small></button><span class="v4-score">${score(t)}%</span></div>`).join('');
  }
  function openTaller(id){ const t=state.talleres.find(x=>x.id===id); if(!t)return; state.actual=t; $('v4-form').hidden=false; $('v4-vacio').hidden=true;
    const map={ 'v4-id':t.id,'v4-nombre':t.nombre,'v4-telefono':t.telefono,'v4-web':t.web,'v4-direccion':t.direccion,'v4-cp':t.codigo_postal,'v4-ciudad':t.ciudad,'v4-provincia-ficha':t.provincia,'v4-descripcion':t.descripcion,'v4-motivo-cierre':t.motivo_cierre_temporal,'v4-reapertura':t.fecha_reapertura_prevista,'v4-tipo-negocio':t.tipo_negocio||'taller','v4-marcas-servicio-oficial':t.marcas_servicio_oficial };
    Object.entries(map).forEach(([k,v])=>$(k).value=v??''); $('v4-cerrado-temporal').value=String(!!t.cerrado_temporalmente); $('v4-servicio-oficial').value=String(!!t.servicio_oficial); $('v4-horarios').value=t.horarios?JSON.stringify(t.horarios,null,2):''; renderServicios(t.servicios); validateTerritory(); renderLista(); updatePublicButton();
  }
  function validateTerritory(){ const cp=text($('v4-cp').value), city=text($('v4-ciudad').value), prov=text($('v4-provincia-ficha').value); const m=state.municipios.find(x=>text(x.nombre).toLocaleLowerCase('es')===city.toLocaleLowerCase('es'));
    let ok=!!m && (!text(m.codigo_postal)||text(m.codigo_postal)===cp) && text(m.provincia)===prov; ['v4-cp','v4-ciudad','v4-provincia-ficha'].forEach(id=>{ $(id).classList.toggle('v4-valid',ok); $(id).classList.toggle('v4-invalid',!ok&&!!text($(id).value)); }); const e=$('v4-validacion-territorio'); e.textContent=ok?'✓ Ubicación validada en TallerMap':'Ubicación pendiente o no coincidente con el catálogo.'; e.className='v4-status v4-full '+(ok?'ok':'error'); return ok;
  }
  function payload(){ let horarios=null; if(text($('v4-horarios').value)) horarios=JSON.parse($('v4-horarios').value); return {p_taller_id:$('v4-id').value,p_nombre:$('v4-nombre').value,p_telefono:$('v4-telefono').value,p_web:$('v4-web').value,p_direccion:$('v4-direccion').value,p_codigo_postal:$('v4-cp').value,p_ciudad:$('v4-ciudad').value,p_provincia:$('v4-provincia-ficha').value,p_descripcion:$('v4-descripcion').value,p_servicios:selectedServicios(),p_horarios:horarios,p_cerrado_temporalmente:$('v4-cerrado-temporal').value==='true',p_motivo_cierre_temporal:$('v4-motivo-cierre').value||null,p_fecha_reapertura_prevista:$('v4-reapertura').value||null,p_tipo_negocio:$('v4-tipo-negocio').value,p_servicio_oficial:$('v4-servicio-oficial').value==='true',p_marcas_servicio_oficial:$('v4-marcas-servicio-oficial').value||null}; }
  async function saveCurrent(next=false){ if(!state.actual)return false; if(!validateTerritory()){status('No guardado: ubicación sin validar.',false,true);return false;} try{status('Guardando…'); const {error}=await sb.rpc('admin_actualizar_taller_editor_v4',payload()); if(error)throw error; state.guardados.add(state.actual.id); Object.assign(state.actual,{nombre:$('v4-nombre').value,telefono:$('v4-telefono').value,web:$('v4-web').value,direccion:$('v4-direccion').value,codigo_postal:$('v4-cp').value,ciudad:$('v4-ciudad').value,provincia:$('v4-provincia-ficha').value,descripcion:$('v4-descripcion').value,servicios:selectedServicios()}); status('✓ Ficha guardada correctamente.',true); renderLista(); updatePublicButton(); if(next) openNext(); return true;}catch(e){status(`No se pudo guardar: ${e.message||e}`,false,true);return false;} }
  function openNext(){ const rows=state.talleres; const i=rows.findIndex(x=>x.id===state.actual?.id); if(i>=0&&rows[i+1])openTaller(rows[i+1].id); }
  function updatePublicButton(){ const b=$('v4-ver-publica'); if(!state.actual){b.disabled=true;return;} b.disabled=false; b.dataset.url=`https://www.tallermap.es/talleres/${slug($('v4-nombre').value)}-${String(state.actual.id).slice(0,8)}`; }
  function maps(){ const q=[$('v4-nombre').value,$('v4-direccion').value,$('v4-cp').value,$('v4-ciudad').value,$('v4-provincia-ficha').value].filter(Boolean).join(', '); window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q),'_blank','noopener'); }
  function exportCSV(){ const rows=state.talleres.filter(t=>state.seleccionados.has(t.id)||state.guardados.has(t.id)); if(!rows.length){status('Selecciona talleres para exportar.',false,true);return;} const cols=['id','nombre','direccion','codigo_postal','ciudad','provincia','telefono','web','descripcion']; const csv=[cols.join(';'),...rows.map(r=>cols.map(c=>'"'+String(r[c]??'').replace(/"/g,'""')+'"').join(';'))].join('\r\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})); a.download=`tallermap-${slug($('v4-municipio').value||'lote')}.csv`; a.click(); URL.revokeObjectURL(a.href); }
  async function saveBatch(){ const ids=[...state.seleccionados]; if(!ids.length){status('Selecciona al menos un taller.',false,true);return;} status(`Lote preparado: ${ids.length}. Guarda cada ficha validada para evitar sobrescribir datos no revisados.`,true); if(!state.actual||!state.seleccionados.has(state.actual.id)) openTaller(ids[0]); }

  document.addEventListener('click',e=>{ const item=e.target.closest('.v4-item'); if(item&&e.target.closest('.v4-open'))openTaller(item.dataset.id); });
  document.addEventListener('change',e=>{ if(e.target.classList.contains('v4-pick')){ const id=e.target.closest('.v4-item').dataset.id; e.target.checked?state.seleccionados.add(id):state.seleccionados.delete(id); renderLista(); }});
  $('v4-provincia').addEventListener('change',()=>loadMunicipios().catch(e=>$('v4-territorio-estado').textContent=e.message)); $('v4-municipio').addEventListener('change',()=>{$('v4-cargar-municipio').disabled=!$('v4-municipio').value;}); $('v4-cargar-municipio').addEventListener('click',()=>loadTalleres().catch(e=>$('v4-territorio-estado').textContent=e.message));
  $('v4-solo-incompletos').addEventListener('click',()=>{state.soloIncompletos=!state.soloIncompletos; $('v4-solo-incompletos').textContent=state.soloIncompletos?'Ver todos':'Solo incompletos';renderLista();});
  $('v4-seleccionar-todos').addEventListener('click',()=>{state.talleres.forEach(t=>state.seleccionados.add(t.id));renderLista();}); $('v4-limpiar-seleccion').addEventListener('click',()=>{state.seleccionados.clear();renderLista();});
  $('v4-form').addEventListener('submit',e=>{e.preventDefault();saveCurrent(false);}); $('v4-guardar-siguiente').addEventListener('click',()=>saveCurrent(true)); $('v4-maps').addEventListener('click',maps); $('v4-ver-publica').addEventListener('click',()=>window.open($('v4-ver-publica').dataset.url,'_blank','noopener')); $('v4-exportar-csv').addEventListener('click',exportCSV); $('v4-guardar-lote').addEventListener('click',saveBatch);
  ['v4-cp','v4-ciudad'].forEach(id=>$(id).addEventListener('input',validateTerritory)); $('v4-nombre').addEventListener('input',updatePublicButton); $('v4-logout').addEventListener('click',async()=>{await sb.auth.signOut();location.href='admin.html';});
  (async()=>{try{if(!await auth())return;renderServicios([]);await loadProvincias();}catch(e){console.error(e);$('v4-territorio-estado').textContent='Error inicial: '+(e.message||e);}})();
})();