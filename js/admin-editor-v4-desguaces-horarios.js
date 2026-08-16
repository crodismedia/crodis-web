(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
let root=null;
function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horarios"><label class="v4-service"><input id="v4-horario-confirmado" type="checkbox"><span><strong>Horario confirmado</strong><br><small>Márcalo solo cuando hayas verificado el horario. Puedes editarlo antes.</small></span></label>${DIAS.map(([k,n])=>`<div class="v4-dia" data-dia="${k}"><strong>${n}</strong><label><input class="v4-dia-cerrado" type="checkbox"> Cerrado</label><div class="v4-turno"><input class="v4-a1" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="${n} apertura primer turno"><span>–</span><input class="v4-c1" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="${n} cierre primer turno"></div><div class="v4-turno"><input class="v4-a2" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="${n} apertura segundo turno"><span>–</span><input class="v4-c2" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" aria-label="${n} cierre segundo turno"></div></div>`).join('')}</div><div class="v4-horario-acciones"><button id="v4-copiar-laborables" class="v4-btn v4-soft" type="button">Copiar lunes a laborables</button><button id="v4-cerrar-finde" class="v4-btn v4-soft" type="button">Cerrar fin de semana</button><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  root.addEventListener('change',e=>{if(e.target.classList.contains('v4-dia-cerrado'))actualizarDia(e.target.closest('.v4-dia'));});
  root.addEventListener('blur',e=>{if(e.target.matches('.v4-turno input[type="text"]'))e.target.value=formatearHoraFinal(e.target.value);},true);
  document.getElementById('v4-copiar-laborables').addEventListener('click',copiarLaborables);
  document.getElementById('v4-cerrar-finde').addEventListener('click',cerrarFinde);
  document.getElementById('v4-limpiar-horario').addEventListener('click',()=>cargar(null));
  cargar(null);
}
function formatearHoraFinal(v){v=String(v||'').trim();if(!v)return'';if(/^\d{1,2}:\d{2}$/.test(v)){const [h,m]=v.split(':');return h.padStart(2,'0')+':'+m;}const d=v.replace(/[^0-9]/g,'').slice(0,4);if(d.length===3)return '0'+d[0]+':'+d.slice(1);if(d.length===4)return d.slice(0,2)+':'+d.slice(2);return v;}
function actualizarDia(row){const cerrado=row.querySelector('.v4-dia-cerrado').checked;row.querySelectorAll('.v4-turno input').forEach(i=>{i.disabled=cerrado;if(cerrado)i.value='';});}
function actualizarBloque(){root.querySelectorAll('.v4-dia').forEach(actualizarDia);}
function setTurno(row,idx,t){row.querySelector(`.v4-a${idx}`).value=t?.apertura||'';row.querySelector(`.v4-c${idx}`).value=t?.cierre||'';}
function cargar(valor){if(!root)render();const confirmado=!!valor&&typeof valor==='object';document.getElementById('v4-horario-confirmado').checked=confirmado;DIAS.forEach(([k])=>{const row=root.querySelector(`[data-dia="${k}"]`),dia=valor?.[k];row.querySelector('.v4-dia-cerrado').checked=!!dia?.cerrado;setTurno(row,1,dia?.turnos?.[0]);setTurno(row,2,dia?.turnos?.[1]);});actualizarBloque();}
function horaValida(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
function rangoValido(a,c){return horaValida(a)&&horaValida(c)&&a<c;}
function obtener(){const confirmado=!!document.getElementById('v4-horario-confirmado')?.checked;const resultado={};let abiertos=0,hayDatos=false;for(const [k,n] of DIAS){const row=root.querySelector(`[data-dia="${k}"]`),cerrado=row.querySelector('.v4-dia-cerrado').checked,turnos=[];if(cerrado)hayDatos=true;else{for(const idx of [1,2]){const a=formatearHoraFinal(row.querySelector(`.v4-a${idx}`).value),c=formatearHoraFinal(row.querySelector(`.v4-c${idx}`).value);row.querySelector(`.v4-a${idx}`).value=a;row.querySelector(`.v4-c${idx}`).value=c;if(!a&&!c)continue;hayDatos=true;if(!rangoValido(a,c))return{valido:false,mensaje:`Horario no válido en ${n}. Usa HH:MM, por ejemplo 08:30–13:45.`};turnos.push({apertura:a,cierre:c});}if(turnos.length===2&&turnos[0].cierre>turnos[1].apertura)return{valido:false,mensaje:`${n}: los turnos se solapan.`};if(turnos.length)abiertos++;}resultado[k]={cerrado,turnos};}
if(!hayDatos)return{valido:true,valor:null};if(!confirmado)return{valido:false,mensaje:'Has introducido un horario. Márcalo como “Horario confirmado” antes de guardar.'};if(!abiertos)return{valido:false,mensaje:'El horario confirmado no puede tener todos los días cerrados.'};for(const [k,n] of DIAS){const dia=resultado[k];if(!dia.cerrado&&!dia.turnos.length)return{valido:false,mensaje:`${n}: marca Cerrado o añade al menos un turno.`};}return{valido:true,valor:resultado};}
function copiarLaborables(){const origen=root.querySelector('[data-dia="lunes"]');for(const k of ['martes','miercoles','jueves','viernes']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=origen.querySelector('.v4-dia-cerrado').checked;for(const idx of [1,2]){row.querySelector(`.v4-a${idx}`).value=origen.querySelector(`.v4-a${idx}`).value;row.querySelector(`.v4-c${idx}`).value=origen.querySelector(`.v4-c${idx}`).value;}actualizarDia(row);}}
function cerrarFinde(){for(const k of ['sabado','domingo']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=true;actualizarDia(row);}}
document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener};
}());
