(function(){
  'use strict';

  const DIAS=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const LABORABLES=['lunes','martes','miércoles','jueves','viernes'];
  const FIN_DE_SEMANA=['sábado','domingo'];
  const $=id=>document.getElementById(id);

  function emitir(campo){
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    campo.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function interpretarHorario(valor){
    if(!valor)return null;
    try{
      const obj=JSON.parse(valor);
      return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:null;
    }catch(_){return null;}
  }

  function montarHorarios(){
    const campo=$('horarios');
    if(!campo||$('horarios-estructurados'))return;

    document.getElementById('horario-partido-grid')?.remove();
    campo.hidden=true;
    campo.setAttribute('aria-hidden','true');

    const panel=document.createElement('section');
    panel.id='horarios-estructurados';
    panel.style.cssText='display:grid;gap:10px;margin-bottom:8px';
    panel.innerHTML=`
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding:12px;border:1px solid #dfe3e8;border-radius:12px;background:#f8fafc">
        <div>
          <strong style="display:block;margin-bottom:3px">Horario semanal</strong>
          <span style="font-size:.84rem;color:#667085">Indica mañana y tarde. Para horario continuo usa solo apertura mañana y cierre mañana.</span>
        </div>
        <button id="aplicar-lunes-viernes" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #cfd5dc">Aplicar lunes–viernes</button>
      </div>
      <div class="tm-horario-cabecera" style="display:grid;grid-template-columns:92px repeat(4,minmax(95px,1fr)) auto;gap:8px;padding:0 10px;color:#667085;font-size:.78rem;font-weight:700">
        <span>Día</span><span>Abre mañana</span><span>Cierra mañana</span><span>Abre tarde</span><span>Cierra tarde</span><span>Cerrado</span>
      </div>
      ${DIAS.map(dia=>`<div class="tm-horario-dia" style="display:grid;grid-template-columns:92px repeat(4,minmax(95px,1fr)) auto;gap:8px;align-items:center;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">
        <strong style="text-transform:capitalize">${dia}</strong>
        <input type="time" data-dia="${dia}" data-tipo="abre_manana" aria-label="Apertura de mañana ${dia}">
        <input type="time" data-dia="${dia}" data-tipo="cierra_manana" aria-label="Cierre de mañana ${dia}">
        <input type="time" data-dia="${dia}" data-tipo="abre_tarde" aria-label="Apertura de tarde ${dia}">
        <input type="time" data-dia="${dia}" data-tipo="cierra_tarde" aria-label="Cierre de tarde ${dia}">
        <label style="display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" data-cerrado="${dia}" style="width:auto" ${FIN_DE_SEMANA.includes(dia)?'checked':''}> Cerrado</label>
      </div>`).join('')}
      <style>
        @media(max-width:900px){#horarios-estructurados .tm-horario-cabecera{display:none}#horarios-estructurados .tm-horario-dia{grid-template-columns:1fr 1fr}#horarios-estructurados .tm-horario-dia strong{grid-column:1/-1}}
      </style>`;
    campo.parentElement.insertBefore(panel,campo);

    const tipos=['abre_manana','cierra_manana','abre_tarde','cierra_tarde'];

    function actualizarBloqueo(dia){
      const cerrado=panel.querySelector(`[data-cerrado="${dia}"]`).checked;
      tipos.forEach(tipo=>{
        const input=panel.querySelector(`[data-dia="${dia}"][data-tipo="${tipo}"]`);
        input.disabled=cerrado;
        input.style.opacity=cerrado?'.45':'1';
      });
    }

    function sincronizarTexto(){
      const obj={};
      DIAS.forEach(dia=>{
        const cerrado=panel.querySelector(`[data-cerrado="${dia}"]`).checked;
        const valor={cerrado};
        tipos.forEach(tipo=>valor[tipo]=panel.querySelector(`[data-dia="${dia}"][data-tipo="${tipo}"]`).value);
        obj[dia]=valor;
      });
      campo.value=JSON.stringify(obj,null,2);
      emitir(campo);
    }

    function reflejarDesdeTexto(){
      const obj=interpretarHorario(campo.value);
      DIAS.forEach(dia=>{
        const tieneValor=Boolean(obj&&Object.prototype.hasOwnProperty.call(obj,dia));
        const valor=tieneValor?(obj[dia]||{}):{};
        const cerradoPorDefecto=FIN_DE_SEMANA.includes(dia)&&!tieneValor;
        panel.querySelector(`[data-cerrado="${dia}"]`).checked=tieneValor?Boolean(valor.cerrado):cerradoPorDefecto;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre_manana"]`).value=valor.abre_manana||valor.abre||'';
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra_manana"]`).value=valor.cierra_manana||valor.cierra||'';
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre_tarde"]`).value=valor.abre_tarde||'';
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra_tarde"]`).value=valor.cierra_tarde||'';
        actualizarBloqueo(dia);
      });
      if(!obj)sincronizarTexto();
    }

    panel.addEventListener('change',e=>{
      if(e.target.matches('[data-cerrado]'))actualizarBloqueo(e.target.dataset.cerrado);
      sincronizarTexto();
    });

    panel.querySelector('#aplicar-lunes-viernes').addEventListener('click',()=>{
      const lunes={cerrado:panel.querySelector('[data-cerrado="lunes"]').checked};
      tipos.forEach(tipo=>lunes[tipo]=panel.querySelector(`[data-dia="lunes"][data-tipo="${tipo}"]`).value);
      LABORABLES.forEach(dia=>{
        panel.querySelector(`[data-cerrado="${dia}"]`).checked=lunes.cerrado;
        tipos.forEach(tipo=>panel.querySelector(`[data-dia="${dia}"][data-tipo="${tipo}"]`).value=lunes[tipo]);
        actualizarBloqueo(dia);
      });
      sincronizarTexto();
    });

    campo.addEventListener('input',reflejarDesdeTexto);
    document.addEventListener('click',e=>{if(e.target.closest('.tm-result'))setTimeout(reflejarDesdeTexto,0);});
    reflejarDesdeTexto();
  }

  function iniciar(){
    montarHorarios();
    document.getElementById('prueba-guiada')?.remove();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
}());