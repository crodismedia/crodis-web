(function(){
  'use strict';

  const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const LABORABLES = ['lunes','martes','miércoles','jueves','viernes'];
  const FIN_DE_SEMANA = ['sábado','domingo'];
  const $ = (id) => document.getElementById(id);

  function emitir(campo){
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    campo.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function interpretarHorario(valor){
    if (!valor) return null;
    try {
      const obj = JSON.parse(valor);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch (_) {}
    return null;
  }

  function montarHorarios(){
    const campo = $('horarios');
    if (!campo || $('horarios-estructurados')) return;

    campo.hidden = true;
    campo.setAttribute('aria-hidden','true');

    const panel = document.createElement('section');
    panel.id = 'horarios-estructurados';
    panel.style.cssText = 'display:grid;gap:10px;margin-bottom:8px';
    panel.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;padding:12px;border:1px solid #dfe3e8;border-radius:12px;background:#f8fafc">
        <div>
          <strong style="display:block;margin-bottom:3px">Horario semanal</strong>
          <span style="font-size:.84rem;color:#667085">Configura el lunes y copia el mismo horario al resto de días laborables. Sábado y domingo aparecen cerrados por defecto, pero puedes desmarcar Cerrado y asignarles horario.</span>
        </div>
        <button id="aplicar-lunes-viernes" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #cfd5dc">Aplicar lunes–viernes</button>
      </div>
      ${DIAS.map((dia)=>`<div class="tm-horario-dia" style="display:grid;grid-template-columns:100px minmax(120px,1fr) minmax(120px,1fr) auto;gap:8px;align-items:center;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><strong style="text-transform:capitalize">${dia}</strong><input type="time" data-dia="${dia}" data-tipo="abre" aria-label="Apertura ${dia}"><input type="time" data-dia="${dia}" data-tipo="cierra" aria-label="Cierre ${dia}"><label style="display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" data-cerrado="${dia}" style="width:auto" ${FIN_DE_SEMANA.includes(dia)?'checked':''}> Cerrado</label></div>`).join('')}
      <style>@media(max-width:700px){#horarios-estructurados .tm-horario-dia{grid-template-columns:1fr 1fr}#horarios-estructurados .tm-horario-dia strong{grid-column:1/-1}}</style>
    `;
    campo.parentElement.insertBefore(panel,campo);

    function actualizarBloqueo(dia){
      const cerrado = panel.querySelector(`[data-cerrado="${dia}"]`).checked;
      const abre = panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`);
      const cierra = panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`);
      abre.disabled = cerrado;
      cierra.disabled = cerrado;
      abre.style.opacity = cerrado ? '.45' : '1';
      cierra.style.opacity = cerrado ? '.45' : '1';
    }

    function sincronizarTexto(){
      const obj = {};
      DIAS.forEach((dia)=>{
        const cerrado = panel.querySelector(`[data-cerrado="${dia}"]`).checked;
        const abre = panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`).value;
        const cierra = panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`).value;
        obj[dia] = cerrado ? {cerrado:true} : {abre,cierra};
      });
      campo.value = JSON.stringify(obj,null,2);
      emitir(campo);
    }

    function reflejarDesdeTexto(){
      const obj = interpretarHorario(campo.value);
      DIAS.forEach((dia)=>{
        const tieneValor = Boolean(obj && Object.prototype.hasOwnProperty.call(obj,dia));
        const valor = tieneValor ? (obj[dia] || {}) : {};
        const cerradoPorDefecto = FIN_DE_SEMANA.includes(dia) && !tieneValor;
        panel.querySelector(`[data-cerrado="${dia}"]`).checked = tieneValor ? Boolean(valor.cerrado) : cerradoPorDefecto;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`).value = valor.abre || '';
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`).value = valor.cierra || '';
        actualizarBloqueo(dia);
      });
      if (!obj) sincronizarTexto();
    }

    panel.addEventListener('change',(e)=>{
      if (e.target.matches('[data-cerrado]')) actualizarBloqueo(e.target.dataset.cerrado);
      sincronizarTexto();
    });

    panel.querySelector('#aplicar-lunes-viernes').addEventListener('click',()=>{
      const lunesCerrado = panel.querySelector('[data-cerrado="lunes"]').checked;
      const lunesAbre = panel.querySelector('[data-dia="lunes"][data-tipo="abre"]').value;
      const lunesCierra = panel.querySelector('[data-dia="lunes"][data-tipo="cierra"]').value;
      LABORABLES.forEach((dia)=>{
        panel.querySelector(`[data-cerrado="${dia}"]`).checked = lunesCerrado;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`).value = lunesAbre;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`).value = lunesCierra;
        actualizarBloqueo(dia);
      });
      sincronizarTexto();
    });

    campo.addEventListener('input',reflejarDesdeTexto);
    document.addEventListener('click',(e)=>{
      if(e.target.closest('.tm-result')) setTimeout(reflejarDesdeTexto,0);
    });
    reflejarDesdeTexto();
  }

  function iniciar(){
    montarHorarios();
    document.getElementById('prueba-guiada')?.remove();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
}());
