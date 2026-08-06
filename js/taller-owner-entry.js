(function(){
  'use strict';
  const boton=document.getElementById('reclamar-ficha');
  if(!boton)return;
  const params=new URLSearchParams(location.search);
  const id=params.get('id');
  const slug=params.get('slug')||window.__TALLERMAP_URL_LIMPIA__?.split('/').filter(Boolean).pop();
  const destino=new URL('reclamar-taller.html',location.href);
  if(id)destino.searchParams.set('id',id);
  if(slug)destino.searchParams.set('slug',slug);
  boton.href=destino.pathname+destino.search;
  boton.textContent='Gestionar o dar de baja este taller';
}());
