(function(){
'use strict';

const sb=window.supabaseClient;
const publicado=document.getElementById('v4-publica');
const estado=document.getElementById('v4-estado');
if(!sb||!publicado||!estado)return;

const style=document.createElement('style');
style.textContent=`
.v4-inspector{margin-top:12px;border:1px solid #d9e0e7;border-radius:12px;background:#f8fafc;overflow:hidden}
.v4-inspector[hidden]{display:none}
.v4-inspector-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border-bottom:1px solid #e5e7eb;background:#fff}
.v4-inspector-head strong{display:block}.v4-inspector-head small{display:block;color:#667085;margin-top:2px}
.v4-inspector-list{display:grid;gap:7px;padding:12px}
.v4-inspector-row{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:9px;border:1px solid #e5e7eb;background:#fff}
.v4-inspector-row.ok{border-color:#86efac;background:#f0fdf4}.v4-inspector-row.bad{border-color:#fca5a5;background:#fef2f2}
.v4-inspector-row b{min-width:18px}.v4-inspector-row span{display:block;font-size:.86rem}.v4-inspector-row small{display:block;color:#667085;margin-top:2px;word-break:break-word}
.v4-inspector-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 12px 12px}
.v4-inspector-summary{font-size:.86rem}
`;
document.head.appendChild(style);

const inspectorButton=document.createElement('button');
inspectorButton.id='v4-inspector-live';
inspectorButton.type='button';
inspectorButton.className='v4-btn v4-soft';
inspectorButton.textContent='Inspector Live';
inspectorButton.disabled=true;
publicado.insertAdjacentElement('afterend',inspectorButton);

const panel=document.createElement('section');
panel.className='v4-inspector';
panel.hidden=true;
panel.innerHTML=`
  <div class="v4-inspector-head">
    <div><strong>Inspector Live</strong><small id="v4-inspector-sub">Comprobación directa de Supabase, GitHub y web pública.</small></div>
    <div id="v4-inspector-resumen" class="v4-inspector-summary"></div>
  </div>
  <div id="v4-inspector-lista" class="v4-inspector-list"></div>
  <div class="v4-inspector-actions">
    <button id="v4-inspector-repetir" class="v4-btn v4-soft" type="button">Volver a comprobar</button>
    <button id="v4-inspector-sync" class="v4-btn v4-green" type="button">Forzar sincronización</button>
    <button id="v4-inspector-abrir" class="v4-btn v4-soft" type="button">Abrir ficha pública</button>
  </div>`;
estado.insertAdjacentElement('afterend',panel);

const lista=document.getElementById('v4-inspector-lista');
const resumen=document.getElementById('v4-inspector-resumen');
const sub=document.getElementById('v4-inspector-sub');
const syncButton=document.getElementById('v4-inspector-sync');
const repeatButton=document.getElementById('v4-inspector-repetir');
const openButton=document.getElementById('v4-inspector-abrir');

function slugActual(){
  const url=String(publicado.dataset.url||'').trim();
  if(!url)return '';
  try{
    const parsed=new URL(url,window.location.origin);
    const parts=parsed.pathname.split('/').filter(Boolean);
    return parts[0]==='talleres'&&parts[1]?decodeURIComponent(parts[1]):'';
  }catch(_error){return '';}
}

function syncAvailability(){
  inspectorButton.disabled=!slugActual();
  if(!slugActual())panel.hidden=true;
}

function esc(value){
  return String(value??'').replace(/[&<>"']/g,(c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function inspect(){
  const slug=slugActual();
  if(!slug)return;
  panel.hidden=false;
  inspectorButton.disabled=true;
  repeatButton.disabled=true;
  syncButton.disabled=true;
  resumen.textContent='Comprobando…';
  sub.textContent=slug;
  lista.innerHTML='<div class="v4-inspector-row"><b>…</b><div><span>Consultando ficha pública, Supabase y HTML estático…</span></div></div>';

  try{
    const response=await fetch(`/api/inspector-taller?slug=${encodeURIComponent(slug)}&_=${Date.now()}`,{cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);

    const failed=Number(data.summary?.failed||0);
    resumen.textContent=failed?`⚠ ${failed} aviso(s)`:`✓ Todo correcto`;
    lista.innerHTML=(data.checks||[]).map((check)=>`
      <div class="v4-inspector-row ${check.ok?'ok':'bad'}">
        <b>${check.ok?'✓':'✕'}</b>
        <div><span>${esc(check.label)}</span><small>${esc(check.detail||'')}</small></div>
      </div>`).join('');

    if(data.summary?.stale){
      syncButton.classList.add('v4-primary');
      syncButton.textContent='Forzar sincronización';
    }else{
      syncButton.classList.remove('v4-primary');
      syncButton.textContent='Regenerar esta ficha';
    }
  }catch(error){
    resumen.textContent='✕ Error';
    lista.innerHTML=`<div class="v4-inspector-row bad"><b>✕</b><div><span>No se pudo completar la comprobación</span><small>${esc(error.message||error)}</small></div></div>`;
  }finally{
    inspectorButton.disabled=false;
    repeatButton.disabled=false;
    syncButton.disabled=false;
  }
}

async function forceSync(){
  const slug=slugActual();
  if(!slug)return;
  syncButton.disabled=true;
  const previous=syncButton.textContent;
  syncButton.textContent='Solicitando…';
  try{
    const result=await sb.rpc('solicitar_sync_taller_estatico',{p_slug:slug});
    if(result.error)throw result.error;
    resumen.textContent='✓ Sincronización solicitada';
    const notice=document.createElement('div');
    notice.className='v4-inspector-row ok';
    notice.innerHTML='<b>✓</b><div><span>Ficha añadida a la cola</span><small>GitHub la regenerará automáticamente en pocos minutos.</small></div>';
    lista.prepend(notice);
    syncButton.textContent='Solicitada';
  }catch(error){
    resumen.textContent='✕ No se pudo solicitar';
    syncButton.textContent=previous;
    alert('No se pudo forzar la sincronización: '+(error.message||error));
  }finally{
    syncButton.disabled=false;
  }
}

inspectorButton.addEventListener('click',inspect);
repeatButton.addEventListener('click',inspect);
syncButton.addEventListener('click',forceSync);
openButton.addEventListener('click',()=>{
  const url=String(publicado.dataset.url||'').trim();
  if(url)window.open(url,'_blank','noopener');
});

new MutationObserver(syncAvailability).observe(publicado,{attributes:true,attributeFilter:['data-url','disabled']});
syncAvailability();
})();
