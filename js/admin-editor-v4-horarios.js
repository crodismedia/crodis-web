(() => {
  'use strict';

  const DIAS=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
  const LEGACY={miercoles:'miércoles',sabado:'sábado'};
  const OPCIONES_HORA='<option value="">—</option>'+Array.from({length:96},(_,indice)=>{
    const minutos=indice*15;
    const valor=`${String(Math.floor(minutos/60)).padStart(2,'0')}:${String(minutos%60).padStart(2,'0')}`;
    return `<option value="${valor}">${valor}</option>`;
  }).join('');
  const panel=document.getElementById('v4-horarios-editor');
  const campo=document.getElementById('v4-horarios');
  if(!panel||!campo)return;

  const esObjeto=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
  const hora=v=>String(v||'').trim();
  const fila=dia=>panel.querySelector(`[data-hours-row="${dia}"]`);
  const cerrado=dia=>panel.querySelector(`[data-hours-closed="${dia}"]`);
  const control=(dia,tipo)=>panel.querySelector(`[data-hours-day="${dia}"][data-hours-kind="${tipo}"]`);
  let horarioInicialVacio=false;

  function establecerHora(dia,tipo,valor){
    const selector=control(dia,tipo);
    const guardado=hora(valor);
    if(guardado&&![...selector.options].some(opcion=>opcion.value===guardado))selector.add(new Option(guardado,guardado));
    selector.value=guardado;
  }

  function turnos(valor){
    if(!esObjeto(valor))return [];
    if(Array.isArray(valor.turnos))return valor.turnos.slice(0,2).map(t=>({apertura:hora(t?.apertura),cierre:hora(t?.cierre)}));
    return [
      {apertura:hora(valor.abre_manana||valor.abre),cierre:hora(valor.cierra_manana||valor.cierra)},
      {apertura:hora(valor.abre_tarde),cierre:hora(valor.cierra_tarde)}
    ].filter(t=>t.apertura||t.cierre);
  }

  function normalizar(valor){
    if(valor==null||valor==='')return null;
    if(typeof valor==='string'){try{valor=JSON.parse(valor);}catch{return null;}}
    if(!esObjeto(valor))return null;
    return Object.fromEntries(DIAS.map(([dia])=>{
      const original=valor[dia]??valor[LEGACY[dia]];
      if(!esObjeto(original))return [dia,{cerrado:true,turnos:[]}];
      return [dia,original?.cerrado===true?{cerrado:true,turnos:[]}:{cerrado:false,turnos:turnos(original)}];
    }));
  }

  function validar(valor){
    if(valor==null)return {valido:true,mensaje:'Horario no confirmado.'};
    if(!esObjeto(valor)||DIAS.some(([dia])=>!Object.prototype.hasOwnProperty.call(valor,dia)))return {valido:false,mensaje:'Completa los siete días.'};
    if(!DIAS.some(([dia])=>valor[dia]?.cerrado===false))return {valido:false,mensaje:'Debe existir al menos un día abierto.'};
    const patron=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for(const [dia,etiqueta] of DIAS){
      const actual=valor[dia];
      fila(dia)?.classList.remove('is-invalid');
      if(actual?.cerrado===true)continue;
      if(!Array.isArray(actual?.turnos)||actual.turnos.length<1||actual.turnos.length>2){fila(dia)?.classList.add('is-invalid');return {valido:false,mensaje:`Completa al menos un turno para ${etiqueta}.`};}
      for(let i=0;i<actual.turnos.length;i+=1){
        const turno=actual.turnos[i];
        if(!patron.test(turno.apertura)||!patron.test(turno.cierre)){fila(dia)?.classList.add('is-invalid');return {valido:false,mensaje:`Completa apertura y cierre de ${etiqueta}.`};}
        if(turno.cierre<=turno.apertura){fila(dia)?.classList.add('is-invalid');return {valido:false,mensaje:`El cierre de ${etiqueta} debe ser posterior a la apertura.`};}
        if(i===1&&turno.apertura<actual.turnos[0].cierre){fila(dia)?.classList.add('is-invalid');return {valido:false,mensaje:`El segundo turno de ${etiqueta} se solapa con el primero.`};}
      }
    }
    return {valido:true,mensaje:'Horario semanal válido.'};
  }

  panel.className='v4-hours';
  panel.innerHTML=`
    <div class="v4-hours-tools">
      <label><input id="v4-horario-sin-confirmar" type="checkbox"> Horario no confirmado</label>
      <div class="v4-actions"><button id="v4-horario-laborables" class="v4-btn v4-soft" type="button">Copiar lunes a viernes</button><button id="v4-horario-fin-semana" class="v4-btn v4-soft" type="button">Cerrar fin de semana</button></div>
    </div>
    <div class="v4-hours-head"><span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong></div>
    ${DIAS.map(([dia,etiqueta])=>`<div class="v4-hours-row" data-hours-row="${dia}"><strong>${etiqueta}</strong><select data-hours-day="${dia}" data-hours-kind="m1" aria-label="${etiqueta} apertura mañana">${OPCIONES_HORA}</select><select data-hours-day="${dia}" data-hours-kind="m2" aria-label="${etiqueta} cierre mañana">${OPCIONES_HORA}</select><select data-hours-day="${dia}" data-hours-kind="t1" aria-label="${etiqueta} apertura tarde">${OPCIONES_HORA}</select><select data-hours-day="${dia}" data-hours-kind="t2" aria-label="${etiqueta} cierre tarde">${OPCIONES_HORA}</select><label><input type="checkbox" data-hours-closed="${dia}"> Sí</label></div>`).join('')}
    <p id="v4-horarios-mensaje" class="v4-hours-message" role="status"></p>`;

  const sinConfirmar=document.getElementById('v4-horario-sin-confirmar');
  const mensaje=document.getElementById('v4-horarios-mensaje');

  function bloquearDia(dia){
    const bloqueado=sinConfirmar.checked||cerrado(dia).checked;
    ['m1','m2','t1','t2'].forEach(tipo=>{control(dia,tipo).disabled=bloqueado;});
    fila(dia).classList.toggle('is-closed',cerrado(dia).checked);
  }

  function leer(){
    if(sinConfirmar.checked)return null;
    const sinMarcasNiHoras=DIAS.every(([dia])=>!cerrado(dia).checked&&['m1','m2','t1','t2'].every(tipo=>!control(dia,tipo).value));
    if(horarioInicialVacio&&sinMarcasNiHoras)return null;
    return Object.fromEntries(DIAS.map(([dia])=>{
      if(cerrado(dia).checked)return [dia,{cerrado:true,turnos:[]}];
      const primero={apertura:control(dia,'m1').value,cierre:control(dia,'m2').value};
      const segundo={apertura:control(dia,'t1').value,cierre:control(dia,'t2').value};
      return [dia,{cerrado:false,turnos:[primero,segundo].filter(t=>t.apertura||t.cierre)}];
    }));
  }

  function sincronizar(){
    DIAS.forEach(([dia])=>fila(dia).classList.remove('is-invalid'));
    const valor=leer();
    const resultado=validar(valor);
    campo.value=valor==null?'':JSON.stringify(valor);
    mensaje.textContent=resultado.mensaje;
    mensaje.classList.toggle('error',!resultado.valido);
    return {...resultado,valor};
  }

  function cargar(valor){
    const normalizado=normalizar(valor);
    horarioInicialVacio=normalizado==null;
    const datos=normalizado||Object.fromEntries(DIAS.map(([dia])=>[dia,{cerrado:false,turnos:[]}]));
    sinConfirmar.checked=false;
    DIAS.forEach(([dia])=>{
      const actual=datos[dia]||{cerrado:true,turnos:[]};
      cerrado(dia).checked=actual.cerrado===true;
      establecerHora(dia,'m1',actual.turnos?.[0]?.apertura);
      establecerHora(dia,'m2',actual.turnos?.[0]?.cierre);
      establecerHora(dia,'t1',actual.turnos?.[1]?.apertura);
      establecerHora(dia,'t2',actual.turnos?.[1]?.cierre);
      bloquearDia(dia);
    });
    sincronizar();
  }

  panel.addEventListener('change',evento=>{
    horarioInicialVacio=false;
    const check=evento.target.closest('[data-hours-closed]');
    if(check&&check.checked){['m1','m2','t1','t2'].forEach(tipo=>{control(check.dataset.hoursClosed,tipo).value='';});}
    if(evento.target===sinConfirmar&&!sinConfirmar.checked&&DIAS.every(([dia])=>cerrado(dia).checked)){
      DIAS.forEach(([dia],indice)=>{const abierto=indice<5;cerrado(dia).checked=!abierto;if(abierto){control(dia,'m1').value='09:00';control(dia,'m2').value='13:30';control(dia,'t1').value='15:30';control(dia,'t2').value='18:30';}});
    }
    DIAS.forEach(([dia])=>bloquearDia(dia));
    sincronizar();
  });

  document.getElementById('v4-horario-laborables').addEventListener('click',()=>{
    sinConfirmar.checked=false;
    ['lunes','martes','miercoles','jueves','viernes'].forEach(dia=>{cerrado(dia).checked=cerrado('lunes').checked;['m1','m2','t1','t2'].forEach(tipo=>{control(dia,tipo).value=control('lunes',tipo).value;});bloquearDia(dia);});
    sincronizar();
  });
  document.getElementById('v4-horario-fin-semana').addEventListener('click',()=>{['sabado','domingo'].forEach(dia=>{cerrado(dia).checked=true;['m1','m2','t1','t2'].forEach(tipo=>{control(dia,tipo).value='';});bloquearDia(dia);});sincronizar();});

  window.TallerMapHorariosV4={cargar,obtener:sincronizar,validar};
  cargar(null);
})();
