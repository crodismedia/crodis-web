(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const sb=window.supabaseClient;
  const source=$('dato-candidato');
  const inspector=$('inspector-resultados');
  if(!source||!inspector||!sb)return;

  const bar=document.createElement('div');
  bar.className='tm-source-tools';
  bar.innerHTML='<button id="btn-busqueda-automatica" type="button" class="tm-btn tm-btn-primary">Buscar automáticamente</button><span id="estado-busqueda-automatica" class="tm-status">Usa nombre y ubicación de la ficha izquierda.</span>';
  source.closest('.tm-transfer')?.insertAdjacentElement('beforebegin',bar);

  function datosFicha(){return {
    nombre:$('nombre')?.value.trim()||'',
    direccion:$('direccion')?.value.trim()||'',
    codigo_postal:$('codigo_postal')?.value.trim()||'',
    ciudad:$('ciudad')?.value.trim()||'',
    provincia:$('provincia')?.value.trim()||''
  };}

  function textoCandidato(c){return [c.nombre,c.direccion,[c.codigo_postal,c.ciudad].filter(Boolean).join(' '),c.telefono,c.web,c.email,c.horarios].filter(Boolean).join('\n');}

  function pintar(resultados){
    if(!resultados.length){inspector.innerHTML='<p class="tm-empty">No se encontraron talleres cercanos en OpenStreetMap.</p>';return;}
    inspector.innerHTML=resultados.map((c,i)=>`<article class="tm-suggestion" data-auto="${i}"><div><small>${c.fuente||'Fuente automática'}</small><span><strong>${String(c.nombre||'Taller').replace(/[<>]/g,'')}</strong><br>${String([c.direccion,c.codigo_postal,c.ciudad].filter(Boolean).join(' · ')).replace(/[<>]/g,'')}<br>${String(c.telefono||'').replace(/[<>]/g,'')} ${String(c.web||'').replace(/[<>]/g,'')}</span></div><button type="button" class="tm-btn tm-btn-soft">Comparar</button></article>`).join('');
    inspector.querySelectorAll('[data-auto]').forEach(card=>card.querySelector('button').addEventListener('click',()=>{
      const c=resultados[Number(card.dataset.auto)];
      source.value=textoCandidato(c);
      source.dispatchEvent(new Event('input',{bubbles:true}));
      $('btn-analizar')?.click();
    }));
  }

  $('btn-busqueda-automatica').addEventListener('click',async()=>{
    const estado=$('estado-busqueda-automatica');
    const ficha=datosFicha();
    if(!ficha.nombre||!(ficha.codigo_postal||ficha.ciudad)){estado.textContent='Selecciona una ficha con nombre y ubicación.';return;}
    const {data:{session}}=await sb.auth.getSession();
    if(!session){estado.textContent='La sesión administrativa ha caducado.';return;}
    const boton=$('btn-busqueda-automatica');boton.disabled=true;estado.textContent='Buscando talleres cercanos…';
    try{
      const response=await fetch('/api/investigar',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(ficha)});
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||'Error de búsqueda');
      pintar(json.resultados||[]);estado.textContent=`${json.total||0} candidatos encontrados. Selecciona uno para comparar.`;
    }catch(error){estado.textContent=error.message||'No se pudo realizar la búsqueda automática.';}
    finally{boton.disabled=false;}
  });
}());
