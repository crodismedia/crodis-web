(function(){
  'use strict';

  const SERVICIOS=['Mecánica general','Cambio de aceite','Frenos','Neumáticos','Diagnosis','Aire acondicionado','Electricidad','Baterías','Embrague','Distribución','Suspensión','Escape','Pre-ITV','Chapa y pintura','Alineación'];
  const DIAS=[
    ['lunes','Lunes'],
    ['martes','Martes'],
    ['miercoles','Miércoles'],
    ['jueves','Jueves'],
    ['viernes','Viernes'],
    ['sabado','Sábado'],
    ['domingo','Domingo']
  ];
  const LABORABLES=['lunes','martes','miercoles','jueves','viernes'];
  const CLAVES_LEGACY={miercoles:'miércoles',sabado:'sábado'};
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const emitir=campo=>{campo.dispatchEvent(new Event('input',{bubbles:true}));campo.dispatchEvent(new Event('change',{bubbles:true}));};

  function esObjeto(valor){
    return Boolean(valor)&&typeof valor==='object'&&!Array.isArray(valor);
  }

  function leerHorario(valor){
    if(valor==null||valor==='')return null;
    if(esObjeto(valor))return valor;
    try{
      const objeto=JSON.parse(valor);
      return esObjeto(objeto)?objeto:null;
    }catch{
      return null;
    }
  }

  function valorDia(horarios,dia){
    if(!esObjeto(horarios))return undefined;
    return horarios[dia]??horarios[CLAVES_LEGACY[dia]];
  }

  function textoHora(valor){
    return String(valor||'').trim();
  }

  function turnosDelDia(valor){
    if(!esObjeto(valor))return [];

    if(Array.isArray(valor.turnos)){
      return valor.turnos.slice(0,2).map(turno=>({
        apertura:textoHora(turno?.apertura),
        cierre:textoHora(turno?.cierre)
      }));
    }

    const primero={
      apertura:textoHora(valor.abre_manana||valor.abre),
      cierre:textoHora(valor.cierra_manana||valor.cierra)
    };
    const segundo={
      apertura:textoHora(valor.abre_tarde),
      cierre:textoHora(valor.cierra_tarde)
    };
    const turnos=[];
    if(primero.apertura||primero.cierre)turnos.push(primero);
    if(segundo.apertura||segundo.cierre)turnos.push(segundo);
    return turnos;
  }

  function normalizarHorarios(valor){
    const horarios=leerHorario(valor);
    if(horarios==null)return null;

    const normalizados={};
    DIAS.forEach(([dia])=>{
      const original=valorDia(horarios,dia);
      if(!esObjeto(original)){
        normalizados[dia]={cerrado:true,turnos:[]};
        return;
      }

      const cerrado=original.cerrado===true;
      normalizados[dia]=cerrado
        ?{cerrado:true,turnos:[]}
        :{cerrado:false,turnos:turnosDelDia(original)};
    });
    return normalizados;
  }

  function validarHorarios(valor){
    if(valor==null||valor==='')return {valido:true,mensaje:''};

    const horarios=normalizarHorarios(valor);
    if(!esObjeto(horarios)){
      return {valido:false,mensaje:'El horario semanal no tiene un formato válido.'};
    }

    const dias=Object.entries(horarios);
    if(dias.length!==7){
      return {valido:false,mensaje:'Debes indicar el horario o marcar «Cerrado» en los siete días.'};
    }

    if(!dias.some(([,horario])=>horario.cerrado===false)){
      return {valido:false,mensaje:'El taller debe tener al menos un día abierto.'};
    }

    const patronHora=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for(const [dia,horario] of dias){
      const etiqueta=DIAS.find(([clave])=>clave===dia)?.[1]||dia;

      if(horario.cerrado===true)continue;
      if(!Array.isArray(horario.turnos)||horario.turnos.length<1||horario.turnos.length>2){
        return {valido:false,mensaje:`Completa al menos un turno válido para ${etiqueta}.`};
      }

      for(let indice=0;indice<horario.turnos.length;indice+=1){
        const turno=horario.turnos[indice];
        if(!patronHora.test(turno.apertura)||!patronHora.test(turno.cierre)){
          return {valido:false,mensaje:`Completa la apertura y el cierre de ${etiqueta}.`};
        }
        if(turno.cierre<=turno.apertura){
          return {valido:false,mensaje:`En ${etiqueta}, la hora de cierre debe ser posterior a la apertura.`};
        }
        if(indice===1&&turno.apertura<horario.turnos[0].cierre){
          return {valido:false,mensaje:`En ${etiqueta}, el segundo turno debe empezar después de terminar el primero.`};
        }
      }
    }

    return {valido:true,mensaje:''};
  }

  window.TallerMapHorarios={
    normalizar:normalizarHorarios,
    validar:validarHorarios
  };

  function montarServicios(){
    const campo=$('servicios');
    if(!campo||$('servicios-estructurados'))return;

    const panel=document.createElement('div');
    panel.id='servicios-estructurados';
    panel.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;margin-bottom:8px';
    panel.innerHTML=SERVICIOS.map((servicio,indice)=>`<label style="display:flex;gap:7px;align-items:center;padding:7px;border:1px solid #dfe3e8;border-radius:9px;background:#fff"><input type="checkbox" data-servicio="${indice}" style="width:auto">${servicio}</label>`).join('');
    campo.parentElement.insertBefore(panel,campo);
    campo.hidden=true;

    function reflejar(){
      const actuales=campo.value.split(/[\n,;]+/).map(norm).filter(Boolean);
      panel.querySelectorAll('[data-servicio]').forEach(check=>{
        check.checked=actuales.includes(norm(SERVICIOS[Number(check.dataset.servicio)]));
      });
    }

    panel.addEventListener('change',evento=>{
      const check=evento.target.closest('[data-servicio]');
      if(!check)return;
      const nombre=SERVICIOS[Number(check.dataset.servicio)];
      const lista=campo.value
        .split(/[\n,;]+/)
        .map(item=>item.trim())
        .filter(Boolean)
        .filter(item=>norm(item)!==norm(nombre));
      if(check.checked)lista.push(nombre);
      campo.value=[...new Set(lista)].join('\n');
      emitir(campo);
    });

    campo.addEventListener('input',reflejar);
    reflejar();
  }

  function montarHorarios(){
    const campo=$('horarios');
    if(!campo||$('horarios-estructurados'))return;

    campo.hidden=true;
    const panel=document.createElement('section');
    panel.id='horarios-estructurados';
    panel.style.cssText='display:grid;gap:9px;margin-bottom:8px';
    panel.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><small style="color:#667085">Horario partido: mañana y tarde. Para horario continuo deja la tarde vacía.</small><button id="copiar-laborables" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #dfe3e8">Aplicar lunes–viernes</button></div><div style="display:grid;grid-template-columns:92px repeat(4,minmax(82px,1fr)) 78px;gap:6px;font-size:.76rem;color:#667085;padding:0 4px"><span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong></div>${DIAS.map(([dia,etiqueta])=>`<div class="tm-horario-dia" style="display:grid;grid-template-columns:92px repeat(4,minmax(82px,1fr)) 78px;gap:6px;align-items:center"><strong>${etiqueta}</strong><input type="time" data-dia="${dia}" data-tipo="m1"><input type="time" data-dia="${dia}" data-tipo="m2"><input type="time" data-dia="${dia}" data-tipo="t1"><input type="time" data-dia="${dia}" data-tipo="t2"><label style="display:flex;gap:5px;align-items:center"><input type="checkbox" data-cerrado="${dia}" style="width:auto"> Sí</label></div>`).join('')}<p id="horarios-estructurados-error" role="alert" style="display:none;margin:0;color:#b42318;font-size:.86rem"></p><style>@media(max-width:760px){#horarios-estructurados>div:nth-child(2){display:none}.tm-horario-dia{grid-template-columns:90px 1fr 1fr!important}.tm-horario-dia input[data-tipo="t1"],.tm-horario-dia input[data-tipo="t2"]{margin-top:2px}.tm-horario-dia label{grid-column:2/-1}}</style>`;
    campo.parentElement.insertBefore(panel,campo);

    const get=(dia,tipo)=>panel.querySelector(`[data-dia="${dia}"][data-tipo="${tipo}"]`);
    const getCerrado=dia=>panel.querySelector(`[data-cerrado="${dia}"]`);
    const mensajeError=panel.querySelector('#horarios-estructurados-error');

    function bloquear(dia){
      const cerrado=getCerrado(dia).checked;
      ['m1','m2','t1','t2'].forEach(tipo=>{
        get(dia,tipo).disabled=cerrado;
        get(dia,tipo).style.opacity=cerrado?'.45':'1';
      });
    }

    function mostrarValidacion(horarios){
      const resultado=validarHorarios(horarios);
      mensajeError.textContent=resultado.mensaje;
      mensajeError.style.display=resultado.valido?'none':'block';
    }

    function sincronizar(){
      const horarios={};
      DIAS.forEach(([dia])=>{
        const cerrado=getCerrado(dia).checked;
        if(cerrado){
          horarios[dia]={cerrado:true,turnos:[]};
          return;
        }

        const turnos=[{
          apertura:get(dia,'m1').value,
          cierre:get(dia,'m2').value
        }];
        if(get(dia,'t1').value||get(dia,'t2').value){
          turnos.push({
            apertura:get(dia,'t1').value,
            cierre:get(dia,'t2').value
          });
        }
        horarios[dia]={cerrado:false,turnos};
      });

      campo.value=JSON.stringify(horarios,null,2);
      mostrarValidacion(horarios);
      emitir(campo);
    }

    function reflejar(){
      const horarios=leerHorario(campo.value);
      DIAS.forEach(([dia])=>{
        const original=valorDia(horarios,dia);
        const cerrado=!esObjeto(original)||original.cerrado===true;
        const turnos=cerrado?[]:turnosDelDia(original);
        getCerrado(dia).checked=cerrado;
        get(dia,'m1').value=turnos[0]?.apertura||'';
        get(dia,'m2').value=turnos[0]?.cierre||'';
        get(dia,'t1').value=turnos[1]?.apertura||'';
        get(dia,'t2').value=turnos[1]?.cierre||'';
        bloquear(dia);
      });
      mostrarValidacion(horarios);
    }

    panel.addEventListener('change',evento=>{
      if(evento.target.matches('[data-cerrado]'))bloquear(evento.target.dataset.cerrado);
      sincronizar();
    });

    panel.querySelector('#copiar-laborables').addEventListener('click',()=>{
      const origen='lunes';
      LABORABLES.forEach(dia=>{
        getCerrado(dia).checked=getCerrado(origen).checked;
        ['m1','m2','t1','t2'].forEach(tipo=>{
          get(dia,tipo).value=get(origen,tipo).value;
        });
        bloquear(dia);
      });
      sincronizar();
    });

    campo.addEventListener('input',reflejar);
    reflejar();
  }

  function iniciar(){
    montarServicios();
    montarHorarios();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
}());
