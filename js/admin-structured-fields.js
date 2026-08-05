(function(){
  'use strict';

  const SERVICIOS = [
    'Mecánica general','Cambio de aceite','Frenos','Neumáticos','Diagnosis',
    'Aire acondicionado','Electricidad','Baterías','Embrague','Distribución',
    'Suspensión','Escape','Pre-ITV','Chapa y pintura','Alineación'
  ];
  const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const $ = (id) => document.getElementById(id);

  function normalizar(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function emitir(campo){
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    campo.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function montarServicios(){
    const campo = $('servicios');
    if (!campo || $('servicios-estructurados')) return;
    const panel = document.createElement('div');
    panel.id = 'servicios-estructurados';
    panel.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;margin-bottom:8px';
    panel.innerHTML = SERVICIOS.map((s,i)=>`<label style="display:flex;gap:7px;align-items:center;padding:7px;border:1px solid #dfe3e8;border-radius:9px;background:#fff"><input type="checkbox" data-servicio="${i}" style="width:auto">${s}</label>`).join('');
    campo.parentElement.insertBefore(panel,campo);

    function reflejarDesdeTexto(){
      const actuales = campo.value.split(/[\n,;]+/).map(normalizar).filter(Boolean);
      panel.querySelectorAll('[data-servicio]').forEach((check)=>{
        const nombre = SERVICIOS[Number(check.dataset.servicio)];
        check.checked = actuales.some((x)=>x===normalizar(nombre));
      });
    }

    panel.addEventListener('change',(e)=>{
      const check = e.target.closest('[data-servicio]');
      if (!check) return;
      const nombre = SERVICIOS[Number(check.dataset.servicio)];
      let lista = campo.value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
      lista = lista.filter((x)=>normalizar(x)!==normalizar(nombre));
      if (check.checked) lista.push(nombre);
      campo.value = [...new Set(lista)].join('\n');
      emitir(campo);
    });
    campo.addEventListener('input',reflejarDesdeTexto);
    document.addEventListener('click',(e)=>{if(e.target.closest('.tm-result')) setTimeout(reflejarDesdeTexto,0);});
    reflejarDesdeTexto();
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
    const panel = document.createElement('div');
    panel.id = 'horarios-estructurados';
    panel.style.cssText = 'display:grid;gap:7px;margin-bottom:8px';
    panel.innerHTML = DIAS.map((dia)=>`<div style="display:grid;grid-template-columns:90px 1fr 1fr auto;gap:7px;align-items:center"><strong style="text-transform:capitalize">${dia}</strong><input type="time" data-dia="${dia}" data-tipo="abre"><input type="time" data-dia="${dia}" data-tipo="cierra"><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-cerrado="${dia}" style="width:auto"> Cerrado</label></div>`).join('');
    campo.parentElement.insertBefore(panel,campo);

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
      if (!obj) return;
      DIAS.forEach((dia)=>{
        const valor = obj[dia] || {};
        panel.querySelector(`[data-cerrado="${dia}"]`).checked = Boolean(valor.cerrado);
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`).value = valor.abre || '';
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`).value = valor.cierra || '';
      });
    }

    panel.addEventListener('change',(e)=>{
      if (e.target.matches('[data-cerrado]')) {
        const dia = e.target.dataset.cerrado;
        const desactivar = e.target.checked;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="abre"]`).disabled = desactivar;
        panel.querySelector(`[data-dia="${dia}"][data-tipo="cierra"]`).disabled = desactivar;
      }
      sincronizarTexto();
    });
    campo.addEventListener('input',reflejarDesdeTexto);
    document.addEventListener('click',(e)=>{if(e.target.closest('.tm-result')) setTimeout(reflejarDesdeTexto,0);});
    reflejarDesdeTexto();
  }

  function iniciar(){
    montarServicios();
    montarHorarios();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
}());
