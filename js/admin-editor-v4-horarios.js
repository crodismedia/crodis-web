(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
const LABORABLES=['lunes','martes','miercoles','jueves','viernes'];
let root=null;

function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horarios v4-horarios-partidos">
    <div class="v4-horario-cabecera">
      <small>Horario partido: mañana y tarde. Para horario continuo deja la tarde vacía.</small>
      <button id="v4-copiar-laborables" class="v4-btn v4-soft" type="button">Aplicar lunes–viernes</button>
    </div>
    <div class="v4-horario-titulos"><span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong></div>
    ${DIAS.map(([k,n])=>`<div class="v4-dia v4-dia-partido" data-dia="${k}">
      <strong>${n}</strong>
      <input class="v4-m1" type="time" step="900" aria-label="${n} abre mañana">
      <input class="v4-m2" type="time" step="900" aria-label="${n} cierra mañana">
      <input class="v4-t1" type="time" step="900" aria-label="${n} abre tarde">
      <input class="v4-t2" type="time" step="900" aria-label="${n} cierra tarde">
      <label><input class="v4-dia-cerrado" type="checkbox"> Sí</label>
    </div>`).join('')}
  </div>
  <div class="v4-horario-acciones"><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  root.addEventListener('change',e=>{if(e.target.classList.contains('v4-dia-cerrado'))actualizarDia(e.target.closest('.v4-dia-partido'));});
  document.getElementById('v4-copiar-laborables')?.addEventListener('click',copiarLaborables);
  document.getElementById('v4-limpiar-horario')?.addEventListener('click',()=>cargar(null));
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
  get(row,prefijo+'2').value=turno?.cierre||'';
}
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

document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener};
}());