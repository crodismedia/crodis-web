(function(){
"use strict";
const publicado=document.getElementById('v4-publica');
if(!publicado)return;

const boton=document.createElement('button');
boton.id='v4-preview-dinamica';
boton.className='v4-btn v4-soft';
boton.type='button';
boton.textContent='Vista previa inmediata';
boton.disabled=true;
publicado.insertAdjacentElement('afterend',boton);

function slugActual(){
  const url=String(publicado.dataset.url||'').trim();
  if(!url)return '';
  try{
    const parsed=new URL(url,window.location.origin);
    const parts=parsed.pathname.split('/').filter(Boolean);
    return parts[0]==='talleres'&&parts[1]?decodeURIComponent(parts[1]):'';
  }catch(_error){
    return '';
  }
}

function sincronizar(){
  boton.disabled=!slugActual();
}

boton.addEventListener('click',()=>{
  const slug=slugActual();
  if(!slug)return;
  const url=new URL('/api/taller-public',window.location.origin);
  url.searchParams.set('slug',slug);
  url.searchParams.set('v4_preview',String(Date.now()));
  window.open(url.href,'_blank','noopener');
});

new MutationObserver(sincronizar).observe(publicado,{
  attributes:true,
  attributeFilter:['data-url','disabled']
});
sincronizar();

if(!document.getElementById('v4-inspector-live-script')){
  const script=document.createElement('script');
  script.id='v4-inspector-live-script';
  script.src='../js/admin-editor-v4-inspector.js?v=1';
  script.defer=true;
  document.body.appendChild(script);
}
})();
