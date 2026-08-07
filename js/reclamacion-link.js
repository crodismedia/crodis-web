(function(){
  "use strict";
  const enlace=document.getElementById('reclamar-ficha');
  if(!enlace)return;
  const params=new URLSearchParams(window.location.search);
  let slug=String(params.get('slug')||'').trim();
  let id=String(params.get('id')||'').trim();
  if(!slug&&window.__TALLERMAP_URL_LIMPIA__){
    slug=String(window.__TALLERMAP_URL_LIMPIA__).replace(/^\/talleres\//,'').split('/')[0].trim();
  }
  const destino=new URL('/pages/reclamar-taller.html',window.location.origin);
  if(id)destino.searchParams.set('taller',id);
  if(slug)destino.searchParams.set('slug',slug);
  enlace.href=destino.pathname+destino.search;
  enlace.removeAttribute('target');
  enlace.textContent='Soy el propietario: reclamar ficha';
}());
