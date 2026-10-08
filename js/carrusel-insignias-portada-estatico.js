/* TallerMap: version sin peticion de datos. Las 184 insignias estan en el HTML. */
(function(){
  'use strict';
  const seccion=document.getElementById('tm-carrusel-marcas');
  if(!seccion)return;
  const tira=seccion.querySelector('.tm-marcas-tira');
  const primera=seccion.querySelector('.tm-marcas-bloque');
  const ventana=seccion.querySelector('.tm-marcas-ventana');
  if(!tira||!primera||!ventana)return;
  const botones=primera.querySelectorAll('.tm-marca-boton');
  if(botones.length<101)return;

  /* Segunda copia exacta para el movimiento infinito. Sin solicitudes JSON. */
  const copia=primera.cloneNode(true);
  copia.classList.add('tm-marcas-duplicado');
  copia.removeAttribute('role');
  copia.removeAttribute('aria-label');
  copia.setAttribute('aria-hidden','true');
  copia.querySelectorAll('.tm-marca-boton').forEach(function(b){b.tabIndex=-1;});
  copia.querySelectorAll('img').forEach(function(img){img.alt='';img.loading='lazy';});
  tira.appendChild(copia);
  seccion.style.setProperty('--tm-marcas-inicio',(-Math.random()*185).toFixed(2)+'s');
  seccion.classList.add('tm-marcas-listo');

  const overlay=document.createElement('div');
  overlay.className='tm-logo-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-hidden','true');
  overlay.setAttribute('aria-labelledby','tm-logo-nombre');
  overlay.setAttribute('aria-describedby','tm-logo-instruccion');
  overlay.inert=true;
  overlay.innerHTML=
    '<div class="tm-logo-panel">'+
    '<button class="tm-logo-ampliado" type="button" aria-label="Cerrar insignia ampliada">'+
    '<img alt="" width="420" height="320" decoding="async"></button>'+
    '<strong class="tm-logo-nombre" id="tm-logo-nombre"></strong>'+
    '<p class="tm-logo-instruccion" id="tm-logo-instruccion">Toca de nuevo la insignia para cerrarla</p>'+
    '</div>';
  document.body.appendChild(overlay);
  const grande=overlay.querySelector('.tm-logo-ampliado');
  const imagen=grande.querySelector('img');
  const titulo=overlay.querySelector('.tm-logo-nombre');
  let origen=null;
  let overflowAnterior='';

  function abrir(boton){
    const figura=boton.closest('.tm-marca-item');
    const img=boton.querySelector('img');
    if(!figura||!img)return;
    const marca=figura.querySelector('figcaption').textContent.trim();
    if(!marca||!img.src)return;
    origen=boton;
    titulo.textContent=marca;
    imagen.src=img.currentSrc||img.src;
    imagen.alt='Insignia de '+marca;
    grande.setAttribute('aria-label','Cerrar insignia de '+marca);
    overflowAnterior=document.body.style.overflow;
    document.body.style.overflow='hidden';
    seccion.classList.add('tm-marcas-ampliando');
    overlay.inert=false;
    overlay.setAttribute('aria-hidden','false');
    overlay.classList.add('abierto');
    grande.focus({preventScroll:true});
  }
  function cerrar(){
    if(!overlay.classList.contains('abierto'))return;
    overlay.classList.remove('abierto');
    overlay.setAttribute('aria-hidden','true');
    overlay.inert=true;
    seccion.classList.remove('tm-marcas-ampliando');
    document.body.style.overflow=overflowAnterior;
    if(origen&&origen.isConnected)origen.focus({preventScroll:true});
    origen=null;
  }

  ventana.addEventListener('click',function(evento){
    const boton=evento.target.closest('.tm-marca-boton');
    if(boton&&ventana.contains(boton))abrir(boton);
  });
  grande.addEventListener('click',cerrar);
  overlay.addEventListener('click',function(evento){
    if(evento.target===overlay||evento.target.classList.contains('tm-logo-panel'))cerrar();
  });
  document.addEventListener('keydown',function(evento){
    if(!overlay.classList.contains('abierto'))return;
    if(evento.key==='Escape'){evento.preventDefault();cerrar();}
    if(evento.key==='Tab'){evento.preventDefault();grande.focus({preventScroll:true});}
  });
})();