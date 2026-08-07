(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const originalFetch=window.fetch.bind(window);

  // Evita búsquedas colgadas indefinidamente y muestra un error útil.
  window.fetch=function(input,init={}){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/busqueda-web'))return originalFetch(input,init);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    const next={...init,signal:controller.signal};
    return originalFetch(input,next)
      .catch(error=>{
        if(error?.name==='AbortError')throw new Error('El buscador web no respondió en 12 segundos.');
        throw error;
      })
      .finally(()=>clearTimeout(timeout));
  };

  function cargarCss(href){
    if(document.querySelector(`link[href="${href}"]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  }

  function cargarScript(src){
    return new Promise((resolve,reject)=>{
      const existente=[...document.scripts].find(s=>s.src===src);
      if(existente){if(window.L)return resolve();existente.addEventListener('load',resolve,{once:true});return;}
      const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);
    });
  }

  async function prepararMapa(){
    const panel=$('mapa-panel');
    const visor=$('visor-maps');
    if(!panel||!visor)return null;

    const cont=document.createElement('div');
    cont.id='visor-mapa-local';
    cont.style.cssText='width:100%;height:100%;min-height:480px;background:#eef1f4';
    visor.replaceWith(cont);

    cargarCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    await cargarScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    if(!window.L)return null;

    const map=L.map(cont).setView([39.47,-0.38],8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'© OpenStreetMap'
    }).addTo(map);
    return map;
  }

  function consultaActual(){
    const ids=['nombre','direccion','codigo_postal','ciudad','provincia'];
    return ids.map(id=>String($(id)?.value||'').trim()).filter(Boolean).join(' ');
  }

  async function geocodificar(q){
    const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=${encodeURIComponent(q)}`;
    const r=await originalFetch(url,{headers:{'Accept-Language':'es'}});
    if(!r.ok)throw new Error(`Geocodificación ${r.status}`);
    const data=await r.json();
    return data?.[0]||null;
  }

  async function iniciar(){
    const estado=$('estado-busqueda-web');
    let mapa=null;
    let marcador=null;
    try{mapa=await prepararMapa();}catch(error){console.error('Mapa interno',error);}

    const boton=$('btn-maps');
    boton?.addEventListener('click',async()=>{
      const q=String($('busqueda-web')?.value||'').trim()||consultaActual();
      if(!q){if(estado)estado.textContent='Selecciona una ficha o escribe una ubicación.';return;}
      const panel=$('mapa-panel');
      const resultados=$('resultados-web');
      if(resultados)resultados.hidden=true;
      if(panel)panel.hidden=false;
      if(estado)estado.textContent='Localizando en el mapa…';
      try{
        const punto=await geocodificar(q);
        if(!punto)throw new Error('No se encontró la ubicación');
        const lat=Number(punto.lat),lon=Number(punto.lon);
        if(mapa){
          if(marcador)marcador.remove();
          marcador=L.marker([lat,lon]).addTo(mapa).bindPopup(punto.display_name||q).openPopup();
          mapa.setView([lat,lon],16);
          setTimeout(()=>mapa.invalidateSize(),50);
        }
        if(estado)estado.textContent='Mapa cargado correctamente.';
      }catch(error){
        console.error(error);
        if(estado)estado.textContent=`Mapa: ${error.message||'no se pudo localizar'}`;
      }
    },true);

    // Diagnóstico visible del buscador web.
    const buscar=$('btn-busqueda-web');
    buscar?.addEventListener('click',()=>{
      if(estado)estado.dataset.ultimaBusqueda=String(Date.now());
      setTimeout(()=>{
        if(!estado)return;
        if(/buscando en la web/i.test(estado.textContent||'')){
          estado.textContent='El buscador sigue esperando respuesta. Revisa la conexión o vuelve a intentar.';
        }
      },13000);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
}());
