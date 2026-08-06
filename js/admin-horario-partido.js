(function(){
  'use strict';
  const dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const textarea=document.getElementById('horarios');
  if(!textarea)return;
  const wrap=textarea.closest('.tm-field');
  if(!wrap||document.getElementById('horario-partido-grid'))return;
  const panel=document.createElement('div');
  panel.id='horario-partido-grid';
  panel.style.cssText='display:grid;gap:8px;margin-top:8px';
  panel.innerHTML='<small class="tm-status">Puedes indicar horario continuo o jornada partida de mañana y tarde.</small>'+dias.map((d,i)=>`<div style="display:grid;grid-template-columns:110px repeat(4,minmax(78px,1fr));gap:6px;align-items:center"><strong>${d}</strong><input type="time" data-dia="${i}" data-turno="m1" aria-label="${d} apertura mañana"><input type="time" data-dia="${i}" data-turno="m2" aria-label="${d} cierre mañana"><input type="time" data-dia="${i}" data-turno="t1" aria-label="${d} apertura tarde"><input type="time" data-dia="${i}" data-turno="t2" aria-label="${d} cierre tarde"></div>`).join('');
  wrap.appendChild(panel);
  function sync(){
    const lineas=dias.map((d,i)=>{
      const v=t=>panel.querySelector(`[data-dia="${i}"][data-turno="${t}"]`).value;
      const m1=v('m1'),m2=v('m2'),t1=v('t1'),t2=v('t2');
      if(!m1&&!m2&&!t1&&!t2)return `${d}: Cerrado`;
      const tramos=[];
      if(m1&&m2)tramos.push(`${m1}-${m2}`);
      if(t1&&t2)tramos.push(`${t1}-${t2}`);
      return `${d}: ${tramos.join(' / ')}`;
    });
    textarea.value=lineas.join('\n');
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
  }
  panel.addEventListener('input',sync);
}());