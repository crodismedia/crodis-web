(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const supabase = window.supabaseClient;
  const resultados = $('resultados-talleres');
  const form = $('form-taller');
  const campos = ['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];

  function escapar(v){
    return String(v ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function mensaje(texto, ok=false){
    const estado = $('estado-ficha');
    if(!estado) return;
    estado.textContent = texto;
    estado.style.color = ok ? '#15803d' : '#667085';
  }

  function cargarTaller(taller){
    $('taller-id').value = taller.id;
    campos.forEach((campo)=>{ if($(campo)) $(campo).value = taller[campo] ?? ''; });
    $('servicios').value = Array.isArray(taller.servicios) ? taller.servicios.join('\n') : (taller.servicios ?? '');
    $('horarios').value = typeof taller.horarios === 'string' ? taller.horarios : JSON.stringify(taller.horarios ?? {},null,2);
    $('servicios').dispatchEvent(new Event('input',{bubbles:true}));
    $('horarios').dispatchEvent(new Event('input',{bubbles:true}));
    form.hidden = false;
    resultados.innerHTML = '';
    mensaje(`Editando: ${taller.nombre || 'taller'}`,true);
  }

  async function buscar(){
    const termino = String($('buscar-taller')?.value || '').trim();
    if(!termino){
      resultados.innerHTML = '';
      mensaje('Escribe un nombre, municipio, teléfono o código postal y pulsa Buscar.');
      return;
    }

    const seguro = termino.replace(/[,%().]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    resultados.innerHTML = '<div class="tm-result">Buscando…</div>';

    const {data,error} = await supabase
      .from('talleres')
      .select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios')
      .or(`ciudad.ilike.%${seguro}%,nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`)
      .order('nombre',{ascending:true})
      .limit(1000);

    if(error){
      resultados.innerHTML = '';
      mensaje(`Error al consultar: ${error.message}`);
      return;
    }

    const talleres = data || [];
    resultados.innerHTML = talleres.map((taller,i)=>`
      <button type="button" class="tm-result" data-admin-search-index="${i}">
        <strong>${escapar(taller.nombre || 'Sin nombre')}</strong>
        <span>${escapar(taller.telefono || '')} · ${escapar(taller.ciudad || '')} ${escapar(taller.codigo_postal || '')}</span>
      </button>`).join('') || '<div class="tm-result">No hay resultados.</div>';

    resultados.querySelectorAll('[data-admin-search-index]').forEach((boton)=>{
      boton.addEventListener('click',()=>cargarTaller(talleres[Number(boton.dataset.adminSearchIndex)]));
    });

    mensaje(`${talleres.length} taller${talleres.length===1?'':'es'} encontrado${talleres.length===1?'':'s'}.`,true);
  }

  function iniciar(){
    if(!supabase || !$('btn-buscar') || !$('buscar-taller')) return;

    resultados.innerHTML = '';
    form.hidden = true;
    mensaje('Escribe un nombre, municipio, teléfono o código postal y pulsa Buscar.');

    const botonViejo = $('btn-buscar');
    const botonNuevo = botonViejo.cloneNode(true);
    botonViejo.replaceWith(botonNuevo);

    const inputViejo = $('buscar-taller');
    const inputNuevo = inputViejo.cloneNode(true);
    inputViejo.replaceWith(inputNuevo);

    botonNuevo.addEventListener('click',buscar);
    inputNuevo.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'){
        e.preventDefault();
        buscar();
      }
    });
    inputNuevo.addEventListener('input',()=>{
      if(!inputNuevo.value.trim()) resultados.innerHTML='';
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciar,0),{once:true});
  else setTimeout(iniciar,0);
}());
