(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  let ventanaExterna=null;

  function normalizarUrl(valor){
    const v=String(valor||'').trim();
    if(!v)return '';
    return /^https?:\/\//i.test(v)?v:`https://${v}`;
  }

  function esBloqueada(url){
    try{
      const host=new URL(url).hostname.toLowerCase();
      return /(^|\.)(google\.|googleusercontent\.|gstatic\.|facebook\.|instagram\.|linkedin\.|tiktok\.|youtube\.)/.test(host);
    }catch{return false;}
  }

  function estado(texto,ok=true){
    const nodo=$('estado-fuente-externa');
    if(!nodo)return;
    nodo.textContent=texto;
    nodo.style.color=ok?'#15803d':'#b45309';
  }

  function prepararPanel(){
    const wrap=document.querySelector('.tm-webwrap');
    if(!wrap||$('estado-fuente-externa'))return;
    const visor=$('visor-externo');
    if(visor)visor.style.display='none';
    const panel=document.createElement('div');
    panel.style.cssText='height:100%;display:grid;place-items:center;padding:22px;background:#f8fafc;text-align:center';
    panel.innerHTML='<div style="max-width:520px"><strong style="font-size:1.05rem">Navegación externa segura</strong><p class="tm-status" style="margin:8px 0">Google y muchas webs no permiten mostrarse dentro de TallerMap. Se abrirán en una ventana auxiliar, mientras este panel mantiene las herramientas para copiar, analizar y transferir datos.</p><div id="estado-fuente-externa" class="tm-status" style="margin:10px 0">Selecciona un taller y pulsa “Abrir”.</div><button id="btn-reabrir-externa" type="button" class="tm-btn tm-btn-primary">Abrir fuente externa</button></div>';
    wrap.appendChild(panel);
    $('btn-reabrir-externa')?.addEventListener('click',()=>abrirVentana(normalizarUrl($('url-externa')?.value)));
  }

  function abrirVentana(url){
    if(!url){estado('No hay una dirección externa válida.',false);return;}
    const ancho=Math.max(520,Math.floor(screen.availWidth*0.46));
    const alto=Math.max(620,screen.availHeight-70);
    const izquierda=Math.max(0,screen.availWidth-ancho);
    const opciones=`popup=yes,width=${ancho},height=${alto},left=${izquierda},top=20,scrollbars=yes,resizable=yes`;
    try{
      if(!ventanaExterna||ventanaExterna.closed)ventanaExterna=window.open(url,'tallermap_fuente_externa',opciones);
      else{ventanaExterna.location.href=url;ventanaExterna.focus();}
      if(!ventanaExterna){estado('El navegador bloqueó la ventana. Permite ventanas emergentes para tallermap.es.',false);return;}
      estado('Fuente externa abierta en una ventana auxiliar. Copia los datos y pégalos en el panel derecho.');
    }catch(error){estado(`No se pudo abrir la fuente: ${error.message}`,false);}
  }

  function abrirActual(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const url=normalizarUrl($('url-externa')?.value);
    if(url)$('url-externa').value=url;
    abrirVentana(url);
  }

  function abrirPestana(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const url=normalizarUrl($('url-externa')?.value);
    if(url)window.open(url,'_blank','noopener,noreferrer');
  }

  function abrirBusquedaTaller(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    const valores=['nombre','direccion','ciudad','telefono'].map(id=>$(id)?.value?.trim()).filter(Boolean);
    if(!valores.length){estado('Selecciona primero una ficha existente.',false);return;}
    const url=`https://www.google.com/search?q=${encodeURIComponent(valores.join(' '))}`;
    $('url-externa').value=url;
    abrirVentana(url);
  }

  function conectar(){
    prepararPanel();
    $('btn-cargar-url')?.addEventListener('click',abrirActual,true);
    $('btn-nueva-pestana')?.addEventListener('click',abrirPestana,true);
    $('btn-google')?.addEventListener('click',abrirBusquedaTaller,true);
    $('url-externa')?.addEventListener('keydown',e=>{if(e.key==='Enter')abrirActual(e);},true);

    document.addEventListener('click',e=>{
      if(!e.target.closest('.tm-result'))return;
      setTimeout(()=>{
        const valores=['nombre','direccion','ciudad','telefono'].map(id=>$(id)?.value?.trim()).filter(Boolean);
        if(!valores.length)return;
        const url=`https://www.google.com/search?q=${encodeURIComponent(valores.join(' '))}`;
        $('url-externa').value=url;
        estado('Ficha preparada. Pulsa “Abrir” para consultar Google en la ventana auxiliar.');
      },120);
    });

    const urlInicial=normalizarUrl($('url-externa')?.value);
    if(urlInicial&&esBloqueada(urlInicial))estado('Google no puede incrustarse. Pulsa “Abrir” para usar la ventana auxiliar.',false);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',conectar,{once:true});else conectar();
}());