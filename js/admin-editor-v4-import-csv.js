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

const state={items:[],validas:[],revisado:false,loteActivo:false,indice:-1,abriendo:false};
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuidOk=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(v));

function status(msg,type=''){
  const e=$('v4-csv-estado');
  if(!e)return;
  e.textContent=msg;
  e.className='v4-status'+(type?' '+type:'');
}

function parseCSV(raw){
  raw=String(raw||'').replace(/^\uFEFF/,'');
  const first=raw.split(/\r?\n/,1)[0]||'';
  const d=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
  const out=[];let row=[],cell='',q=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i],n=raw[i+1];
    if(c==='"'){
      if(q&&n==='"'){cell+='"';i++;}
      else q=!q;
    }else if(c===d&&!q){
      row.push(cell);cell='';
    }else if((c==='\n'||c==='\r')&&!q){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);cell='';
      if(row.some(v=>text(v)))out.push(row);
      row=[];
    }else cell+=c;
  }
  row.push(cell);
  if(row.some(v=>text(v)))out.push(row);
  return out;
}

function header(v){
  const h=norm(v).replace(/ /g,'_');
  const a={
    id:'id',uuid:'id',taller_id:'id',
    nombre:'nombre',taller:'nombre',empresa:'nombre',telefono:'telefono',tel:'telefono',web:'web',url:'web',
    direccion:'direccion',domicilio:'direccion',codigo_postal:'codigo_postal',cp:'codigo_postal',
    ciudad:'ciudad',municipio:'ciudad',poblacion:'ciudad',provincia:'provincia',servicios:'servicios',
    horario:'horarios',horarios:'horarios',descripcion:'descripcion',slug:'slug'
  };
  return a[h]||h;
}

function rowObject(headers,row){
  const o={};
  headers.forEach((h,i)=>{if(h)o[h]=text(row[i]);});
  return o;
}

function provinciaCanonica(v){return PROVINCIAS[norm(v)]||text(v);}

function render(items){
  $('v4-csv-total').textContent=items.length;
  $('v4-csv-validas').textContent=items.filter(x=>x.status==='ok').length;
  $('v4-csv-duplicadas').textContent=items.filter(x=>x.status==='duplicate').length;
  $('v4-csv-errores').textContent=items.filter(x=>x.status==='error').length;
  $('v4-csv-preview').innerHTML=items.slice(0,500).map(x=>{
    const d=x.data||{};
    return `<div class="v4-csv-row ${x.status}"><strong>Fila ${x.line}: ${esc(d.nombre||x.csv?.nombre||'Sin nombre')}</strong><small>${esc(d.ciudad||x.csv?.ciudad||'Sin municipio')} · ${esc(d.provincia||x.csv?.provincia||'Sin provincia')}</small>${x.errs.length?`<small>${esc(x.errs.join(' · '))}</small>`:''}${x.dup?`<small>${esc(x.dup)}</small>`:''}</div>`;
  }).join('');
}

async function fetchExistentes(ids){
  const out=[];
  for(let i=0;i<ids.length;i+=100){
    const lote=ids.slice(i,i+100);
    const {data,error}=await sb.from('talleres')
      .select('id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,servicios,horarios,descripcion,slug')
      .in('id',lote);
    if(error)throw error;
    out.push(...(data||[]));
  }
  return out;
}

async function comprobar(){
  const f=$('v4-csv').files?.[0];
  state.items=[];state.validas=[];state.revisado=false;state.loteActivo=false;state.indice=-1;
  $('v4-importar-csv').disabled=true;
  $('v4-csv-preview').innerHTML='';
  if(!f)return status('Selecciona primero un archivo CSV.','error');
  if(f.size>20*1024*1024)return status('El CSV supera 20 MB. Divide el lote.','error');
  try{
    status('Comprobando IDs del CSV contra Supabase…');
    const rows=parseCSV(await f.text());
    if(rows.length<2)throw new Error('El CSV no contiene filas de datos.');
    const headers=rows[0].map(header);
    if(!headers.includes('id'))throw new Error('Falta la columna obligatoria id. Este modo solo edita talleres que ya existen.');

    const base=[];
    const seen=new Set();
    rows.slice(1).forEach((r,i)=>{
      const csv=rowObject(headers,r);
      const errs=[];
      const id=text(csv.id);
      if(!id)errs.push('Falta id');
      else if(!uuidOk(id))errs.push('ID no válido');
      const dup=id&&seen.has(id)?'ID repetido dentro del CSV':'';
      if(id)seen.add(id);
      base.push({line:i+2,csv,id,errs,dup,status:errs.length?'error':dup?'duplicate':'pending',data:null});
    });

    const ids=base.filter(x=>x.status==='pending').map(x=>x.id);
    const existentes=await fetchExistentes(ids);
    const map=new Map(existentes.map(t=>[String(t.id),t]));

    for(const item of base){
      if(item.status!=='pending')continue;
      const t=map.get(item.id);
      if(!t){
        item.errs.push('El id no existe en Supabase');
        item.status='error';
      }else{
        item.data=t;
        item.status='ok';
      }
    }

    state.items=base;
    state.validas=base.filter(x=>x.status==='ok').map(x=>x.data);
    state.revisado=true;
    render(base);
    $('v4-importar-csv').disabled=!state.validas.length;

    const errores=base.filter(x=>x.status==='error').length;
    const duplicadas=base.filter(x=>x.status==='duplicate').length;
    status(`${base.length} filas: ${state.validas.length} talleres existentes listos para editar, ${duplicadas} IDs repetidos, ${errores} con error. No se ha creado ni modificado ningún taller.`,errores?'error':'ok');
  }catch(e){
    status('No se pudo comprobar: '+(e.message||e),'error');
  }
}

