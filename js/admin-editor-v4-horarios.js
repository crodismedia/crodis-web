(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
const LABORABLES=['lunes','martes','miercoles','jueves','viernes'];
const ALIAS={
  lunes:'lunes',lun:'lunes',
  martes:'martes',mar:'martes',
  miercoles:'miercoles',miércoles:'miercoles',mie:'miercoles',mié:'miercoles',
  jueves:'jueves',jue:'jueves',
  viernes:'viernes',vie:'viernes',
  sabado:'sabado',sábado:'sabado',sab:'sabado',sáb:'sabado',
  domingo:'domingo',dom:'domingo'
};
let root=null;

function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horario-importador">
    <div class="v4-horario-importador-cabecera"><strong>Pegar horarios</strong><span>Copia el horario desde Google, una web o un texto y lo adapto automáticamente.</span></div>
    <textarea id="v4-horario-pegado" rows="6" placeholder="Ejemplo:\nLunes 09:00–14:00, 16:00–19:00\nMartes 09:00–14:00, 16:00–19:00\nSábado 09:00–13:00\nDomingo Cerrado"></textarea>
    <div class="v4-horario-importador-acciones"><button id="v4-interpretar-horario" class="v4-btn v4-primary" type="button">Interpretar y aplicar</button><span id="v4-horario-importador-estado" class="v4-status"></span></div>
  </div>
  <div class="v4-horarios v4-horarios-partidos">
    <div class="v4-horario-cabecera">
      <small>Horario partido: mañana y tarde. Para horario continuo deja la tarde vacía.</small>
      <button id="v4-copiar-laborables" class="v4-btn v4-soft" type="button">Aplicar lunes–viernes</button>
    </div>
    <div class="v4-horario-titulos"><span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong></div>
    ${DIAS.map(([k,n])=>`<div class="v4-dia v4-dia-partido" data-dia="${k}">
      <strong>${n}</strong>
      <input class="v4-m1" type="time" step="60" aria-label="${n} abre mañana">
      <input class="v4-m2" type="time" step="60" aria-label="${n} cierra mañana">
      <input class="v4-t1" type="time" step="60" aria-label="${n} abre tarde">
      <input class="v4-t2" type="time" step="60" aria-label="${n} cierra tarde">
      <label><input class="v4-dia-cerrado" type="checkbox"> Sí</label>
    </div>`).join('')}
  </div>
  <div class="v4-horario-acciones"><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  root.addEventListener('change',e=>{if(e.target.classList.contains('v4-dia-cerrado'))actualizarDia(e.target.closest('.v4-dia-partido'));});
  document.getElementById('v4-copiar-laborables')?.addEventListener('click',copiarLaborables);
  document.getElementById('v4-limpiar-horario')?.addEventListener('click',()=>cargar(null));
  document.getElementById('v4-interpretar-horario')?.addEventListener('click',interpretarPegado);
  cargar(null);
}

function get(row,clase){return row.querySelector('.'+clase);}
function actualizarDia(row){
  if(!row)return;
  const cerrado=get(row,'v4-dia-cerrado').checked;
  ['v4-m1','v4-m2','v4-t1','v4-t2'].forEach(c=>{const input=get(row,c);input.disabled=cerrado;if(cerrado)input.value='';});
}
function ponerTurno(row,prefijo,turno){
  get(row,prefijo+'1').value=turno?.apertura||'';
  get(row,prefijo+'2').value=normalizarHoraInput(turno?.cierre)||'';
}
function normalizarHoraInput(h){return h==='24:00'?'23:59':(h||'');}
function turnosDeDia(dia){
  if(!dia||typeof dia!=='object')return[];
  if(Array.isArray(dia.turnos))return dia.turnos;
  const legacy=[];
  const m1=dia.abre_manana||dia.abre||'',m2=dia.cierra_manana||dia.cierra||'';
  const t1=dia.abre_tarde||'',t2=dia.cierra_tarde||'';
  if(m1||m2)legacy.push({apertura:m1,cierre:m2});
  if(t1||t2)legacy.push({apertura:t1,cierre:t2});
  return legacy;
}
function cargar(valor){
  if(!root){render();return;}
  DIAS.forEach(([k])=>{
    const row=root.querySelector(`[data-dia="${k}"]`),dia=valor?.[k];
    const turnos=turnosDeDia(dia);
    get(row,'v4-dia-cerrado').checked=!!dia?.cerrado;
    ponerTurno(row,'v4-m',turnos[0]);
    ponerTurno(row,'v4-t',turnos[1]);
    actualizarDia(row);
  });
}
function minutos(h){const [a,b]=String(h||'').split(':').map(Number);return a*60+b;}
function turnoValido(a,c){return /^\d{2}:\d{2}$/.test(a)&&/^\d{2}:\d{2}$/.test(c)&&minutos(c)>minutos(a);}
function obtener(){
  if(!root)return{valido:true,valor:null};
  const filas=DIAS.map(([k,n])=>({k,n,row:root.querySelector(`[data-dia="${k}"]`)}));
  const hayAlgo=filas.some(({row})=>get(row,'v4-dia-cerrado').checked||['v4-m1','v4-m2','v4-t1','v4-t2'].some(c=>get(row,c).value));
  if(!hayAlgo)return{valido:true,valor:null};
  const resultado={};let abiertos=0;
  for(const {k,n,row} of filas){
    const cerrado=get(row,'v4-dia-cerrado').checked;
    if(cerrado){resultado[k]={cerrado:true,turnos:[]};continue;}
    const m1=get(row,'v4-m1').value,m2=get(row,'v4-m2').value,t1=get(row,'v4-t1').value,t2=get(row,'v4-t2').value;
    const turnos=[];
    if(m1||m2){if(!turnoValido(m1,m2))return{valido:false,mensaje:`${n}: completa correctamente apertura y cierre de mañana.`};turnos.push({apertura:m1,cierre:m2});}
    if(t1||t2){if(!turnoValido(t1,t2))return{valido:false,mensaje:`${n}: completa correctamente apertura y cierre de tarde.`};turnos.push({apertura:t1,cierre:t2});}
    if(!turnos.length)return{valido:false,mensaje:`${n}: introduce un horario o marca Cerrado.`};
    if(turnos.length===2&&minutos(turnos[1].apertura)<minutos(turnos[0].cierre))return{valido:false,mensaje:`${n}: el turno de tarde empieza antes de terminar el de mañana.`};
    resultado[k]={cerrado:false,turnos};abiertos++;
  }
  if(!abiertos)return{valido:false,mensaje:'El horario no puede tener todos los días cerrados. Si no conoces el horario, pulsa Quitar horario.'};
  return{valido:true,valor:resultado};
}
function copiarLaborables(){
  const origen=root.querySelector('[data-dia="lunes"]');
  for(const k of LABORABLES.slice(1)){
    const row=root.querySelector(`[data-dia="${k}"]`);
    get(row,'v4-dia-cerrado').checked=get(origen,'v4-dia-cerrado').checked;
    for(const c of ['v4-m1','v4-m2','v4-t1','v4-t2'])get(row,c).value=get(origen,c).value;
    actualizarDia(row);
  }
}

