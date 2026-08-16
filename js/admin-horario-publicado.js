(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const DIAS=[
    ['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],
    ['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']
  ];

  function esc(value){
    return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function textoDia(valor){
    if(!valor)return 'Sin horario publicado';
    if(typeof valor==='string')return valor;
    if(valor.cerrado)return 'Cerrado';
    const turnos=Array.isArray(valor.turnos)?valor.turnos:[];
    const texto=turnos
      .map(t=>[t?.apertura,t?.cierre].filter(Boolean).join('–'))
      .filter(Boolean)
      .join(' y ');
    return texto||'Sin horario publicado';
  }

  function render(horarios){
    const panel=$('horario-publicado-panel');
    if(!panel)return;

    if(!horarios||typeof horarios!=='object'){
      panel.innerHTML='<strong>Horario publicado actualmente</strong><p>No hay un horario semanal estructurado publicado para esta ficha.</p>';
      panel.hidden=false;
      return;
    }

    const filas=DIAS.map(([key,label])=>`<div class="tm-horario-publicado-fila"><span>${label}</span><strong>${esc(textoDia(horarios[key]))}</strong></div>`).join('');
    panel.innerHTML=`<div class="tm-horario-publicado-cabecera"><strong>Horario publicado actualmente</strong><button id="cerrar-horario-publicado" type="button" class="tm-btn tm-btn-soft">Cerrar</button></div><div class="tm-horario-publicado-lista">${filas}</div>`;
    panel.hidden=false;
    $('cerrar-horario-publicado')?.addEventListener('click',()=>{panel.hidden=true;});
  }

  async function mostrarHorarioPublicado(){
    const supabase=window.supabaseClient;
    const boton=$('btn-horario-publicado');
    const panel=$('horario-publicado-panel');
    const id=String($('taller-id')?.value||'').trim();

    if(!id){
      if(panel){panel.innerHTML='<p>Selecciona primero un taller.</p>';panel.hidden=false;}
      return;
    }
    if(!supabase)return;

    if(boton){boton.disabled=true;boton.textContent='Consultando…';}
    try{
      const {data,error}=await supabase.from('talleres').select('horarios').eq('id',id).maybeSingle();
      if(error)throw error;
      render(data?.horarios??null);
    }catch(error){
      if(panel){
        panel.innerHTML=`<strong>No se pudo consultar el horario publicado</strong><p>${esc(error?.message||'Error desconocido')}</p>`;
        panel.hidden=false;
      }
    }finally{
      if(boton){boton.disabled=false;boton.textContent='Ver horario publicado';}
    }
  }

  $('btn-horario-publicado')?.addEventListener('click',mostrarHorarioPublicado);
}());