function waitFor(test,timeout=20000,interval=120){
  return new Promise((resolve,reject)=>{
    const start=Date.now();
    const tick=()=>{
      let r=false;
      try{r=test();}catch{}
      if(r)return resolve(r);
      if(Date.now()-start>=timeout)return reject(new Error('Tiempo de espera agotado al cargar el taller.'));
      setTimeout(tick,interval);
    };
    tick();
  });
}

function optionMunicipio(select,city){
  const n=norm(city);
  return [...select.options].find(o=>norm(o.value)===n || norm(o.value).split(' ').join(' ')===n) ||
    [...select.options].find(o=>norm(o.value).split('/').some(p=>norm(p)===n));
}

async function abrirIndice(index){
  if(state.abriendo)return;
  if(index<0||index>=state.validas.length){
    state.loteActivo=false;
    state.indice=-1;
    status('✓ Lote terminado. No quedan más talleres del CSV por abrir.','ok');
    return;
  }
  state.abriendo=true;
  try{
    const t=state.validas[index];
    state.indice=index;
    status(`Abriendo ${index+1}/${state.validas.length}: ${t.nombre||t.id}…`);

    const prov=$('v4-provincia');
    const provincia=provinciaCanonica(t.provincia);
    const provOpt=[...prov.options].find(o=>norm(o.value)===norm(provincia));
    if(!provOpt)throw new Error(`Provincia no disponible en el editor: ${t.provincia||'sin provincia'}`);

    if(prov.value!==provOpt.value){
      prov.value=provOpt.value;
      prov.dispatchEvent(new Event('change',{bubbles:true}));
    }else if($('v4-municipio').disabled){
      prov.dispatchEvent(new Event('change',{bubbles:true}));
    }

    const mun=$('v4-municipio');
    await waitFor(()=>!mun.disabled && mun.options.length>1);
    const mOpt=optionMunicipio(mun,t.ciudad);
    if(!mOpt)throw new Error(`No encuentro el municipio “${t.ciudad}” en ${provOpt.value}.`);
    mun.value=mOpt.value;
    mun.dispatchEvent(new Event('change',{bubbles:true}));

    const cargar=$('v4-cargar');
    await waitFor(()=>!cargar.disabled);
    cargar.click();

    const selector=`.v4-item[data-id="${CSS.escape(String(t.id))}"]`;
    const row=await waitFor(()=>document.querySelector(selector));
    const open=row.querySelector('.v4-open');
    if(!open)throw new Error('No se pudo abrir la fila del taller.');
    open.click();
    await waitFor(()=>!$('v4-form').hidden && text($('v4-id').value)===String(t.id));

    state.loteActivo=true;
    status(`✓ CSV activo: ${index+1}/${state.validas.length}. Edita esta ficha y pulsa “Guardar y siguiente” para continuar.`, 'ok');
  }catch(e){
    status(`No se pudo abrir la fila ${index+1}: ${e.message||e}`,'error');
  }finally{
    state.abriendo=false;
  }
}

async function cargarParaEditar(){
  if(!state.revisado||!state.validas.length)return status('Primero comprueba el CSV.','error');
  state.loteActivo=true;
  state.indice=-1;
  await abrirIndice(0);
}

async function esperarGuardado(){
  const el=$('v4-estado');
  await waitFor(()=>{
    const s=text(el?.textContent);
    if(s.startsWith('✓ Ficha guardada correctamente.'))return 'ok';
    if(s.startsWith('No se pudo guardar:')||s.startsWith('No se guarda:')||s.startsWith('Falta el nombre.'))return 'error';
    return false;
  },30000,150);
  return text(el?.textContent).startsWith('✓ Ficha guardada correctamente.');
}

function interceptarGuardarSiguiente(){
  const btn=$('v4-guardar-siguiente');
  if(!btn)return;
  btn.addEventListener('click',async e=>{
    if(!state.loteActivo)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(state.abriendo)return;
    const form=$('v4-form');
    const submit=form?.querySelector('button[type="submit"]');
    if(!form||!submit)return;
    status(`Guardando ${state.indice+1}/${state.validas.length}…`);
    form.requestSubmit(submit);
    try{
      const ok=await esperarGuardado();
      if(!ok){status('La ficha no se guardó. Corrige el error antes de continuar.','error');return;}
      await abrirIndice(state.indice+1);
    }catch(err){
      status('No se pudo continuar automáticamente: '+(err.message||err),'error');
    }
  },true);
}

function plantilla(){
  const s='id;nombre;telefono;web;direccion;codigo_postal;ciudad;provincia;servicios;horarios;descripcion\n00000000-0000-4000-8000-000000000000;Taller existente;;;;12001;Castelló de la Plana;Castellón;;;\n';
  const b=new Blob(['\ufeff'+s],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download='plantilla-editar-talleres-existentes-v4.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function init(){
  const input=$('v4-csv');
  if(!input)return;
  $('v4-comprobar-csv').onclick=comprobar;
  $('v4-importar-csv').onclick=cargarParaEditar;
  $('v4-plantilla-csv').onclick=plantilla;
  interceptarGuardarSiguiente();
  input.onchange=()=>{
    state.items=[];state.validas=[];state.revisado=false;state.loteActivo=false;state.indice=-1;
    $('v4-importar-csv').disabled=true;
    if(input.files?.length)setTimeout(comprobar,50);
  };
}

document.addEventListener('DOMContentLoaded',init);
})();