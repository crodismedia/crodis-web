(function(){
'use strict';
const $=id=>document.getElementById(id);
const sb=window.supabaseClient;
if(!sb)return;
const PROVINCIAS={
  'alicante':'Alicante/Alacant','alacant':'Alicante/Alacant','alicante alacant':'Alicante/Alacant',
  'castellon':'Castellón/Castelló','castello':'Castellón/Castelló','castellon castello':'Castellón/Castelló',
  'valencia':'Valencia/València','valencia valencia':'Valencia/València','valència':'Valencia/València'
};
const PREF={'Alicante/Alacant':'03','Castellón/Castelló':'12','Valencia/València':'46'};
const state={items:[],validas:[],servicios:[],revisado:false};
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(msg,type=''){const e=$('v4-csv-estado');if(!e)return;e.textContent=msg;e.className='v4-status'+(type?' '+type:'');}
function parseCSV(raw){
  raw=String(raw||'').replace(/^\uFEFF/,'');
  const first=raw.split(/\r?\n/,1)[0]||'';
  const d=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
  const out=[];let row=[],cell='',q=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i],n=raw[i+1];
    if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;}
    else if(c===d&&!q){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(v=>text(v)))out.push(row);row=[];}
    else cell+=c;
  }
  row.push(cell);if(row.some(v=>text(v)))out.push(row);return out;
}
function header(v){
  const h=norm(v).replace(/ /g,'_');
  const a={
    nombre:'nombre',taller:'nombre',empresa:'nombre',telefono:'telefono',tel:'telefono',web:'web',url:'web',
    direccion:'direccion',domicilio:'direccion',codigo_postal:'codigo_postal',cp:'codigo_postal',
    ciudad:'ciudad',municipio:'ciudad',poblacion:'ciudad',provincia:'provincia',servicios:'servicios',
    horario:'horarios',horarios:'horarios',descripcion:'descripcion',tipo_negocio:'tipo_negocio',tipo:'tipo_negocio',
    servicio_oficial:'servicio_oficial',marcas_servicio_oficial:'marcas_servicio_oficial',marcas:'marcas_servicio_oficial'
  };
  return a[h]||h;
}
function provincia(v){return PROVINCIAS[norm(v)]||'';}
function urlOk(v){if(!v)return true;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol);}catch{return false;}}
function bool(v){return ['1','true','si','sí','yes'].includes(norm(v));}
function parseServicios(v){
  const tokens=text(v).split(/[|,]/).map(x=>x.trim()).filter(Boolean),out=[];
  for(const token of tokens){
    const n=norm(token);
    const match=state.servicios.find(s=>norm(s.slug)===n||norm(s.nombre)===n);
    if(match&&!out.includes(match.slug))out.push(match.slug);
  }
  return out;
}
function parseHorario(v){
  const raw=text(v);if(!raw)return null;
  try{const obj=JSON.parse(raw);if(obj&&typeof obj==='object')return obj;}catch{}
  const p=window.TallerMapHorariosV4?.parsearPegado?.(raw);
  return p&&Object.keys(p).length?p:null;
}
function toData(h,r){
  const o={};h.forEach((x,i)=>{if(x)o[x]=text(r[i]);});
  const p=provincia(o.provincia);
  return {
    nombre:text(o.nombre),telefono:text(o.telefono)||null,web:text(o.web)||null,direccion:text(o.direccion)||null,
    codigo_postal:text(o.codigo_postal),ciudad:text(o.ciudad),provincia:p,descripcion:text(o.descripcion)||null,
    servicios:parseServicios(o.servicios),horarios:parseHorario(o.horarios),cerrado_temporalmente:false,
    motivo_cierre_temporal:null,fecha_reapertura_prevista:null,tipo_negocio:text(o.tipo_negocio)||'taller',
    servicio_oficial:bool(o.servicio_oficial),marcas_servicio_oficial:text(o.marcas_servicio_oficial)||null
  };
}
function key(d){return norm(d.nombre)+'|'+norm(d.ciudad)+'|'+norm(d.direccion);}
async function loadServicios(){
  const {data,error}=await sb.from('servicios').select('slug,nombre').eq('activo',true).limit(500);
  if(error)throw error;state.servicios=data||[];
}
function render(items){
  $('v4-csv-total').textContent=items.length;
  $('v4-csv-validas').textContent=items.filter(x=>x.status==='ok').length;
  $('v4-csv-duplicadas').textContent=items.filter(x=>x.status==='duplicate').length;
  $('v4-csv-errores').textContent=items.filter(x=>x.status==='error').length;
  $('v4-csv-preview').innerHTML=items.slice(0,200).map(x=>`<div class="v4-csv-row ${x.status}"><strong>Fila ${x.line}: ${esc(x.data.nombre||'Sin nombre')}</strong><small>${esc(x.data.ciudad||'Sin municipio')} · ${esc(x.data.provincia||'Provincia inválida')}</small>${x.errs.length?`<small>${esc(x.errs.join(' · '))}</small>`:''}${x.dup?`<small>${esc(x.dup)}</small>`:''}</div>`).join('');
}
async function comprobar(){
  const f=$('v4-csv').files?.[0];state.items=[];state.validas=[];state.revisado=false;$('v4-importar-csv').disabled=true;$('v4-csv-preview').innerHTML='';
  if(!f)return status('Selecciona primero un archivo CSV.','error');
  if(f.size>10*1024*1024)return status('El CSV supera 10 MB. Divide el lote.','error');
  try{
    status('Comprobando CSV…');if(!state.servicios.length)await loadServicios();
    const rows=parseCSV(await f.text());if(rows.length<2)throw new Error('El CSV no contiene filas de datos.');
    const h=rows[0].map(header);for(const req of ['nombre','ciudad','provincia'])if(!h.includes(req))throw new Error('Falta la columna obligatoria: '+req);
    const seen=new Set(),items=[];
    rows.slice(1).forEach((r,i)=>{
      const d=toData(h,r),errs=[];if(!d.nombre)errs.push('Falta nombre');if(!d.ciudad)errs.push('Falta municipio');if(!d.provincia)errs.push('Provincia no válida');
      if(!/^\d{5}$/.test(d.codigo_postal))errs.push('CP obligatorio/no válido');
      if(d.codigo_postal&&d.provincia&&d.codigo_postal.slice(0,2)!==PREF[d.provincia])errs.push('CP no coincide con provincia');
      if(!urlOk(d.web))errs.push('Web no válida');
      const k=key(d),dup=seen.has(k)?'Duplicado dentro del CSV':'';seen.add(k);
      items.push({line:i+2,data:d,errs,dup,status:errs.length?'error':dup?'duplicate':'ok'});
    });
    state.items=items;state.validas=items.filter(x=>x.status==='ok').map(x=>x.data);state.revisado=true;render(items);
    $('v4-importar-csv').disabled=!state.validas.length;
    const e=items.filter(x=>x.status==='error').length,d=items.filter(x=>x.status==='duplicate').length;
    status(`${items.length} filas: ${state.validas.length} válidas, ${d} duplicadas, ${e} con errores. Todavía no se ha guardado nada.`,e?'error':'ok');
  }catch(e){status('No se pudo comprobar: '+(e.message||e),'error');}
}
async function importar(){
  if(!state.revisado||!state.validas.length)return status('Primero comprueba el CSV.','error');
  if(!confirm(`Se crearán ${state.validas.length} talleres. ¿Continuar?`))return;
  $('v4-importar-csv').disabled=true;let ok=0,err=0;
  for(let i=0;i<state.validas.length;i++){
    const d=state.validas[i];status(`Importando ${i+1}/${state.validas.length}: ${d.nombre}…`);
    const p={
      p_nombre:d.nombre,p_telefono:d.telefono,p_web:d.web,p_direccion:d.direccion,p_codigo_postal:d.codigo_postal,
      p_ciudad:d.ciudad,p_provincia:d.provincia,p_descripcion:d.descripcion,p_servicios:d.servicios,p_horarios:d.horarios,
      p_cerrado_temporalmente:false,p_motivo_cierre_temporal:null,p_fecha_reapertura_prevista:null,p_tipo_negocio:d.tipo_negocio,
      p_servicio_oficial:d.servicio_oficial,p_marcas_servicio_oficial:d.marcas_servicio_oficial
    };
    const r=await sb.rpc('admin_crear_taller_editor_v4',p);if(r.error)err++;else ok++;
  }
  status(`✓ Importación terminada: ${ok} creados, ${err} con error.`,err?'error':'ok');
  state.revisado=false;state.validas=[];
}
function plantilla(){
  const s='nombre;telefono;web;direccion;codigo_postal;ciudad;provincia;servicios;horarios;descripcion\nTaller Ejemplo;964000000;https://ejemplo.es;Calle Ejemplo 1;12001;Castelló de la Plana;Castellón;Mecánica general|Frenos;Lunes 09:00-14:00, 16:00-19:00|Martes 09:00-14:00, 16:00-19:00;Descripción opcional\n';
  const b=new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='plantilla-talleres-editor-v4.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function init(){
  const input=$('v4-csv');if(!input)return;
  $('v4-comprobar-csv').onclick=comprobar;$('v4-importar-csv').onclick=importar;$('v4-plantilla-csv').onclick=plantilla;
  input.onchange=()=>{state.items=[];state.validas=[];state.revisado=false;$('v4-importar-csv').disabled=true;if(input.files?.length)setTimeout(comprobar,50);};
}
document.addEventListener('DOMContentLoaded',init);
})();