(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const estado=$('estado-acceso-admin');
  const form=$('form-taller');
  const resultados=$('resultados-talleres');
  let campoActivo=null;

  const campos=['nombre','telefono','web','direccion','codigo_postal','ciudad','provincia','descripcion'];

  function textoSeguro(v){return String(v??'').replace(/[<>]/g,'').trim();}
  function mensaje(texto,ok=false){$('estado-ficha').textContent=texto;$('estado-ficha').style.color=ok?'#15803d':'#667085';}
  function normalizarUrl(valor){const v=String(valor||'').trim();if(!v)return '';return /^https?:\/\//i.test(v)?v:`https://${v}`;}
  function valorCampo(id){return $(id)?.value.trim()||'';}

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
    if(termino){
      const seguro=termino.replace(/[,%().]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
      q=q.or(`nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,ciudad.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`);
    }
    const {data,error}=await q;
    if(error){resultados.innerHTML='';mensaje(`Error al consultar: ${error.message}`);return;}
    resultados.innerHTML=(data||[]).map((t,i)=>`<button type="button" class="tm-result" data-i="${i}"><strong>${textoSeguro(t.nombre)||'Sin nombre'}</strong><span>${textoSeguro(t.telefono)} · ${textoSeguro(t.ciudad)} ${textoSeguro(t.codigo_postal)}</span></button>`).join('')||'<div class="tm-result">No hay resultados.</div>';
    resultados.querySelectorAll('[data-i]').forEach(btn=>btn.addEventListener('click',()=>cargar(data[Number(btn.dataset.i)],btn)));
  }

  function cargar(taller,boton){
    resultados.querySelectorAll('.tm-result').forEach(x=>x.classList.remove('active'));boton?.classList.add('active');
    $('taller-id').value=taller.id;
    campos.forEach(c=>$(c).value=taller[c]??'');
    $('servicios').value=Array.isArray(taller.servicios)?taller.servicios.join('\n'):(taller.servicios??'');
    $('horarios').value=typeof taller.horarios==='string'?taller.horarios:JSON.stringify(taller.horarios??{},null,2);
    form.hidden=false;
    mensaje(`Editando: ${taller.nombre}`,true);
    abrirBusquedaTaller();
  }

  function serviciosPayload(){return valorCampo('servicios').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horariosPayload(){const txt=valorCampo('horarios');if(!txt)return {};try{return JSON.parse(txt);}catch{return {texto:txt};}}

  async function guardar(e){
    e.preventDefault();
    const id=valorCampo('taller-id');if(!id)return;
    const payload={};campos.forEach(c=>payload[c]=valorCampo(c));
    payload.web=normalizarUrl(payload.web);payload.servicios=serviciosPayload();payload.horarios=horariosPayload();
    mensaje('Guardando cambios…');
    const {error}=await supabase.from('talleres').update(payload).eq('id',id);
    if(error){mensaje(`No se pudo guardar: ${error.message}`);return;}
    mensaje('Ficha guardada correctamente en Supabase.',true);
  }

  function abrirUrl(){const url=normalizarUrl(valorCampo('url-externa'));if(!url)return;$('url-externa').value=url;$('visor-externo').src=url;}
  function abrirPestana(){const url=normalizarUrl(valorCampo('url-externa'));if(url)window.open(url,'_blank','noopener,noreferrer');}
  function abrirBusquedaTaller(){
    const consulta=[valorCampo('nombre'),valorCampo('direccion'),valorCampo('ciudad'),valorCampo('telefono')].filter(Boolean).join(' ');
    const url=`https://www.google.com/search?q=${encodeURIComponent(consulta)}`;
    $('url-externa').value=url;$('visor-externo').src=url;
  }

  document.querySelectorAll('[data-drop]').forEach(campo=>{
    campo.addEventListener('focus',()=>campoActivo=campo);
    campo.addEventListener('dragover',e=>{e.preventDefault();campo.classList.add('tm-drop');});
    campo.addEventListener('dragleave',()=>campo.classList.remove('tm-drop'));
    campo.addEventListener('drop',e=>{e.preventDefault();campo.classList.remove('tm-drop');const texto=e.dataTransfer.getData('text/plain');if(texto)campo.value=texto.trim();});
  });

  document.addEventListener('copy',()=>{});
  $('btn-copiar-seleccion').addEventListener('click',async()=>{
    try{const texto=window.getSelection()?.toString().trim();if(!texto){mensaje('Selecciona texto en una fuente abierta fuera del iframe y vuelve a copiar.');return;}await navigator.clipboard.writeText(texto);mensaje('Texto copiado.',true);}catch{mensaje('El navegador no permitió copiar la selección.');}
  });
  $('btn-pegar-campo').addEventListener('click',async()=>{
    if(!campoActivo){mensaje('Selecciona primero un campo de la ficha.');return;}
    try{campoActivo.value=(await navigator.clipboard.readText()).trim();mensaje(`Dato pegado en ${campoActivo.id}.`,true);}catch{mensaje('El navegador no permitió leer el portapapeles.');}
  });

  $('btn-buscar').addEventListener('click',buscar);
  $('buscar-taller').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();buscar();}});
  form.addEventListener('submit',guardar);
  $('btn-google').addEventListener('click',abrirBusquedaTaller);
  $('btn-cargar-url').addEventListener('click',abrirUrl);
  $('btn-nueva-pestana').addEventListener('click',abrirPestana);
  $('boton-cerrar-sesion').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('admin-login.html');});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('[data-pane]').forEach(x=>x.classList.toggle('active',x.dataset.pane===b.dataset.tab));
  }));

  proteger().then(buscar);
  abrirUrl();
}());
