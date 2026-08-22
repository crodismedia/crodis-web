(function(){
  "use strict";

  function obtenerSlug(){
    const params=new URLSearchParams(window.location.search);
    let slug=String(params.get('slug')||'').trim();
    if(!slug&&window.location.pathname.startsWith('/talleres/')){
      slug=decodeURIComponent(window.location.pathname.slice('/talleres/'.length).split('/')[0]||'').trim();
    }
    return slug.toLowerCase();
  }

  const params=new URLSearchParams(window.location.search);
  const slug=obtenerSlug();
  const id=String(params.get('id')||'').trim();

  const enlace=document.getElementById('reclamar-ficha');
  if(enlace){
    const destino=new URL('/pages/reclamar-taller.html',window.location.origin);
    if(id)destino.searchParams.set('taller',id);
    if(slug)destino.searchParams.set('slug',slug);
    enlace.href=destino.pathname+destino.search;
    enlace.rel='nofollow';
    enlace.removeAttribute('target');
    enlace.textContent='Soy el propietario: reclamar ficha';
  }

  if(!slug)return;

  function sessionId(){
    const key='tm_stats_session';
    try{
      let value=sessionStorage.getItem(key);
      if(!value){
        value=(window.crypto&&typeof window.crypto.randomUUID==='function')
          ?window.crypto.randomUUID()
          :`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(key,value);
      }
      return value;
    }catch(_error){
      return '';
    }
  }

  const sesion=sessionId();

  function cuerpoEvento(evento){
    return JSON.stringify({
      slug,
      evento,
      session_id:sesion,
      path:window.location.pathname
    });
  }

  function registrar(evento){
    const body=cuerpoEvento(evento);

    try{
      if(typeof navigator.sendBeacon==='function'){
        const blob=new Blob([body],{type:'application/json'});
        if(navigator.sendBeacon('/api/estadistica-taller',blob))return;
      }
    }catch(_error){/* fallback a fetch */}

    fetch('/api/estadistica-taller',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      keepalive:true,
      body
    }).catch(function(){/* Las estadísticas nunca deben bloquear la ficha. */});
  }

  function registrarVista(){
    const run=function(){registrar('ficha_vista');};
    if(typeof window.requestIdleCallback==='function'){
      window.requestIdleCallback(run,{timeout:1500});
    }else{
      window.setTimeout(run,150);
    }
  }

  registrarVista();

  document.addEventListener('click',function(event){
    const target=event.target instanceof Element?event.target.closest('a'):null;
    if(!target)return;

    const href=String(target.getAttribute('href')||'');
    let tipo='';

    if(target.classList.contains('accion-mapa'))tipo='como_llegar';
    else if(target.classList.contains('accion-whatsapp'))tipo='whatsapp';
    else if(target.classList.contains('accion-web'))tipo='web';
    else if(href.toLowerCase().startsWith('tel:'))tipo='telefono';

    if(tipo)registrar(tipo);
  },true);
}());
