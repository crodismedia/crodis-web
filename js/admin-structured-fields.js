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
  const emitir=campo=>{
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    campo.dispatchEvent(new Event('change',{bubbles:true}));
  };

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
    const texto=String(valor||'').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto)?texto:'';
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

      if(original.cerrado===true){
        normalizados[dia]={cerrado:true,turnos:[]};
        return;
      }

      const turnos=turnosDelDia(original).filter(turno=>turno.apertura||turno.cierre);
      normalizados[dia]={cerrado:false,turnos};
    });
    return normalizados;
  }

  function validarHorarios(valor){
    if(valor==null||valor==='')return {valido:true,mensaje:''};

    const horarios=normalizarHorarios(valor);
    if(!esObjeto(horarios))return {valido:false,mensaje:'El horario semanal no tiene un formato válido.'};

    const claves=Object.keys(horarios);
    if(claves.length!==7||DIAS.some(([dia])=>!Object.prototype.hasOwnProperty.call(horarios,dia))){
      return {valido:false,mensaje:'Debes indicar el horario o marcar «Cerrado» en los siete días.'};
    }

    if(!DIAS.some(([dia])=>horarios[dia]?.cerrado===false)){
      return {valido:false,mensaje:'El taller debe tener al menos un día abierto.'};
    }

    const patronHora=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for(const [dia,etiqueta] of DIAS){
      const horario=horarios[dia];
      if(horario?.cerrado===true)continue;

      if(!Array.isArray(horario?.turnos)||horario.turnos.length<1||horario.turnos.length>2){
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
          return {valido:false,mensaje:`En ${etiqueta}, el segundo turno debe empezar al terminar o después del primer turno.`};
        }
      }
    }

    return {valido:true,mensaje:''};
  }

  window.TallerMapHorarios={normalizar:normalizarHorarios,validar:validarHorarios};

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

  function opcionesHora(){
    const valores=[''];
    for(let minutos=0;minutos<24*60;minutos+=15){
      const h=String(Math.floor(minutos/60)).padStart(2,'0');
      const m=String(minutos%60).padStart(2,'0');
      valores.push(`${h}:${m}`);
    }
    return valores.map(hora=>`<option value="${hora}">${hora||'—'}</option>`).join('');
  }

  function horarioVacio(){
    return Object.fromEntries(DIAS.map(([dia])=>[dia,{cerrado:true,turnos:[]}]))
  }

  function montarHorarios(){
    const campo=$('horarios');
    if(!campo||$('horarios-estructurados'))return;

    campo.hidden=true;
    const panel=document.createElement('section');
    panel.id='horarios-estructurados';
    panel.style.cssText='display:grid;gap:10px;margin-bottom:8px';
    const opciones=opcionesHora();

    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <small style="color:#667085">Selecciona horas en bloques de 15 minutos. Para horario continuo deja el turno de tarde vacío.</small>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button id="copiar-laborables" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #dfe3e8">Aplicar lunes a viernes</button>
          <button id="cerrar-fin-semana" type="button" class="tm-btn tm-btn-soft" style="border:1px solid #dfe3e8">Cerrar sábado y domingo</button>
        </div>
      </div>
      <div class="tm-horario-cabecera" style="display:grid;grid-template-columns:92px repeat(4,minmax(100px,1fr)) 84px;gap:6px;font-size:.76rem;color:#667085;padding:0 4px">
        <span></span><strong>Abre mañana</strong><strong>Cierra mañana</strong><strong>Abre tarde</strong><strong>Cierra tarde</strong><strong>Cerrado</strong>
      </div>
      ${DIAS.map(([dia,etiqueta])=>`
        <div class="tm-horario-dia" data-fila="${dia}" style="display:grid;grid-template-columns:92px repeat(4,minmax(100px,1fr)) 84px;gap:6px;align-items:center;padding:5px;border:1px solid #eef0f3;border-radius:10px">
          <strong>${etiqueta}</strong>
          <select data-dia="${dia}" data-tipo="m1" aria-label="${etiqueta} apertura mañana">${opciones}</select>
          <select data-dia="${dia}" data-tipo="m2" aria-label="${etiqueta} cierre mañana">${opciones}</select>
          <select data-dia="${dia}" data-tipo="t1" aria-label="${etiqueta} apertura tarde">${opciones}</select>
          <select data-dia="${dia}" data-tipo="t2" aria-label="${etiqueta} cierre tarde">${opciones}</select>
          <label style="display:flex;gap:5px;align-items:center;justify-content:center"><input type="checkbox" data-cerrado="${dia}" style="width:auto"> Sí</label>
        </div>`).join('')}
      <p id="horarios-estructurados-error" role="alert" style="display:none;margin:0;padding:9px 11px;border-radius:9px;background:#fef2f2;color:#b42318;font-size:.86rem"></p>
      <style>
        #horarios-estructurados select{min-height:42px;padding:7px 8px}
        .tm-horario-dia.tm-horario-invalido{border-color:#fca5a5!important;background:#fff7f7}
        @media(max-width:760px){
          .tm-horario-cabecera{display:none!important}
          .tm-horario-dia{grid-template-columns:92px 1fr 1fr!important}
          .tm-horario-dia strong{grid-row:1/3}
          .tm-horario-dia label{grid-column:2/-1;justify-content:flex-start!important}
        }
      </style>`;

    campo.parentElement.insertBefore(panel,campo);

    const get=(dia,tipo)=>panel.querySelector(`[data-dia="${dia}"][data-tipo="${tipo}"]`);
    const getCerrado=dia=>panel.querySelector(`[data-cerrado="${dia}"]`);
    const fila=dia=>panel.querySelector(`[data-fila="${dia}"]`);
    const mensajeError=$('horarios-estructurados-error');
    let sincronizando=false;

    function setValor(select,valor){
      const hora=textoHora(valor);
      select.value=hora;
      if(hora&&select.value!==hora)select.value='';
    }

    function bloquear(dia){
      const cerrado=getCerrado(dia).checked;
      ['m1','m2','t1','t2'].forEach(tipo=>{
        const control=get(dia,tipo);
        control.disabled=cerrado;
        control.style.opacity=cerrado?'.55':'1';
      });
      fila(dia).style.opacity=cerrado?'.78':'1';
    }

    function leerPanel(){
      const horarios={};
      DIAS.forEach(([dia])=>{
        if(getCerrado(dia).checked){
          horarios[dia]={cerrado:true,turnos:[]};
          return;
        }

        const turnos=[];
        const manana={apertura:get(dia,'m1').value,cierre:get(dia,'m2').value};
        const tarde={apertura:get(dia,'t1').value,cierre:get(dia,'t2').value};
        if(manana.apertura||manana.cierre)turnos.push(manana);
        if(tarde.apertura||tarde.cierre)turnos.push(tarde);
        horarios[dia]={cerrado:false,turnos};
      });
      return horarios;
    }

    function mostrarValidacion(horarios){
      const resultado=validarHorarios(horarios);
      mensajeError.textContent=resultado.mensaje;
      mensajeError.style.display=resultado.valido?'none':'block';
      DIAS.forEach(([dia])=>fila(dia).classList.remove('tm-horario-invalido'));
      if(!resultado.valido){
        const encontrado=DIAS.find(([,etiqueta])=>resultado.mensaje.includes(etiqueta));
        if(encontrado)fila(encontrado[0]).classList.add('tm-horario-invalido');
      }
      return resultado;
    }

    function guardarPanel(){
      if(sincronizando)return;
      const horarios=leerPanel();
      campo.value=JSON.stringify(horarios);
      mostrarValidacion(horarios);
      sincronizando=true;
      emitir(campo);
      sincronizando=false;
    }

    function reflejar(){
      if(sincronizando)return;
      const normalizados=normalizarHorarios(campo.value)||horarioVacio();
      DIAS.forEach(([dia])=>{
        const horario=normalizados[dia]||{cerrado:true,turnos:[]};
        const cerrado=horario.cerrado===true;
        const turnos=cerrado?[]:horario.turnos;
        getCerrado(dia).checked=cerrado;
        setValor(get(dia,'m1'),turnos[0]?.apertura||'');
        setValor(get(dia,'m2'),turnos[0]?.cierre||'');
        setValor(get(dia,'t1'),turnos[1]?.apertura||'');
        setValor(get(dia,'t2'),turnos[1]?.cierre||'');
        bloquear(dia);
      });
      mostrarValidacion(normalizados);
    }

    panel.addEventListener('change',evento=>{
      const cerrado=evento.target.closest('[data-cerrado]');
      if(cerrado){
        const dia=cerrado.dataset.cerrado;
        if(cerrado.checked){
          ['m1','m2','t1','t2'].forEach(tipo=>{get(dia,tipo).value='';});
        }
        bloquear(dia);
      }
      guardarPanel();
    });

    $('copiar-laborables').addEventListener('click',()=>{
      const origen='lunes';
      LABORABLES.forEach(dia=>{
        getCerrado(dia).checked=getCerrado(origen).checked;
        ['m1','m2','t1','t2'].forEach(tipo=>{get(dia,tipo).value=get(origen,tipo).value;});
        bloquear(dia);
      });
      guardarPanel();
    });

    $('cerrar-fin-semana').addEventListener('click',()=>{
      ['sabado','domingo'].forEach(dia=>{
        getCerrado(dia).checked=true;
        ['m1','m2','t1','t2'].forEach(tipo=>{get(dia,tipo).value='';});
        bloquear(dia);
      });
      guardarPanel();
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
