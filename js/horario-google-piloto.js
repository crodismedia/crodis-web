(function(){
  'use strict';

  const PILOTO_SLUG='astoria-cars-s-l-benidorm-6122dec9';
  const PILOTO_ID='6122dec9-326b-4841-aa49-a83b28dd6dba';
  const ENDPOINT='https://cnyptelvbsndpkzbrete.supabase.co/functions/v1/actualizar-horario-google';
  const slug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');
  if(slug!==PILOTO_SLUG)return;

  const dias=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];

  function esc(v){const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML;}
  function renderHorario(h){
    if(!h||typeof h!=='object')return '<p>No hay horario disponible.</p>';
    const filas=dias.map(([k,l])=>{
      const d=h[k]; if(!d)return '';
      const t=d.cerrado?'Cerrado':(Array.isArray(d.turnos)?d.turnos:[]).map(x=>`${x.apertura||''}–${x.cierre||''}`).filter(x=>x!=='–').join(' y ');
      return t?`<div><dt>${esc(l)}</dt><dd>${esc(t)}</dd></div>`:'';
    }).filter(Boolean).join('');
    return filas?`<dl>${filas}</dl>`:'<p>No hay horario disponible.</p>';
  }

  function horarioBaseDesdeDOM(details){
    if(!details)return '<p>No hay horario publicado en TallerMap.</p>';
    const dl=details.querySelector('dl');
    return dl?`<dl>${dl.innerHTML}</dl>`:'<p>No hay horario publicado en TallerMap.</p>';
  }

  function montar(){
    if(document.getElementById('tm-horario-piloto'))return true;
    const datos=document.getElementById('taller-datos');
    if(!datos)return false;
    const details=datos.querySelector('.taller-horario');
    if(!details)return false;
    details.hidden=true;

    const bloque=document.createElement('section');
    bloque.id='tm-horario-piloto';
    bloque.className='tm-horario-piloto';
    bloque.innerHTML=`
      <h3>Horarios</h3>
      <div class="tm-horario-botones">
        <button type="button" class="boton boton-claro" id="tm-horario-base-btn">Horario de TallerMap</button>
        <button type="button" class="boton" id="tm-horario-google-btn">Consultar horario actual en Google</button>
      </div>
      <div id="tm-horario-resultado" class="tm-horario-resultado" hidden></div>`;
    details.insertAdjacentElement('afterend',bloque);

    const resultado=bloque.querySelector('#tm-horario-resultado');
    bloque.querySelector('#tm-horario-base-btn').addEventListener('click',()=>{
      resultado.innerHTML=`<strong>Horario publicado en TallerMap</strong>${horarioBaseDesdeDOM(details)}`;
      resultado.hidden=false;
    });

    bloque.querySelector('#tm-horario-google-btn').addEventListener('click',async(e)=>{
      const btn=e.currentTarget;
      btn.disabled=true;
      btn.textContent='Consultando Google…';
      resultado.hidden=false;
      resultado.innerHTML='<p>Consultando el horario actual…</p>';
      try{
        const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taller_id:PILOTO_ID})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok||!data.ok){
          const mensaje=data.error==='GOOGLE_PLACES_API_KEY_NO_CONFIGURADA'
            ?'La conexión con Google Places está preparada, pero falta configurar la clave de Google.'
            :`No se pudo consultar Google: ${data.error||`HTTP ${r.status}`}`;
          resultado.innerHTML=`<p>${esc(mensaje)}</p>`;
          return;
        }
        const estado=data.estado==='coincide'?'Coincide con TallerMap':data.estado==='actualizado'?'TallerMap se ha actualizado con este horario':data.estado;
        resultado.innerHTML=`<strong>Horario consultado en Google</strong><p>${esc(estado||'Consulta completada')}</p>${renderHorario(data.horario_google)}`;
      }catch(error){
        resultado.innerHTML='<p>No se pudo conectar con la función de horarios.</p>';
      }finally{
        btn.disabled=false;
        btn.textContent='Consultar horario actual en Google';
      }
    });
    return true;
  }

  const style=document.createElement('style');
  style.textContent='.tm-horario-piloto{margin-top:16px;padding:16px;border:1px solid #dfe6ef;border-radius:14px;background:#fff}.tm-horario-piloto h3{margin:0 0 12px}.tm-horario-botones{display:flex;flex-wrap:wrap;gap:10px}.tm-horario-botones .boton{flex:1 1 220px}.tm-horario-resultado{margin-top:14px;padding:14px;border-radius:12px;background:#f5f7fb}.tm-horario-resultado dl{margin:10px 0 0}.tm-horario-resultado dl>div{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid #e5e7eb}.tm-horario-resultado dt{font-weight:700}.tm-horario-resultado dd{margin:0;text-align:right}';
  document.head.appendChild(style);

  if(montar())return;
  const observer=new MutationObserver(()=>{if(montar())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),10000);
}());
