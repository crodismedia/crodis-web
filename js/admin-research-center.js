(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const form=$('form-taller');
  const source=$('dato-candidato');
  if(!form||!source)return;

  const clean=v=>String(v||'').trim();
  const esc=v=>clean(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

  function extract(text){
    const raw=clean(text);
    const lines=raw.split(/\n+/).map(clean).filter(Boolean);
    const phone=(raw.match(/(?:\+34[\s.-]?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/)||[])[0]||'';
    const email=(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
    const postal=(raw.match(/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/)||[])[0]||'';
    const web=(raw.match(/https?:\/\/[^\s<>()]+|www\.[^\s<>()]+/i)||[])[0]||'';
    const address=lines.find(x=>/\b(calle|c\/|avenida|avda|carretera|ctra|plaza|pol[ií]gono|camino|paseo|ronda)\b/i.test(x))||'';
    const cityLine=lines.find(x=>postal&&x.includes(postal))||'';
    const city=cityLine.replace(postal,'').replace(/^[,\s-]+|[,\s-]+$/g,'');
    const name=lines.find(x=>x!==address&&!/@|https?:|www\.|\b\d{5}\b|\b[6789]\d{2}/i.test(x))||'';
    return {nombre:name,direccion:address,codigo_postal:postal,ciudad:city,telefono:phone,web,email};
  }

  function similarity(a,b){
    const x=norm(a),y=norm(b); if(!x||!y)return 0; if(x===y||x.includes(y)||y.includes(x))return 1;
    const xa=new Set(x.split(' ')),ya=new Set(y.split(' '));
    const i=[...xa].filter(v=>ya.has(v)).length,u=new Set([...xa,...ya]).size;
    return u?i/u:0;
  }

  function status(field,value){
    const current=clean($(field)?.value);
    if(!value)return ['Sin dato','#64748b'];
    if(!current)return ['Falta en Supabase','#b45309'];
    const s=similarity(current,value);
    if(s>=.85)return ['Coincide','#15803d'];
    if(s>=.55)return ['Parecido','#b45309'];
    return ['Diferente','#b91c1c'];
  }

  function apply(field,value){
    const node=$(field); if(!node||!value)return;
    node.value=value;
    node.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function build(){
    const pane=document.querySelector('[data-pane="fuente"]');
    if(!pane)return;
    const oldWrap=pane.querySelector('.tm-webwrap');
    if(oldWrap)oldWrap.remove();
    const oldNote=pane.querySelector('.tm-webnote');
    if(oldNote)oldNote.remove();
    const oldUrl=pane.querySelector('.tm-urlbar');
    if(oldUrl)oldUrl.remove();

    const head=pane.querySelector('.tm-pane-head');
    const h2=head?.querySelector('h2'); if(h2)h2.textContent='Centro de investigación';
    const p=head?.querySelector('p'); if(p)p.textContent='Pega información encontrada y compara cada dato con la ficha de Supabase.';

    if($('research-center'))return;
    const box=document.createElement('section');
    box.id='research-center';
    box.className='tm-transfer';
    box.innerHTML='<div class="tm-inspector-head"><strong>Resultado estructurado</strong><strong id="research-score">0 %</strong></div><div id="research-summary" class="tm-status">Selecciona un taller y pega información externa.</div><div id="research-results" class="tm-inspector-list"></div><div class="tm-transfer-actions"><button id="research-fill-missing" type="button" class="tm-btn tm-btn-primary">Añadir solo faltantes</button><button id="research-fill-all" type="button" class="tm-btn tm-btn-soft">Añadir todos</button><button id="research-clear" type="button" class="tm-btn tm-btn-soft">Descartar</button></div>';
    const inspector=pane.querySelector('.tm-inspector');
    inspector?.insertAdjacentElement('beforebegin',box);
  }

  let last={};
  function render(){
    build();
    const results=$('research-results'),summary=$('research-summary'),scoreNode=$('research-score');
    if(!results||!summary||!scoreNode)return;
    if(!$('taller-id')?.value||!clean(source.value)){
      last={}; results.innerHTML=''; scoreNode.textContent='0 %'; summary.textContent='Selecciona un taller y pega información externa.'; return;
    }
    last=extract(source.value);
    const fields=[['nombre','Nombre',35],['direccion','Dirección',30],['codigo_postal','Código postal',20],['ciudad','Municipio',15],['telefono','Teléfono',0],['web','Web',0],['email','Correo',0]];
    let got=0,available=0;
    results.innerHTML=fields.map(([key,label,weight])=>{
      const value=last[key]||'';
      if(weight&&value&&clean($(key)?.value)){available+=weight;got+=weight*similarity($(key).value,value);}
      const [state,color]=status(key,value);
      return `<article class="tm-suggestion"><div><small>${esc(label)} · <span style="color:${color}">${esc(state)}</span></small><span>${esc(value||'No detectado')}</span><small>Actual: ${esc($(key)?.value||'vacío')}</small></div><button type="button" class="tm-btn tm-btn-soft" data-use="${key}" ${value?'':'disabled'}>Añadir</button></article>`;
    }).join('');
    const score=available?Math.round(got/available*100):0;
    scoreNode.textContent=`${score} %`;
    summary.textContent=score>=90?'Coincidencia muy alta: probablemente es el mismo taller.':score>=70?'Coincidencia razonable: revisa las diferencias.':'Coincidencia baja o datos insuficientes.';
    results.querySelectorAll('[data-use]').forEach(btn=>btn.onclick=()=>apply(btn.dataset.use,last[btn.dataset.use]));
  }

  build();
  source.addEventListener('input',render);
  $('btn-analizar')?.addEventListener('click',()=>setTimeout(render,0));
  $('btn-pegar-candidato')?.addEventListener('click',()=>setTimeout(render,150));
  $('resultados-talleres')?.addEventListener('click',()=>setTimeout(render,100));
  $('research-fill-missing')?.addEventListener('click',()=>Object.entries(last).forEach(([k,v])=>{if(v&&!clean($(k)?.value))apply(k,v);}));
  $('research-fill-all')?.addEventListener('click',()=>Object.entries(last).forEach(([k,v])=>{if(v)apply(k,v);}));
  $('research-clear')?.addEventListener('click',()=>{source.value='';render();});
}());