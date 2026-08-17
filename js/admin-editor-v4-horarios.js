(function(){
"use strict";
const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
let root=null;

function render(){
  root=document.getElementById('v4-horarios-editor');
  if(!root)return;
  root.innerHTML=`<div class="v4-horarios v4-horarios-directos"><p class="v4-status v4-horario-ayuda">Escribe el horario directamente. Ejemplo: <strong>09:00-14:00 / 16:00-19:00</strong>. Para un día sin apertura escribe <strong>Cerrado</strong>.</p>${DIAS.map(([k,n])=>`<div class="v4-dia" data-dia="${k}"><strong>${n}</strong><input class="v4-horario-dia" type="text" inputmode="text" autocomplete="off" placeholder="09:00-14:00 / 16:00-19:00 o Cerrado"></div>`).join('')}</div><div class="v4-horario-acciones"><button id="v4-limpiar-horario" class="v4-btn v4-soft" type="button">Quitar horario</button></div>`;
  document.getElementById('v4-limpiar-horario')?.addEventListener('click',()=>cargar(null));
  cargar(null);
}

function horaNormalizada(valor){
  let s=String(valor??'').trim().replace('.',':');
  if(/^\d{1,2}$/.test(s))s+=':00';
  const m=s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return null;
  const h=Number(m[1]),min=Number(m[2]);
  if(min<0||min>59||h<0||h>24||(h===24&&min!==0))return null;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

function minutos(hora){
  if(hora==='24:00')return 1440;
  const [h,m]=hora.split(':').map(Number);
  return h*60+m;
}

function parseTurno(texto){
  const partes=String(texto??'').trim().split(/\s*(?:-|–|—|\ba\b|\bhasta\b)\s*/i).filter(Boolean);
  if(partes.length!==2)return null;
  const apertura=horaNormalizada(partes[0]),cierre=horaNormalizada(partes[1]);
  if(!apertura||!cierre||minutos(cierre)<=minutos(apertura))return null;
  return{apertura,cierre};
}

function parseDia(valor,nombre){
  const original=String(valor??'').trim();
  if(!original)return{valido:true,cerrado:true,turnos:[]};
  if(/^(cerrado|cerrada|cierra|closed)$/i.test(original))return{valido:true,cerrado:true,turnos:[]};
  const trozos=original.split(/\s*(?:\/|;|,)\s*/).filter(Boolean);
  if(!trozos.length||trozos.length>2)return{valido:false,mensaje:`${nombre}: usa uno o dos turnos, por ejemplo 09:00-14:00 / 16:00-19:00.`};
  const turnos=[];
  for(const trozo of trozos){
    const turno=parseTurno(trozo);
    if(!turno)return{valido:false,mensaje:`${nombre}: horario no válido. Usa por ejemplo 09:00-14:00 o escribe Cerrado.`};
    turnos.push(turno);
  }
  if(turnos.length===2&&minutos(turnos[1].apertura)<minutos(turnos[0].cierre))return{valido:false,mensaje:`${nombre}: los dos turnos se solapan.`};
  return{valido:true,cerrado:false,turnos};
}

function formatDia(dia){
  if(!dia||typeof dia!=='object')return'';
  if(dia.cerrado)return'Cerrado';
  if(!Array.isArray(dia.turnos))return'';
  return dia.turnos.map(t=>`${t?.apertura||''}-${t?.cierre||''}`).filter(t=>t!=='-').join(' / ');
}

function cargar(valor){
  if(!root){render();return;}
  DIAS.forEach(([k])=>{
    const input=root.querySelector(`[data-dia="${k}"] .v4-horario-dia`);
    if(input)input.value=formatDia(valor?.[k]);
  });
}

function obtener(){
  if(!root)return{valido:true,valor:null};
  const entradas=DIAS.map(([k,n])=>({k,n,valor:root.querySelector(`[data-dia="${k}"] .v4-horario-dia`)?.value||''}));
  if(entradas.every(x=>!String(x.valor).trim()))return{valido:true,valor:null};
  const resultado={};
  let abiertos=0;
  for(const {k,n,valor} of entradas){
    const dia=parseDia(valor,n);
    if(!dia.valido)return dia;
    resultado[k]={cerrado:dia.cerrado,turnos:dia.turnos};
    if(!dia.cerrado)abiertos++;
  }
  if(!abiertos)return{valido:false,mensaje:'El horario no puede tener todos los días cerrados. Si no conoces el horario, pulsa Quitar horario.'};
  return{valido:true,valor:resultado};
}

document.addEventListener('DOMContentLoaded',render);
window.TallerMapHorariosV4={cargar,obtener};
}());
