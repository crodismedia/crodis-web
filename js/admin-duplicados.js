(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=id=>document.getElementById(id);
  const PAGE_SIZE=50,DB_PAGE_SIZE=1000;
  let candidatos=[],visibles=[],pagina=0,fusionando=false;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function norm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
  function telefono(v){const n=String(v||"").replace(/\D+/g,"");return n.length>=9?n.slice(-9):"";}
  function estado(texto,tipo=""){const el=$("admin-estado");if(el){el.textContent=texto;el.dataset.tipo=tipo;}}
  function slug(t){if(t.slug)return String(t.slug);const base=norm(`${t.nombre||"taller"} ${t.ciudad||""}`).replace(/\s+/g,"-");return t.id?`${base}-${String(t.id).slice(0,8)}`:base;}

  async function proteger(){
    if(!supabase){estado("Sin conexión","error");return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    estado("Acceso verificado","ok");return true;
  }

  function agregarGrupo(mapa,clave,t){if(!clave)return;if(!mapa.has(clave))mapa.set(clave,[]);mapa.get(clave).push(t);}
  function paresDeGrupo(lista,senal,acum){
    if(lista.length<2)return;
    for(let i=0;i<lista.length;i++)for(let j=i+1;j<lista.length;j++){
      const a=lista[i],b=lista[j],key=[String(a.id),String(b.id)].sort().join("|");
      if(!acum.has(key))acum.set(key,{a,b,senales:new Set()});
      acum.get(key).senales.add(senal);
    }
  }
  function construirCandidatos(talleres){
    const porTelefono=new Map(),porNombreCiudad=new Map(),porNombreCp=new Map();
    talleres.forEach(t=>{
      const nom=norm(t.nombre),ciu=norm(t.ciudad),cp=String(t.codigo_postal||"").trim(),tel=telefono(t.telefono);
      agregarGrupo(porTelefono,tel,t);if(nom&&ciu)agregarGrupo(porNombreCiudad,`${nom}|${ciu}`,t);if(nom&&cp)agregarGrupo(porNombreCp,`${nom}|${cp}`,t);
    });
    const acum=new Map();
    porTelefono.forEach(g=>paresDeGrupo(g,"Mismo teléfono",acum));
    porNombreCiudad.forEach(g=>paresDeGrupo(g,"Mismo nombre y población",acum));
    porNombreCp.forEach(g=>paresDeGrupo(g,"Mismo nombre y CP",acum));
    return [...acum.values()].map(x=>{
      const s=[...x.senales];let confianza="normal",peso=1;
      if(s.includes("Mismo teléfono")&&s.length>=2){confianza="alta";peso=3;}else if(s.includes("Mismo teléfono")||s.includes("Mismo nombre y población")){confianza="media";peso=2;}
      return {...x,senales:s,confianza,peso};
    }).sort((x,y)=>y.peso-x.peso||String(x.a.nombre||"").localeCompare(String(y.a.nombre||""),"es"));
  }

  async function cargarTodosLosTalleres(){
    const talleres=[];
    for(let desde=0;;desde+=DB_PAGE_SIZE){
      estado(`Consultando base de datos… ${talleres.length.toLocaleString("es-ES")} talleres cargados`);
      const {data,error}=await supabase.from("talleres").select("id,nombre,telefono,ciudad,provincia,codigo_postal,slug").order("id",{ascending:true}).range(desde,desde+DB_PAGE_SIZE-1);
      if(error)throw error;const bloque=Array.isArray(data)?data:[];talleres.push(...bloque);if(bloque.length<DB_PAGE_SIZE)break;
    }
    return talleres;
  }

  function renderTaller(t){return `<strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.ciudad||"—")} · ${esc(t.provincia||"—")} · ${esc(t.codigo_postal||"—")}</small><small>${esc(t.telefono||"Sin teléfono")} · ID ${esc(String(t.id).slice(0,12))}</small>`;}
  function opcionesFusion(c){
    return `<div class="merge-options" hidden>
      <button type="button" class="merge-btn" data-keep="${esc(c.a.id)}" data-drop="${esc(c.b.id)}" data-keep-name="${esc(c.a.nombre||"Taller A")}" data-drop-name="${esc(c.b.nombre||"Taller B")}">Conservar ID A</button>
      <button type="button" class="merge-btn" data-keep="${esc(c.b.id)}" data-drop="${esc(c.a.id)}" data-keep-name="${esc(c.b.nombre||"Taller B")}" data-drop-name="${esc(c.a.nombre||"Taller A")}">Conservar ID B</button>
    </div>`;
  }
  function render(){
    const inicio=pagina*PAGE_SIZE,fin=inicio+PAGE_SIZE,filas=visibles.slice(inicio,fin);
    $("tabla-duplicados").innerHTML=filas.length?filas.map(c=>`<tr><td><span class="chip ${c.confianza}">${c.confianza[0].toUpperCase()+c.confianza.slice(1)}</span></td><td>${renderTaller(c.a)}</td><td>${renderTaller(c.b)}</td><td><div class="signals">${c.senales.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}</div></td><td><div class="actions"><a href="/talleres/${encodeURIComponent(slug(c.a))}" target="_blank" rel="noopener">Ficha A</a><a href="/talleres/${encodeURIComponent(slug(c.b))}" target="_blank" rel="noopener">Ficha B</a><button type="button" class="merge-toggle">Fusionar</button>${opcionesFusion(c)}</div></td></tr>`).join(""):'<tr><td colspan="5" style="padding:28px;text-align:center;color:#66736b">No hay candidatos con estos filtros.</td></tr>';
    $("dup-info").textContent=`${visibles.length.toLocaleString("es-ES")} candidatos · página ${pagina+1} de ${Math.max(1,Math.ceil(visibles.length/PAGE_SIZE))}`;
    $("dup-anterior").disabled=pagina<=0;$("dup-siguiente").disabled=fin>=visibles.length;
  }

  function filtrar(reset=true){
    if(reset)pagina=0;const q=norm($("dup-busqueda").value),confianza=$("dup-confianza").value;
    visibles=candidatos.filter(c=>{if(confianza&&c.confianza!==confianza)return false;if(!q)return true;return norm([c.a.nombre,c.a.ciudad,c.a.telefono,c.a.id,c.b.nombre,c.b.ciudad,c.b.telefono,c.b.id,c.senales.join(" ")].join(" ")).includes(q);});render();
  }

  async function fusionar(keep,drop,keepName,dropName){
    if(fusionando||!keep||!drop||keep===drop)return;
    const texto=`Se conservará el ID de “${keepName}” y se fusionarán en esa ficha los datos y relaciones de “${dropName}”. El segundo nombre y el ID absorbido quedarán registrados en la ficha principal.\n\nEscribe FUSIONAR para confirmar.`;
    if(String(window.prompt(texto)||"").trim().toUpperCase()!=="FUSIONAR")return;
    fusionando=true;document.querySelectorAll(".merge-btn,.merge-toggle").forEach(b=>b.disabled=true);estado(`Fusionando ${dropName} en ${keepName}…`);
    try{
      const {error}=await supabase.rpc("admin_fusionar_talleres",{p_conservar:keep,p_eliminar:drop});
      if(error)throw error;
      estado(`Fusión completada: se conserva ${keepName}`,"ok");
      await recalcular();
    }catch(error){console.error("Error fusionando talleres:",error);estado(`No se pudo fusionar: ${error.message}`,"error");alert(`No se pudo completar la fusión.\n\n${error.message}`);}
    finally{fusionando=false;document.querySelectorAll(".merge-btn,.merge-toggle").forEach(b=>b.disabled=false);}
  }

  async function recalcular(){
    const boton=$("btn-recalcular");if(boton)boton.disabled=true;estado("Consultando todos los talleres de Supabase…");$("tabla-duplicados").innerHTML='<tr><td colspan="5">Consultando todos los talleres de la base de datos…</td></tr>';
    try{const talleres=await cargarTodosLosTalleres();estado(`Analizando ${talleres.length.toLocaleString("es-ES")} talleres…`);candidatos=construirCandidatos(talleres);$("dup-total").textContent=candidatos.length.toLocaleString("es-ES");$("dup-alta").textContent=candidatos.filter(c=>c.confianza==="alta").length.toLocaleString("es-ES");$("dup-telefono").textContent=candidatos.filter(c=>c.senales.includes("Mismo teléfono")).length.toLocaleString("es-ES");estado(`Análisis completado · ${talleres.length.toLocaleString("es-ES")} talleres consultados`,"ok");filtrar(true);}catch(error){console.error("Error consultando talleres:",error);estado(`Error: ${error.message}`,"error");$("tabla-duplicados").innerHTML='<tr><td colspan="5">No se pudo completar la consulta.</td></tr>';}finally{if(boton)boton.disabled=false;}
  }

  function enlazar(){
    $("btn-recalcular").addEventListener("click",recalcular);$("btn-filtrar").addEventListener("click",()=>filtrar(true));$("dup-busqueda").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();filtrar(true);}});$("dup-confianza").addEventListener("change",()=>filtrar(true));$("dup-anterior").addEventListener("click",()=>{if(pagina>0){pagina--;render();}});$("dup-siguiente").addEventListener("click",()=>{if((pagina+1)*PAGE_SIZE<visibles.length){pagina++;render();}});
    $("tabla-duplicados").addEventListener("click",e=>{
      const toggle=e.target.closest(".merge-toggle");
      if(toggle){const box=toggle.parentElement?.querySelector(".merge-options");if(box){box.hidden=!box.hidden;toggle.textContent=box.hidden?"Fusionar":"Cancelar fusión";}return;}
      const b=e.target.closest(".merge-btn");if(b)fusionar(b.dataset.keep,b.dataset.drop,b.dataset.keepName,b.dataset.dropName);
    });
    $("btn-cerrar-sesion").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  }
  async function iniciar(){enlazar();if(await proteger())await recalcular();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
}());
