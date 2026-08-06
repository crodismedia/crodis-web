(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const form=$('form-taller');
  if(!form)return;

  const field=document.createElement('div');
  field.className='tm-field full';
  field.innerHTML='<label for="url-interna-ficha">URL interna de la ficha</label><div style="display:grid;grid-template-columns:1fr auto auto;gap:8px"><input id="url-interna-ficha" type="url" readonly aria-readonly="true" placeholder="Selecciona una ficha"><button id="copiar-url-interna" type="button" class="tm-btn tm-btn-soft">Copiar</button><button id="abrir-url-interna" type="button" class="tm-btn tm-btn-soft">Abrir</button></div><small id="estado-url-interna" class="tm-status">Enlace propio de TallerMap asociado al registro de Supabase.</small>';
  const nombre=$('nombre')?.closest('.tm-field');
  if(nombre)nombre.insertAdjacentElement('beforebegin',field);
  else form.prepend(field);

  function slugSeguro(v){return String(v||'').trim().replace(/^\/+|\/+$/g,'');}
  function urlPorDatos(id,slug){
    const limpio=slugSeguro(slug);
    return limpio
      ? `https://www.tallermap.es/talleres/${encodeURIComponent(limpio)}`
      : `https://www.tallermap.es/pages/taller.html?id=${encodeURIComponent(id)}`;
  }

  async function actualizar(){
    const id=$('taller-id')?.value;
    const input=$('url-interna-ficha');
    if(!id||!input){if(input)input.value='';return;}
    input.value=urlPorDatos(id,'');
    if(!supabase)return;
    const {data,error}=await supabase.from('talleres').select('slug').eq('id',id).maybeSingle();
    if(!error&&data)input.value=urlPorDatos(id,data.slug);
  }

  $('resultados-talleres')?.addEventListener('click',()=>setTimeout(actualizar,100));
  new MutationObserver(actualizar).observe($('taller-id'),{attributes:true,attributeFilter:['value']});

  $('copiar-url-interna')?.addEventListener('click',async()=>{
    const url=$('url-interna-ficha')?.value;
    if(!url)return;
    try{await navigator.clipboard.writeText(url);$('estado-url-interna').textContent='URL copiada al portapapeles.';}
    catch{$('url-interna-ficha').select();document.execCommand('copy');$('estado-url-interna').textContent='URL copiada.';}
  });
  $('abrir-url-interna')?.addEventListener('click',()=>{
    const url=$('url-interna-ficha')?.value;
    if(url)window.open(url,'_blank','noopener,noreferrer');
  });

  ['admin-research-center.js','admin-auto-research.js','admin-horario-partido.js'].forEach((archivo)=>{
    const script=document.createElement('script');
    script.src=`../js/${archivo}`;
    script.defer=true;
    document.body.appendChild(script);
  });
}());