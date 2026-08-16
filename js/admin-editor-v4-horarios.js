(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
let root=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horarios"><label class="v4-service"><input id="v4-horario-confirmado" type="checkbox"><span><strong>Horario confirmado</strong><br><small>Desmárcalo si el horario todavía no está verificado.</small></span></label>${DIAS.map(([k,n])=>`<div class="v4-dia" data-dia="${k}"><strong>${n}</strong><label><input class="v4-dia-cerrado" type="checkbox"> Cerrado</label><div class="v4-turno"><input class="v4-a1" type="time" step="900"><span>–</span><input class="v4-c1" type="time" step="900"></div><div class="v4-turno"><input class="v4-a2" type="time" step="900"><span>–</span><input class="v4-c2" type="time" step="900"></div></div>`).join('')}</div><div class="v4-horario-acciones"><button id="v4-copiar-laborables" class="v4-btn v4-soft" type="button">Copiar lunes a laborables</button><button id="v4-cerrar-finde" class="v4-btn v4-soft" type="button">Cerrar fin de semana</button><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  root.addEventListener('change',e=>{if(e.target.classList.contains('v4-dia-cerrado'))actualizarDia(e.target.closest('.v4-dia'));if(e.target.id==='v4-horario-confirmado')actualizarBloque();});
  document.getElementById('v4-copiar-laborables').addEventListener('click',copiarLaborables);
  document.getElementById('v4-cerrar-finde').addEventListener('click',cerrarFinde);
  document.getElementById('v4-limpiar-horario').addEventListener('click',()=>cargar(null));
  cargar(null);
}
function actualizarDia(row){const cerrado=row.querySelector('.v4-dia-cerrado').checked;row.querySelectorAll('input[type="time"]').forEach(i=>{i.disabled=cerrado||!document.getElementById('v4-horario-confirmado').checked;if(cerrado)i.value='';});}
function actualizarBloque(){const confirmado=document.getElementById('v4-horario-confirmado').checked;root.querySelectorAll('.v4-dia').forEach(row=>{row.querySelector('.v4-dia-cerrado').disabled=!confirmado;actualizarDia(row);});}
function setTurno(row,idx,t){row.querySelector(`.v4-a${idx}`).value=t?.apertura||'';row.querySelector(`.v4-c${idx}`).value=t?.cierre||'';}
function cargar(valor){if(!root)render();const confirmado=!!valor&&typeof valor==='object';document.getElementById('v4-horario-confirmado').checked=confirmado;DIAS.forEach(([k])=>{const row=root.querySelector(`[data-dia="${k}"]`),dia=valor?.[k];row.querySelector('.v4-dia-cerrado').checked=confirmado?!!dia?.cerrado:false;setTurno(row,1,dia?.turnos?.[0]);setTurno(row,2,dia?.turnos?.[1]);});actualizarBloque();}
function rangoValido(a,c){return /^\d{2}:\d{2}$/.test(a)&&/^\d{2}:\d{2}$/.test(c)&&a<c;}
function obtener(){if(!document.getElementById('v4-horario-confirmado')?.checked)return{valido:true,valor:null};const resultado={};let abiertos=0;for(const [k,n] of DIAS){const row=root.querySelector(`[data-dia="${k}"]`),cerrado=row.querySelector('.v4-dia-cerrado').checked,turnos=[];if(!cerrado){for(const idx of [1,2]){const a=row.querySelector(`.v4-a${idx}`).value,c=row.querySelector(`.v4-c${idx}`).value;if(!a&&!c)continue;if(!rangoValido(a,c))return{valido:false,mensaje:`Horario no válido en ${n}: completa apertura y cierre.`};turnos.push({apertura:a,cierre:c});}if(!turnos.length)return{valido:false,mensaje:`${n}: marca Cerrado o añade al menos un turno.`};if(turnos.length===2&&turnos[0].cierre>turnos[1].apertura)return{valido:false,mensaje:`${n}: los turnos se solapan.`};abiertos++;}resultado[k]={cerrado,turnos};}
if(!abiertos)return{valido:false,mensaje:'El horario confirmado no puede tener todos los días cerrados.'};return{valido:true,valor:resultado};}
function copiarLaborables(){const origen=root.querySelector('[data-dia="lunes"]');for(const k of ['martes','miercoles','jueves','viernes']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=origen.querySelector('.v4-dia-cerrado').checked;for(const idx of [1,2]){row.querySelector(`.v4-a${idx}`).value=origen.querySelector(`.v4-a${idx}`).value;row.querySelector(`.v4-c${idx}`).value=origen.querySelector(`.v4-c${idx}`).value;}actualizarDia(row);}}
function cerrarFinde(){for(const k of ['sabado','domingo']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=true;actualizarDia(row);}}
document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener};
}());
