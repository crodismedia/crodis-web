(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
const HORAS=[];
for(let h=0;h<24;h++)for(let m=0;m<60;m+=5)HORAS.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'));
let root=null;
function opcionesHora(valor=''){
  const actual=String(valor||'').trim();
  let html='<option value="">--:--</option>';
  if(actual&&!HORAS.includes(actual))html+=`<option value="${actual}">${actual}</option>`;
  html+=HORAS.map(h=>`<option value="${h}"${h===actual?' selected':''}>${h}</option>`).join('');
  return html;
}
function selector(clase,etiqueta){return `<select class="${clase}" aria-label="${etiqueta}">${opcionesHora()}</select>`;}
function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horarios"><label class="v4-service"><input id="v4-horario-confirmado" type="checkbox"><span><strong>Horario confirmado</strong><br><small>Márcalo solo cuando hayas verificado el horario. Puedes editarlo antes.</small></span></label>${DIAS.map(([k,n])=>`<div class="v4-dia" data-dia="${k}"><strong>${n}</strong><label><input class="v4-dia-cerrado" type="checkbox"> Cerrado</label><div class="v4-turno">${selector('v4-a1',n+' apertura primer turno')}<span>–</span>${selector('v4-c1',n+' cierre primer turno')}</div><div class="v4-turno">${selector('v4-a2',n+' apertura segundo turno')}<span>–</span>${selector('v4-c2',n+' cierre segundo turno')}</div></div>`).join('')}</div><div class="v4-horario-acciones"><button id="v4-copiar-laborables" class="v4-btn v4-soft" type="button">Copiar lunes a laborables</button><button id="v4-cerrar-finde" class="v4-btn v4-soft" type="button">Cerrar fin de semana</button><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  root.addEventListener('change',e=>{if(e.target.classList.contains('v4-dia-cerrado'))actualizarDia(e.target.closest('.v4-dia'));});
  document.getElementById('v4-copiar-laborables').addEventListener('click',copiarLaborables);
  document.getElementById('v4-cerrar-finde').addEventListener('click',cerrarFinde);
  document.getElementById('v4-limpiar-horario').addEventListener('click',()=>cargar(null));
  cargar(null);
}
function actualizarDia(row){const cerrado=row.querySelector('.v4-dia-cerrado').checked;row.querySelectorAll('.v4-turno select').forEach(i=>{i.disabled=cerrado;if(cerrado)i.value='';});}
function actualizarBloque(){root.querySelectorAll('.v4-dia').forEach(actualizarDia);}
function asignar(select,valor){const v=String(valor||'').trim();if(v&&![...select.options].some(o=>o.value===v)){const o=new Option(v,v);select.add(o,1);}select.value=v;}
function setTurno(row,idx,t){asignar(row.querySelector(`.v4-a${idx}`),t?.apertura||'');asignar(row.querySelector(`.v4-c${idx}`),t?.cierre||'');}
function cargar(valor){if(!root)render();const confirmado=!!valor&&typeof valor==='object';document.getElementById('v4-horario-confirmado').checked=confirmado;DIAS.forEach(([k])=>{const row=root.querySelector(`[data-dia="${k}"]`),dia=valor?.[k];row.querySelector('.v4-dia-cerrado').checked=!!dia?.cerrado;setTurno(row,1,dia?.turnos?.[0]);setTurno(row,2,dia?.turnos?.[1]);});actualizarBloque();}
function horaValida(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
function rangoValido(a,c){return horaValida(a)&&horaValida(c)&&a<c;}
function obtener(){const confirmado=!!document.getElementById('v4-horario-confirmado')?.checked;const resultado={};let abiertos=0,hayDatos=false;for(const [k,n] of DIAS){const row=root.querySelector(`[data-dia="${k}"]`),cerrado=row.querySelector('.v4-dia-cerrado').checked,turnos=[];if(cerrado)hayDatos=true;else{for(const idx of [1,2]){const a=row.querySelector(`.v4-a${idx}`).value,c=row.querySelector(`.v4-c${idx}`).value;if(!a&&!c)continue;hayDatos=true;if(!rangoValido(a,c))return{valido:false,mensaje:`Horario no válido en ${n}: selecciona apertura y cierre.`};turnos.push({apertura:a,cierre:c});}if(turnos.length===2&&turnos[0].cierre>turnos[1].apertura)return{valido:false,mensaje:`${n}: los turnos se solapan.`};if(turnos.length)abiertos++;}resultado[k]={cerrado,turnos};}
if(!hayDatos)return{valido:true,valor:null};if(!confirmado)return{valido:false,mensaje:'Has introducido un horario. Márcalo como “Horario confirmado” antes de guardar.'};if(!abiertos)return{valido:false,mensaje:'El horario confirmado no puede tener todos los días cerrados.'};for(const [k,n] of DIAS){const dia=resultado[k];if(!dia.cerrado&&!dia.turnos.length)return{valido:false,mensaje:`${n}: marca Cerrado o añade al menos un turno.`};}return{valido:true,valor:resultado};}
function copiarLaborables(){const origen=root.querySelector('[data-dia="lunes"]');for(const k of ['martes','miercoles','jueves','viernes']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=origen.querySelector('.v4-dia-cerrado').checked;for(const idx of [1,2]){row.querySelector(`.v4-a${idx}`).value=origen.querySelector(`.v4-a${idx}`).value;row.querySelector(`.v4-c${idx}`).value=origen.querySelector(`.v4-c${idx}`).value;}actualizarDia(row);}}
function cerrarFinde(){for(const k of ['sabado','domingo']){const row=root.querySelector(`[data-dia="${k}"]`);row.querySelector('.v4-dia-cerrado').checked=true;actualizarDia(row);}}
document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener};
}());
