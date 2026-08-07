(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const params=new URLSearchParams(location.search);
  const tallerParam=String(params.get('taller')||'').trim();
  const slugParam=String(params.get('slug')||'').trim();
  let taller=null;

  const $=(id)=>document.getElementById(id);
  const mensaje=(txt,tipo='')=>{const el=$('claim-message');el.textContent=txt;el.className=`claim-status ${tipo}`.trim();el.classList.remove('claim-hidden');};
  const ocultarMensaje=()=>$('claim-message')?.classList.add('claim-hidden');
  const uuidValido=(v)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const limpiar=(v,max=1500)=>String(v||'').trim().slice(0,max);

  function renderTaller(){
    const el=$('claim-workshop');
    if(!taller){el.innerHTML='<strong>No se ha podido identificar el taller.</strong><span>Vuelve a su ficha pública e inicia la reclamación desde allí.</span>';return;}
    const lugar=[taller.direccion,taller.codigo_postal,taller.ciudad,taller.provincia].filter(Boolean).join(', ');
    const strong=document.createElement('strong');strong.textContent=taller.nombre||'Taller';
    const span=document.createElement('span');span.textContent=lugar||'Ubicación no indicada';
    el.replaceChildren(strong,span);
  }

  async function cargarTaller(){
    if(!supabase){renderTaller();mensaje('No hay conexión con TallerMap.','error');return;}
    if(!tallerParam&&!slugParam){renderTaller();mensaje('Falta identificar la ficha que quieres reclamar.','error');return;}
    const {data,error}=await supabase.rpc('obtener_taller_publico',{p_id:uuidValido(tallerParam)?tallerParam:null,p_slug:slugParam||null});
    if(error||!Array.isArray(data)||!data.length){renderTaller();mensaje('No se ha encontrado esta ficha pública.','error');return;}
    taller=data[0];renderTaller();
  }

  function mostrarSesion(session){
    const hay=Boolean(session?.user);
    $('claim-login').classList.toggle('claim-hidden',hay);
    $('claim-panel').classList.toggle('claim-hidden',!hay);
    if(hay)$('claim-session-email').textContent=session.user.email||'';
  }

  async function comprobarEstado(session){
    if(!session?.user||!taller?.id)return;
    const {data,error}=await supabase.from('reclamaciones_taller')
      .select('estado,created_at')
      .eq('taller_id',taller.id)
      .eq('usuario_id',session.user.id)
      .order('created_at',{ascending:false})
      .limit(1);
    if(error)return;
    const ultima=data?.[0];
    if(!ultima)return;
    if(ultima.estado==='pendiente')mensaje('Ya tienes una reclamación pendiente para este taller. La revisaremos desde administración.','ok');
    if(ultima.estado==='aprobada')mensaje('Esta ficha ya está asociada a tu cuenta. Puedes gestionarla desde “Mi taller”.','ok');
    if(ultima.estado==='rechazada')mensaje('Tu reclamación anterior fue rechazada. Puedes enviar una nueva aportando más información.','error');
  }

  async function iniciar(){
    await cargarTaller();
    if(!supabase)return;
    const {data:{session}}=await supabase.auth.getSession();
    mostrarSesion(session);
    await comprobarEstado(session);
  }

  $('claim-send-link')?.addEventListener('click',async()=>{
    ocultarMensaje();
    const email=limpiar($('claim-email').value,254).toLowerCase();
    if(!email||!$('claim-email').checkValidity()){mensaje('Escribe un correo electrónico válido.','error');$('claim-email').focus();return;}
    const btn=$('claim-send-link');btn.disabled=true;btn.textContent='Enviando enlace…';
    const regreso=`${location.pathname}${location.search}`;
    const destino=new URL('/pages/auth-propietario.html',location.origin);
    destino.searchParams.set('next',regreso);
    const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:destino.href,shouldCreateUser:true}});
    btn.disabled=false;btn.textContent='Recibir enlace de acceso';
    if(error){mensaje('No se ha podido enviar el enlace. Inténtalo de nuevo dentro de un minuto.','error');return;}
    mensaje('Te hemos enviado un enlace de acceso. Ábrelo desde tu correo. Verás una pantalla de confirmación y después podrás continuar con esta reclamación.','ok');
  });

  $('claim-logout')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.reload();});

  $('claim-form')?.addEventListener('submit',async(e)=>{
    e.preventDefault();ocultarMensaje();
    if(!taller?.id){mensaje('No se puede enviar la solicitud porque no se ha identificado el taller.','error');return;}
    const form=e.currentTarget;if(!form.checkValidity()){form.reportValidity();return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.user){mensaje('Tu sesión ha caducado. Verifica de nuevo el correo.','error');mostrarSesion(null);return;}
    const payload={
      taller_id:taller.id,
      usuario_id:session.user.id,
      email:session.user.email||'',
      nombre_solicitante:limpiar($('claim-name').value,120),
      telefono:limpiar($('claim-phone').value,30)||null,
      relacion:$('claim-relation').value,
      mensaje:limpiar($('claim-note').value,1500)||null,
      estado:'pendiente'
    };
    const btn=$('claim-submit');btn.disabled=true;btn.textContent='Enviando…';
    const {error}=await supabase.from('reclamaciones_taller').insert(payload);
    btn.disabled=false;btn.textContent='Enviar reclamación';
    if(error){
      if(error.code==='23505')mensaje('Ya existe una reclamación pendiente para esta ficha.','ok');
      else if(error.code==='42P01')mensaje('La función de reclamaciones todavía no está activada en la base de datos.','error');
      else mensaje(`No se pudo enviar la reclamación: ${error.message}`,'error');
      return;
    }
    form.reset();
    mensaje('Reclamación enviada correctamente. Queda pendiente de revisión administrativa.','ok');
  });

  supabase?.auth?.onAuthStateChange((_event,session)=>{mostrarSesion(session);if(session)comprobarEstado(session);});
  iniciar();
}());
