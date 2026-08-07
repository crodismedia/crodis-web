(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const params=new URLSearchParams(location.search);

  function destinoSeguro(){
    const raw=String(params.get('next')||'').trim();
    if(!raw)return '/pages/mi-taller.html';
    try{
      const url=new URL(raw,location.origin);
      if(url.origin!==location.origin)return '/pages/mi-taller.html';
      if(!['/pages/reclamar-taller.html','/pages/mi-taller.html'].includes(url.pathname))return '/pages/mi-taller.html';
      return `${url.pathname}${url.search}${url.hash}`;
    }catch(_error){return '/pages/mi-taller.html';}
  }

  const siguiente=destinoSeguro();

  function mostrarOk(session){
    $('auth-status').textContent=`Correo verificado: ${session.user.email||'cuenta confirmada'}`;
    $('auth-status').className='auth-status ok';
    $('auth-copy').textContent='Tu acceso está confirmado. Pulsa continuar para volver de forma segura al proceso que estabas realizando.';
    const continuar=$('auth-continue');
    continuar.href=siguiente;
    continuar.classList.remove('auth-hidden');
    $('auth-retry').classList.add('auth-hidden');
  }

  function mostrarError(texto){
    $('auth-status').textContent=texto;
    $('auth-status').className='auth-status error';
    $('auth-copy').textContent='No hemos podido mantener la sesión de este enlace en el navegador actual.';
    $('auth-continue').classList.add('auth-hidden');
    const volver=$('auth-retry');
    volver.href=siguiente;
    volver.textContent='Volver e intentarlo de nuevo';
    volver.classList.remove('auth-hidden');
  }

  async function iniciar(){
    if(!supabase){mostrarError('No hay conexión con TallerMap.');return;}

    const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));
    const errorDescripcion=params.get('error_description')||hashParams.get('error_description');
    if(errorDescripcion){mostrarError(decodeURIComponent(errorDescripcion));return;}

    let {data:{session},error}=await supabase.auth.getSession();
    if(error){mostrarError('No se pudo comprobar la sesión.');return;}

    if(!session && params.get('code')){
      const intercambio=await supabase.auth.exchangeCodeForSession(params.get('code'));
      if(intercambio.error){mostrarError('El enlace de acceso no pudo completarse en este navegador.');return;}
      session=intercambio.data.session;
    }

    if(session){mostrarOk(session);return;}

    let resuelto=false;
    const {data:suscripcion}=supabase.auth.onAuthStateChange((_evento,nuevaSesion)=>{
      if(resuelto||!nuevaSesion)return;
      resuelto=true;
      mostrarOk(nuevaSesion);
      suscripcion.subscription.unsubscribe();
    });

    setTimeout(()=>{
      if(resuelto)return;
      resuelto=true;
      suscripcion.subscription.unsubscribe();
      mostrarError('El enlace se abrió, pero la sesión no quedó disponible. Vuelve a la reclamación y solicita un enlace nuevo.');
    },2200);
  }

  iniciar();
}());
