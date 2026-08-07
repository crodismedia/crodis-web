(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const PAGE=50;
  let pagina=0;
  let total=0;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function num(v){return new Intl.NumberFormat("es-ES").format(Number(v)||0);}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function limpio(v){return String(v??"").trim();}
  function incompleto(v){return !limpio(v);}
  function problemas(t){
    const lista=[];
    if(!t.verificado)lista.push("No verificado");
    if(incompleto(t.telefono))lista.push("Sin teléfono");
    if(incompleto(t.direccion))lista.push("Sin dirección");
    if(incompleto(t.codigo_postal))lista.push("Sin CP");
    return lista;
  }
  function prioridad(t){const n=problemas(t).length;return n>=3?{txt:"Alta",cls:"alta"}:n===2?{txt:"Media",cls:"media"}:{txt:"Normal",cls:""};}

  async function proteger(){
    if(!supabase){estado("Sin conexión con Supabase","error");return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    estado("Acceso verificado","ok");
    return true;
  }

  async function contar(query){const {count,error}=await query;if(error)throw error;return count||0;}

  async function cargarMetricas(){
    const rs=await Promise.allSettled([
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).eq("verificado",false)),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("telefono.is.null,telefono.eq.")),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("direccion.is.null,direccion.eq.")),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("codigo_postal.is.null,codigo_postal.eq."))
    ]);
    const vals=rs.map(r=>r.status==="fulfilled"?r.value:null);
    [["rev-pendientes",vals[0]],["rev-sin-telefono",vals[1]],["rev-sin-direccion",vals[2]],["rev-sin-cp",vals[3]]].forEach(([id,v])=>{$(id).textContent=v===null?"—":num(v);});
  }

  async function cargarProvincias(){
    const {data,error}=await supabase.from("talleres").select("provincia");
    if(error)return;
    const provincias=[...new Set((data||[]).map(t=>limpio(t.provincia)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    const sel=$("rev-provincia");
    provincias.forEach(p=>{const o=document.createElement("option");o.value=p;o.textContent=p;sel.appendChild(o);});
  }

  function aplicarFiltros(q){
    const bus=limpio($("rev-busqueda").value).replace(/[,%().]/g," ").replace(/\s+/g," ").slice(0,80);
    const tipo=$("rev-tipo").value;
    const provincia=$("rev-provincia").value;
    if(bus)q=q.or(`nombre.ilike.%${bus}%,telefono.ilike.%${bus}%,ciudad.ilike.%${bus}%,codigo_postal.ilike.%${bus}%`);
    if(provincia)q=q.eq("provincia",provincia);
    if(tipo==="no-verificado")q=q.eq("verificado",false);
    if(tipo==="sin-telefono")q=q.or("telefono.is.null,telefono.eq.");
    if(tipo==="sin-direccion")q=q.or("direccion.is.null,direccion.eq.");
    if(tipo==="sin-cp")q=q.or("codigo_postal.is.null,codigo_postal.eq.");
    return q;
  }

  function cumpleTipo(t){
    const tipo=$("rev-tipo").value;
    const p=problemas(t);
    if(tipo==="varios")return p.length>=2;
    if(!tipo)return p.length>0;
    return true;
  }

  function render(data){
    const cuerpo=$("tabla-revisiones");
    const filtrados=(data||[]).filter(cumpleTipo);
    cuerpo.innerHTML=filtrados.map(t=>{
      const ps=problemas(t);
      const pr=prioridad(t);
      const chips=ps.map(p=>`<span class="chip ${p==="No verificado"?"warn":"bad"}">${esc(p)}</span>`).join("");
      const slug=limpio(t.slug);
      return `<tr>
        <td><strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.id||"")}</small></td>
        <td>${esc([t.direccion,t.codigo_postal,t.ciudad].filter(Boolean).join(", ")||"—")}<small>${esc(t.provincia||"—")}</small></td>
        <td><div class="chips">${chips||'<span class="chip ok">Sin incidencias</span>'}</div></td>
        <td><span class="priority ${pr.cls}">${pr.txt}</span></td>
        <td><span class="chip ${t.verificado?"ok":"warn"}">${t.verificado?"Verificado":"Pendiente"}</span></td>
        <td><div class="actions">
          <a href="admin-editor.html?buscar=${encodeURIComponent(t.nombre||t.id||"")}">Editar</a>
          ${slug?`<a href="/talleres/${encodeURIComponent(slug)}" target="_blank" rel="noopener">Ficha</a>`:""}
          ${!t.verificado?`<button class="verify" type="button" data-verificar="${esc(t.id)}">Verificar</button>`:""}
        </div></td>
      </tr>`;
    }).join("")||'<tr><td colspan="6">No hay talleres pendientes con estos filtros.</td></tr>';
    cuerpo.querySelectorAll("[data-verificar]").forEach(btn=>btn.addEventListener("click",()=>verificar(btn.dataset.verificar)));
  }

  async function cargar(){
    estado("Cargando revisiones…");
    let q=supabase.from("talleres").select("id,nombre,slug,telefono,direccion,codigo_postal,ciudad,provincia,verificado,created_at",{count:"exact"});
    q=aplicarFiltros(q).order("verificado",{ascending:true}).order("created_at",{ascending:false}).range(pagina*PAGE,pagina*PAGE+PAGE-1);
    const {data,count,error}=await q;
    if(error){estado(`Error: ${error.message}`,"error");$("tabla-revisiones").innerHTML='<tr><td colspan="6">No se pudieron cargar las revisiones.</td></tr>';return;}
    total=count||0;
    render(data);
    const ini=total?pagina*PAGE+1:0;const fin=Math.min((pagina+1)*PAGE,total);
    $("rev-info").textContent=`${num(ini)}–${num(fin)} de ${num(total)}`;
    $("rev-anterior").disabled=pagina===0;
    $("rev-siguiente").disabled=(pagina+1)*PAGE>=total;
    estado("Revisiones actualizadas","ok");
  }

  async function verificar(id){
    if(!id)return;
    const {error}=await supabase.from("talleres").update({verificado:true}).eq("id",id);
    if(error){estado(`No se pudo verificar: ${error.message}`,"error");return;}
    estado("Taller verificado","ok");
    await Promise.allSettled([cargarMetricas(),cargar()]);
  }

  $("btn-revisar")?.addEventListener("click",()=>{pagina=0;cargar();});
  $("rev-busqueda")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();pagina=0;cargar();}});
  $("rev-anterior")?.addEventListener("click",()=>{if(pagina>0){pagina--;cargar();}});
  $("rev-siguiente")?.addEventListener("click",()=>{if((pagina+1)*PAGE<total){pagina++;cargar();}});
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});

  (async()=>{if(!await proteger())return;await Promise.allSettled([cargarMetricas(),cargarProvincias()]);await cargar();})();
}());