function limpiarTexto(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\u00a0/g,' ').trim();}
function horaCanonica(raw){
  let s=String(raw||'').trim().toLowerCase().replace(/h/g,'').replace('.',':').replace(/\s+/g,'');
  const m=s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if(!m)return null;
  const h=Number(m[1]),min=Number(m[2]||0);
  if(h<0||h>24||min<0||min>59||(h===24&&min!==0))return null;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
function extraerTurnos(texto){
  const t=String(texto||'').replace(/[–—]/g,'-');
  if(/cerrad|closed|no abre/i.test(t))return{cerrado:true,turnos:[]};
  if(/24\s*h|24\s*horas/i.test(t))return{cerrado:false,turnos:[{apertura:'00:00',cierre:'23:59'}]};
  const re=/(\d{1,2}(?::\d{2})?)\s*(?:-|a|hasta)\s*(\d{1,2}(?::\d{2})?)/gi;
  const turnos=[];let m;
  while((m=re.exec(t))&&turnos.length<2){
    const apertura=horaCanonica(m[1]),cierre=horaCanonica(m[2]);
    if(apertura&&cierre&&minutos(cierre)>minutos(apertura))turnos.push({apertura,cierre});
  }
  return turnos.length?{cerrado:false,turnos}:null;
}
function detectarDias(texto){
  const n=limpiarTexto(texto).replace(/[.]/g,' ');
  const encontrados=[];
  for(const [alias,dia] of Object.entries(ALIAS)){
    if(new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`,'i').test(n)&&!encontrados.includes(dia))encontrados.push(dia);
  }
  if(/lunes\s*(?:a|-|al)\s*viernes/.test(n))return LABORABLES.slice();
  if(/lunes\s*(?:a|-|al)\s*domingo/.test(n))return DIAS.map(x=>x[0]);
  return encontrados;
}
function parsearPegado(texto){
  const resultado={};
  const lineas=String(texto||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(let linea of lineas){
    const dias=detectarDias(linea);
    if(!dias.length)continue;
    const horario=extraerTurnos(linea);
    if(!horario)continue;
    for(const dia of dias)resultado[dia]={cerrado:horario.cerrado,turnos:horario.turnos.map(t=>({...t}))};
  }
  return resultado;
}
function aplicarImportado(datos){
  let aplicados=0;
  for(const [k] of DIAS){
    if(!datos[k])continue;
    const row=root.querySelector(`[data-dia="${k}"]`),dia=datos[k];
    get(row,'v4-dia-cerrado').checked=!!dia.cerrado;
    ponerTurno(row,'v4-m',dia.turnos?.[0]);
    ponerTurno(row,'v4-t',dia.turnos?.[1]);
    actualizarDia(row);aplicados++;
  }
  return aplicados;
}
function setImportStatus(msg,error=false){const el=document.getElementById('v4-horario-importador-estado');if(!el)return;el.textContent=msg;el.className='v4-status '+(error?'error':'ok');}
function interpretarPegado(){
  const texto=document.getElementById('v4-horario-pegado')?.value||'';
  if(!texto.trim()){setImportStatus('Pega primero el horario.',true);return;}
  const datos=parsearPegado(texto),aplicados=aplicarImportado(datos);
  if(!aplicados){setImportStatus('No pude reconocer días y horas. Prueba con una línea por día.',true);return;}
  setImportStatus(`✓ Horario interpretado y aplicado en ${aplicados} día(s). Revísalo y guarda la ficha.`);
}

document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener,parsearPegado};
}());