(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const estado=$('estado-acceso-admin');
  const form=$('form-taller');
  const resultados=$('resultados-talleres');
  const campos=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];
  const editables=[...campos,'servicios','horarios'];
  let valoresOriginales={};
  let propuestasActuales=[];

  function textoSeguro(v){return String(v??'').replace(/[<>]/g,'').trim();}
  function escaparHtml(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function mensaje(texto,ok=false){$('estado-ficha').textContent=texto;$('estado-ficha').style.color=ok?'#15803d':'#667085';}
  function normalizarUrl(valor){const v=String(valor||'').trim();if(!v)return '';return /^https?:\/\//i.test(v)?v:`https://${v}`;}
  function valorCampo(id){return $(id)?.value.trim()||'';}
  function normalizarComparacion(v){return String(v||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim();}

  async function proteger(){
    if(!supabase){estado.textContent='Sin conexión';return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace('admin-login.html');return;}
    const {data:admin,error}=await supabase.rpc('es_administrador');
    if(error||!admin){await supabase.auth.signOut();location.replace('admin-login.html');return;}
    estado.textContent='Acceso verificado';
  }

  async function buscar(){
    const termino=valorCampo('buscar-taller');
    resultados.innerHTML='<div class="tm-result">Buscando…</div>';
    let q=supabase.from('talleres').select('id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios').order('nombre').limit(25);
    if(termino){const seguro=termino.replace(/[,%().]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);q=q.or(`nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,ciudad.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`);}
    const {data,error}=await q;
    if(error){resultados.innerHTML='';mensaje(`Error al consultar: ${error.message}`);return;}
    resultados.innerHTML=(data||[]).map((t,i)=>`<button type="button" class="tm-result" data-i="${i}"><strong>${escaparHtml(textoSeguro(t.nombre)||'Sin nombre')}</strong><span>${escaparHtml(textoSeguro(t.telefono))} · ${escaparHtml(textoSeguro(t.ciudad))} ${escaparHtml(textoSeguro(t.codigo_postal))}</span></button>`).join('')||'<div class="tm-result">No hay resultados.</div>';
    resultados.querySelectorAll('[data-i]').forEach(btn=>btn.addEventListener('click',()=>cargar(data[Number(btn.dataset.i)],btn)));
  }

  function actualizarEstadoCampo(id){
    const campo=$(id),contenedor=campo?.closest('.tm-field');if(!campo||!contenedor)return;
    contenedor.classList.remove('tm-field-empty','tm-field-dirty','tm-field-ok');
    const actual=campo.value.trim();
    contenedor.classList.add(!actual?'tm-field-empty':actual!==(valoresOriginales[id]??'')?'tm-field-dirty':'tm-field-ok');
  }
  function actualizarEstados(){editables.forEach(actualizarEstadoCampo);}

  function cargar(taller,boton){
    resultados.querySelectorAll('.tm-result').forEach(x=>x.classList.remove('active'));boton?.classList.add('active');
    $('taller-id').value=taller.id;campos.forEach(c=>$(c).value=taller[c]??'');
    $('servicios').value=Array.isArray(taller.servicios)?taller.servicios.join('\n'):(taller.servicios??'');
    $('horarios').value=typeof taller.horarios==='string'?taller.horarios:JSON.stringify(taller.horarios??{},null,2);
    valoresOriginales=Object.fromEntries(editables.map(id=>[id,$(id).value.trim()]));form.hidden=false;actualizarEstados();
    mensaje(`Editando: ${taller.nombre}`,true);abrirBusquedaTaller();analizar();
  }

  function serviciosPayload(){return valorCampo('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horariosPayload(){const txt=valorCampo('horarios');if(!txt)return {};try{return JSON.parse(txt);}catch{return {texto:txt};}}
  async function guardar(e){
    e.preventDefault();const id=valorCampo('taller-id');if(!id)return;
    const payload={};campos.forEach(c=>payload[c]=valorCampo(c));payload.web=normalizarUrl(payload.web);payload.servicios=serviciosPayload();payload.horarios=horariosPayload();
    mensaje('Guardando cambios…');const {error}=await supabase.from('talleres').update(payload).eq('id',id);
    if(error){mensaje(`No se pudo guardar: ${error.message}`);return;}
    valoresOriginales=Object.fromEntries(editables.map(c=>[c,$(c).value.trim()]));actualizarEstados();mensaje('Ficha guardada correctamente en Supabase.',true);analizar();
  }

  function abrirUrl(){const url=normalizarUrl(valorCampo('url-externa'));if(!url)return;$('url-externa').value=url;$('visor-externo').src=url;}
  function abrirPestana(){const url=normalizarUrl(valorCampo('url-externa'));if(url)window.open(url,'_blank','noopener,noreferrer');}
  function abrirBusquedaTaller(){const consulta=[valorCampo('nombre'),valorCampo('direccion'),valorCampo('ciudad'),valorCampo('telefono')].filter(Boolean).join(' ');const url=`https://www.google.com/search?q=${encodeURIComponent(consulta)}`;$('url-externa').value=url;$('visor-externo').src=url;}
  function marcarDestino(id){document.querySelectorAll('[data-drop]').forEach(c=>c.classList.toggle('tm-target',c.id===id));}

  function transferir(destino,candidato,modo='sustituir'){
    if(form.hidden){mensaje('Selecciona primero un taller.');return false;}
    const campo=$(destino);if(!campo||!candidato)return false;const actual=campo.value.trim();
    if(modo==='anadir'){
      const separador=['servicios','horarios','descripcion'].includes(destino)?'\n':' · ';
      const existe=normalizarComparacion(actual).includes(normalizarComparacion(candidato));
      if(existe){mensaje('Ese dato ya está presente en la ficha.');return false;}
      campo.value=actual?`${actual}${separador}${candidato}`:candidato;
    }else{
      const detalle=actual?`Dato actual:\n${actual}\n\nDato encontrado:\n${candidato}\n\n¿Deseas sustituirlo?`:`El campo está vacío. ¿Deseas usar este dato?\n\n${candidato}`;
      if(!window.confirm(detalle))return false;
      campo.value=destino==='web'?normalizarUrl(candidato):candidato;
    }
    actualizarEstadoCampo(destino);campo.focus();campo.scrollIntoView({behavior:'smooth',block:'center'});mensaje(`Dato aplicado a ${destino}. Revisa y guarda la ficha.`,true);return true;
  }
  function aplicarDato(){transferir($('campo-destino').value,valorCampo('dato-candidato'),$('modo-transferencia').value);}

  function unicos(lista){return [...new Set(lista.map(x=>x.trim()).filter(Boolean))];}
  function detectarDatos(texto){
    const telefonos=unicos((texto.match(/(?:\+34[\s.-]?)?(?:[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})/g)||[]).map(x=>x.replace(/\s+/g,' ').trim()));
    const webs=unicos((texto.match(/https?:\/\/[^\s<>()]+|(?:www\.)[^\s<>()]+/gi)||[]).map(x=>x.replace(/[),.;]+$/,'')));
    const emails=unicos(texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]);
    const codigos=unicos(texto.match(/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/g)||[]);
    const lineas=texto.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const horarios=unicos(lineas.filter(x=>/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|l\s*[-a]\s*v|horario|cerrado|\b\d{1,2}[:.]\d{2}\b)/i.test(x)).slice(0,12));
    const catalogo=[['Mecánica general',/mec[aá]nica general|reparaci[oó]n mec[aá]nica/i],['Neumáticos',/neum[aá]ticos|ruedas/i],['Frenos',/frenos|pastillas de freno/i],['Diagnosis',/diagnosis|diagn[oó]stico electr[oó]nico/i],['Aire acondicionado',/aire acondicionado|climatizaci[oó]n/i],['Electricidad',/electricidad del autom[oó]vil|electricidad y electr[oó]nica/i],['Cambio de aceite',/cambio de aceite|aceite y filtros/i],['Chapa y pintura',/chapa y pintura|carrocer[ií]a/i],['Pre-ITV',/pre.?itv|revisi[oó]n itv/i]];
    const servicios=catalogo.filter(([,re])=>re.test(texto)).map(([nombre])=>nombre);
    const redes=webs.filter(url=>/(facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|youtube\.com)/i.test(url));
    return [
      ...telefonos.map(valor=>({tipo:'Teléfono',destino:'telefono',valor})),
      ...webs.filter(url=>!redes.includes(url)).map(valor=>({tipo:'Web',destino:'web',valor})),
      ...emails.map(valor=>({tipo:'Email',destino:'descripcion',valor:`Email: ${valor}`})),
      ...codigos.map(valor=>({tipo:'Código postal',destino:'codigo_postal',valor})),
      ...(horarios.length?[{tipo:'Horario',destino:'horarios',valor:horarios.join('\n')}]:[]),
      ...servicios.map(valor=>({tipo:'Servicio',destino:'servicios',valor})),
      ...redes.map(valor=>({tipo:'Red social',destino:'descripcion',valor:`Red social: ${valor}`}))
    ];
  }

  function estadoPropuesta(p){
    const actual=valorCampo(p.destino);if(!actual)return {texto:'Campo vacío',clase:'vacío'};
    const a=normalizarComparacion(actual),b=normalizarComparacion(p.valor);
    if(a===b||a.includes(b))return {texto:'Ya coincide',clase:'coincide'};
    return {texto:'Diferente',clase:'diferente'};
  }
  function renderizarPropuestas(){
    const contenedor=$('inspector-resultados');$('contador-detectados').textContent=`${propuestasActuales.length} propuesta${propuestasActuales.length===1?'':'s'}`;
    if(!propuestasActuales.length){contenedor.innerHTML='<p class="tm-empty">No se detectaron datos útiles.</p>';return;}
    contenedor.innerHTML=propuestasActuales.map((p,i)=>{const estadoP=estadoPropuesta(p);return `<article class="tm-suggestion" data-card="${i}"><div><small>${escaparHtml(p.tipo)} · ${escaparHtml(estadoP.texto)}</small><span>${escaparHtml(p.valor)}</span><small>Actual: ${escaparHtml(valorCampo(p.destino)||'vacío')}</small></div><div><button type="button" class="tm-btn tm-btn-soft" data-usar="${i}">Usar</button><button type="button" class="tm-btn tm-btn-soft" data-anadir="${i}">Añadir</button><button type="button" class="tm-btn tm-btn-soft" data-descartar="${i}">×</button></div></article>`;}).join('');
    contenedor.querySelectorAll('[data-usar]').forEach(btn=>btn.addEventListener('click',()=>{const p=propuestasActuales[Number(btn.dataset.usar)];transferir(p.destino,p.valor,'sustituir');renderizarPropuestas();}));
    contenedor.querySelectorAll('[data-anadir]').forEach(btn=>btn.addEventListener('click',()=>{const p=propuestasActuales[Number(btn.dataset.anadir)];transferir(p.destino,p.valor,'anadir');renderizarPropuestas();}));
    contenedor.querySelectorAll('[data-descartar]').forEach(btn=>btn.addEventListener('click',()=>{propuestasActuales.splice(Number(btn.dataset.descartar),1);renderizarPropuestas();}));
  }
  function analizar(){propuestasActuales=detectarDatos(valorCampo('dato-candidato'));renderizarPropuestas();}

  document.querySelectorAll('[data-drop]').forEach(campo=>{
    campo.addEventListener('input',()=>{actualizarEstadoCampo(campo.id);renderizarPropuestas();});
    campo.addEventListener('focus',()=>{$('campo-destino').value=campo.id;marcarDestino(campo.id);});
    campo.addEventListener('dragover',e=>{e.preventDefault();campo.classList.add('tm-drop');});
    campo.addEventListener('dragleave',()=>campo.classList.remove('tm-drop'));
    campo.addEventListener('drop',e=>{e.preventDefault();campo.classList.remove('tm-drop');const texto=e.dataTransfer.getData('text/plain').trim();if(!texto)return;transferir(campo.id,texto,'sustituir');});
  });

  $('campo-destino').addEventListener('change',e=>marcarDestino(e.target.value));$('btn-aplicar-dato').addEventListener('click',aplicarDato);$('btn-limpiar-dato').addEventListener('click',()=>{$('dato-candidato').value='';analizar();});$('btn-analizar').addEventListener('click',analizar);
  $('dato-candidato').addEventListener('dragover',e=>e.preventDefault());$('dato-candidato').addEventListener('drop',e=>{e.preventDefault();const texto=e.dataTransfer.getData('text/plain');if(texto){$('dato-candidato').value=texto.trim();analizar();}});
  $('btn-pegar-candidato').addEventListener('click',async()=>{try{$('dato-candidato').value=(await navigator.clipboard.readText()).trim();analizar();mensaje('Contenido pegado y analizado.',true);}catch{mensaje('El navegador no permitió leer el portapapeles.');}});
  $('btn-buscar').addEventListener('click',buscar);$('buscar-taller').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();buscar();}});form.addEventListener('submit',guardar);$('btn-google').addEventListener('click',abrirBusquedaTaller);$('btn-cargar-url').addEventListener('click',abrirUrl);$('btn-nueva-pestana').addEventListener('click',abrirPestana);$('boton-cerrar-sesion').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-pane]').forEach(x=>x.classList.toggle('active',x.dataset.pane===b.dataset.tab));}));
  proteger().then(buscar);abrirUrl();marcarDestino('telefono');
}());