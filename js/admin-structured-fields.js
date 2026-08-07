(function(){
  'use strict';
  const SERVICIOS=['Mecánica general','Cambio de aceite','Frenos','Neumáticos','Diagnosis','Aire acondicionado','Electricidad','Baterías','Embrague','Distribución','Suspensión','Escape','Pre-ITV','Chapa y pintura','Alineación'];
  const DIAS=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const LABORABLES=['lunes','martes','miércoles','jueves','viernes'];
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const emitir=campo=>{campo.dispatchEvent(new Event('input',{bubbles:true}));campo.dispatchEvent(new Event('change',{bubbles:true}));};

  function montarServicios(){
    const campo=$('servicios');if(!campo||$('servicios-estructurados'))return;
    const panel=document.createElement('div');panel.id='servicios-estructurados';panel.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;margin-bottom:8px';
    panel.innerHTML=SERVICIOS.map((s,i)=>`<label style="display:flex;gap:7px;align-items:center;padding:7px;border:1px solid #dfe3e8;border-radius:9px;background:#fff"><input type="checkbox" data-servicio="${i}" style="width:auto">${s}</label>`).join('');
    campo.parentElement.insertBefore(panel,campo);campo.hidden=true;
    function reflejar(){const actuales=campo.value.split(/[\n,;]+/).map(norm).filter(Boolean);panel.querySelectorAll('[data-servicio]').forEach(ch=>ch.checked=actuales.includes(norm(SERVICIOS[Number(ch.dataset.servicio)])));}
    panel.addEventListener('change',e=>{const ch=e.target.closest('[data-servicio]');if(!ch)return;const nombre=SERVICIOS[Number(ch.dataset.servicio)];let lista=campo.value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).filter(x=>norm(x)!==norm(nombre));if(ch.checked)lista.push(nombre);campo.value=[...new Set(lista)].join('\n');emitir(campo);});
    campo.addEventListener('input',reflejar);reflejar();
  }

  function leerHorario(valor){
    if(!valor)return {};
    try{const obj=JSON.parse(valor);return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{};}catch{return {};}
  }

  function montarHorarios(){
    const campo=$('horarios');if(!campo||$('horarios-estructurados'))return;
    campo.hidden=true;
    const panel=document.createElement('section');panel.id='horarios-estructurados';panel.style.cssText='display:grid;gap:9px;margin-bottom:8px';
    panel.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><small style="color:#667085">Horario partido: mañana y tarde. Para horario continuo deja la tarde vacía.</small><button id="copiar-laborables" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #dfe3e8">Aplicar lunes–viernes</button></div><div style="display:grid;grid-template-columns:92px repeat(4,minmax(82px,1fr)) 78px;gap:6px;font-size:.76rem;color:#667085;padding:0 4px"><span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong></div>${DIAS.map(d=>`<div class="tm-horario-dia" style="display:grid;grid-template-columns:92px repeat(4,minmax(82px,1fr)) 78px;gap:6px;align-items:center"><strong style="text-transform:capitalize">${d}</strong><input type="time" data-dia="${d}" data-tipo="m1"><input type="time" data-dia="${d}" data-tipo="m2"><input type="time" data-dia="${d}" data-tipo="t1"><input type="time" data-dia="${d}" data-tipo="t2"><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-cerrado="${d}" style="width:auto"> Sí</label></div>`).join('')}<style>@media(max-width:760px){#horarios-estructurados>div:nth-child(2){display:none}.tm-horario-dia{grid-template-columns:90px 1fr 1fr!important}.tm-horario-dia input[data-tipo="t1"],.tm-horario-dia input[data-tipo="t2"]{margin-top:2px}.tm-horario-dia label{grid-column:2/-1}}</style>`;
    campo.parentElement.insertBefore(panel,campo);

    const get=(d,t)=>panel.querySelector(`[data-dia="${d}"][data-tipo="${t}"]`);
    function bloquear(d){const cerrado=panel.querySelector(`[data-cerrado="${d}"]`).checked;['m1','m2','t1','t2'].forEach(t=>{get(d,t).disabled=cerrado;get(d,t).style.opacity=cerrado?'.45':'1';});}
    function sincronizar(){const obj={};DIAS.forEach(d=>{const cerrado=panel.querySelector(`[data-cerrado="${d}"]`).checked;obj[d]=cerrado?{cerrado:true}:{abre_manana:get(d,'m1').value,cierra_manana:get(d,'m2').value,abre_tarde:get(d,'t1').value,cierra_tarde:get(d,'t2').value};});campo.value=JSON.stringify(obj,null,2);emitir(campo);}
    function reflejar(){const obj=leerHorario(campo.value);DIAS.forEach(d=>{const v=obj[d]||{};panel.querySelector(`[data-cerrado="${d}"]`).checked=Boolean(v.cerrado);get(d,'m1').value=v.abre_manana||v.abre||'';get(d,'m2').value=v.cierra_manana||v.cierra||'';get(d,'t1').value=v.abre_tarde||'';get(d,'t2').value=v.cierra_tarde||'';bloquear(d);});}
    panel.addEventListener('change',e=>{if(e.target.matches('[data-cerrado]'))bloquear(e.target.dataset.cerrado);sincronizar();});
    panel.querySelector('#copiar-laborables').addEventListener('click',()=>{const origen='lunes';LABORABLES.forEach(d=>{panel.querySelector(`[data-cerrado="${d}"]`).checked=panel.querySelector(`[data-cerrado="${origen}"]`).checked;['m1','m2','t1','t2'].forEach(t=>get(d,t).value=get(origen,t).value);bloquear(d);});sincronizar();});
    campo.addEventListener('input',reflejar);reflejar();
  }

  function iniciar(){montarServicios();montarHorarios();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
}());