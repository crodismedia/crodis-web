(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  let talleres=[];
  let municipios=[];

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function num(v){return new Intl.NumberFormat("es-ES").format(Number(v)||0);}
  function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}

  async function proteger(){
    if(!supabase){estado("Sin conexión","error");return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    estado("Acceso verificado","ok");
    return true;
  }

  function agrupar(){
    const mapaProv=new Map();
    const mapaMun=new Map();
    let incompletos=0;
    talleres.forEach(t=>{
      const provincia=String(t.provincia||"").trim();
      const ciudad=String(t.ciudad||"").trim();
      const cp=String(t.codigo_postal||"").trim();
      if(!provincia||!ciudad||!cp)incompletos++;
      const provKey=provincia||"Sin provincia";
      if(!mapaProv.has(provKey))mapaProv.set(provKey,{talleres:0,municipios:new Set(),incompletos:0});
      const p=mapaProv.get(provKey);p.talleres++;if(ciudad)p.municipios.add(ciudad);if(!provincia||!ciudad||!cp)p.incompletos++;
      const munKey=`${norm(provincia)}|${norm(ciudad)}`;
      if(!mapaMun.has(munKey))mapaMun.set(munKey,{ciudad:ciudad||"Sin municipio",provincia:provincia||"Sin provincia",talleres:0,cps:new Set(),incompletos:0});
      const m=mapaMun.get(munKey);m.talleres++;if(cp)m.cps.add(cp);if(!provincia||!ciudad||!cp)m.incompletos++;
    });
    municipios=[...mapaMun.values()].sort((a,b)=>b.talleres-a.talleres||a.ciudad.localeCompare(b.ciudad,"es"));
    $("geo-total").textContent=num(talleres.length);
    $("geo-provincias").textContent=num([...mapaProv.keys()].filter(x=>x!=="Sin provincia").length);
    $("geo-municipios").textContent=num(municipios.filter(x=>x.ciudad!=="Sin municipio").length);
    $("geo-incompletos").textContent=num(incompletos);

    const provincias=[...mapaProv.entries()].sort((a,b)=>b[1].talleres-a[1].talleres);
    $("geo-lista-provincias").innerHTML=provincias.map(([nombre,d])=>`<div class="prov"><div><strong>${esc(nombre)}</strong><small>${num(d.municipios.size)} municipios${d.incompletos?` · ${num(d.incompletos)} incompletos`:""}</small></div><strong>${num(d.talleres)}</strong></div>`).join("")||'<p class="empty">Sin datos.</p>';

    const select=$("geo-provincia");
    const actual=select.value;
    select.innerHTML='<option value="">Todas</option>'+provincias.filter(([p])=>p!=="Sin provincia").map(([p])=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
    if([...select.options].some(o=>o.value===actual))select.value=actual;
  }

  function renderMunicipios(){
    const termino=norm($("geo-busqueda").value);
    const provincia=$("geo-provincia").value;
    const lista=municipios.filter(m=>{
      if(provincia&&m.provincia!==provincia)return false;
      if(!termino)return true;
      const texto=norm(`${m.ciudad} ${m.provincia} ${[...m.cps].join(" ")}`);
      return texto.includes(termino);
    }).slice(0,300);
    $("geo-tabla").innerHTML=lista.map(m=>`<tr><td><strong>${esc(m.ciudad)}</strong></td><td>${esc(m.provincia)}</td><td>${num(m.talleres)}</td><td>${esc([...m.cps].sort().slice(0,6).join(", ")||"—")}</td><td>${m.incompletos?`<span class="chip warn">${num(m.incompletos)} incompletos</span>`:'<span class="chip">Correcta</span>'}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">No hay municipios con estos filtros.</td></tr>';
    $("geo-info").textContent=`${num(lista.length)} municipios mostrados${lista.length===300?" · límite visual 300":""}`;
  }

  async function cargar(){
    estado("Cargando cobertura…");
    const {data,error}=await supabase.from("talleres").select("id,provincia,ciudad,codigo_postal").limit(10000);
    if(error){estado(`Error: ${error.message}`,"error");return;}
    talleres=Array.isArray(data)?data:[];
    agrupar();renderMunicipios();estado("Cobertura actualizada","ok");
  }

  function enlazar(){
    $("btn-recargar").addEventListener("click",cargar);
    $("btn-filtrar-geo").addEventListener("click",renderMunicipios);
    $("geo-provincia").addEventListener("change",renderMunicipios);
    $("geo-busqueda").addEventListener("input",renderMunicipios);
    $("btn-cerrar-sesion").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  }

  async function iniciar(){enlazar();if(!await proteger())return;await cargar();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
}());
