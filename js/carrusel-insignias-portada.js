/* TallerMap: cinta compacta de insignias, solo para la portada.
   El catálogo es decorativo (no interviene en el SEO ni en las búsquedas). */
(function(){
  'use strict';
  const seccion=document.getElementById('tm-carrusel-marcas');
  if(!seccion)return;
  const tira=seccion.querySelector('.tm-marcas-tira');
  const ventana=seccion.querySelector('.tm-marcas-ventana');
  if(!tira||!ventana)return;

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
  const botonGrande=overlay.querySelector('.tm-logo-ampliado');
  const imagenGrande=botonGrande.querySelector('img');
  const textoNombre=overlay.querySelector('.tm-logo-nombre');
  let origen=null;
  let overflowOriginal='';

  function crearBloque(marcas,duplicado){
    const bloque=document.createElement('div');
    bloque.className='tm-marcas-bloque'+(duplicado?' tm-marcas-duplicado':'');
    if(duplicado)bloque.setAttribute('aria-hidden','true');
    else{
      bloque.setAttribute('role','list');
      bloque.setAttribute('aria-label','Marcas por orden alfabético');
    }
    const lote=document.createDocumentFragment();
    for(let n=0;n<marcas.length;n++){
      const marca=marcas[n];
      const figura=document.createElement('figure');
      figura.className='tm-marca-item';
      if(!duplicado)figura.setAttribute('role','listitem');
      const boton=document.createElement('button');
      boton.type='button';
      boton.className='tm-marca-boton';
      boton.dataset.nombre=marca.nombre;
      boton.dataset.imagen=marca.url;
      boton.setAttribute('aria-label','Ampliar insignia de '+marca.nombre);
      if(duplicado)boton.tabIndex=-1;
      const sello=document.createElement('span');
      sello.className='tm-marca-sello';
      const img=document.createElement('img');
      img.src=marca.url;
      img.alt=duplicado?'':'Insignia de '+marca.nombre;
      img.width=96;
      img.height=64;
      img.loading=n<12&&!duplicado?'eager':'lazy';
      img.decoding='async';
      sello.appendChild(img);
      boton.appendChild(sello);
      const nombre=document.createElement('figcaption');
      nombre.textContent=marca.nombre;
      figura.appendChild(boton);
      figura.appendChild(nombre);
      lote.appendChild(figura);
    }
    bloque.appendChild(lote);
    return bloque;
  }

  function abrir(boton){
    const marca=boton.dataset.nombre;
    const url=boton.dataset.imagen;
    if(!marca||!url)return;
    origen=boton;
    textoNombre.textContent=marca;
    imagenGrande.src=url;
    imagenGrande.alt='Insignia de '+marca;
    botonGrande.setAttribute('aria-label','Cerrar insignia de '+marca);
    overflowOriginal=document.body.style.overflow;
    document.body.style.overflow='hidden';
    seccion.classList.add('tm-marcas-ampliando');
    overlay.inert=false;
    overlay.setAttribute('aria-hidden','false');
    overlay.classList.add('abierto');
    botonGrande.focus({preventScroll:true});
  }
  function cerrar(){
    if(!overlay.classList.contains('abierto'))return;
    overlay.classList.remove('abierto');
    overlay.setAttribute('aria-hidden','true');
    overlay.inert=true;
    seccion.classList.remove('tm-marcas-ampliando');
    document.body.style.overflow=overflowOriginal;
    if(origen&&origen.isConnected)origen.focus({preventScroll:true});
    origen=null;
  }

  ventana.addEventListener('click',function(evento){
    const boton=evento.target.closest('.tm-marca-boton');
    if(boton&&ventana.contains(boton))abrir(boton);
  });
  botonGrande.addEventListener('click',cerrar);
  overlay.addEventListener('click',function(evento){
    if(evento.target===overlay||evento.target.classList.contains('tm-logo-panel'))cerrar();
  });
  document.addEventListener('keydown',function(evento){
    if(!overlay.classList.contains('abierto'))return;
    if(evento.key==='Escape'){evento.preventDefault();cerrar();}
    if(evento.key==='Tab'){evento.preventDefault();botonGrande.focus({preventScroll:true});}
  });

  fetch('/data/marcas-insignias.json',{cache:'force-cache'})
    .then(function(resp){
      if(!resp.ok)throw new Error('Catálogo de insignias no disponible');
      return resp.json();
    })
    .then(function(data){
      if(!data||!Array.isArray(data.marcas)||data.marcas.length<101)throw new Error('Catálogo incompleto');
      const marcas=data.marcas.filter(function(m){
        return m&&typeof m.nombre==='string'&&typeof m.url==='string'&&
          m.url.startsWith('https://cdn.jsdelivr.net/gh/vehiclespecs/brand-logos@')&&
          /\.(svg|png)$/.test(m.url);
      });
      if(marcas.length!==data.marcas.length)throw new Error('URL de insignia incorrecta');
      tira.replaceChildren(crearBloque(marcas,false),crearBloque(marcas,true));
      seccion.querySelector('.tm-marcas-numero').textContent=String(marcas.length);
      seccion.style.setProperty('--tm-marcas-inicio',(-Math.random()*200).toFixed(2)+'s');
      seccion.removeAttribute('aria-busy');
    })
    .catch(function(error){
      tira.textContent='No se han podido cargar las insignias.';
      seccion.removeAttribute('aria-busy');
      console.warn('[TallerMap] El carrusel no se ha cargado:',error.message);
    });
})();
