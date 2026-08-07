(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const PAGE_SIZE=50;
  let pagina=0,total=0,filas=[];

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function fecha(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"}).format(d);}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function slugTaller(t){if(t.slug)return String(t.slug);const base=`${t.nombre||"taller"}-${t.ciudad||""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");return t.id?`${base}-${String(t.id).slice(0,8)}`:base;}
  function incompleta(t){return !String(t.telefono||"").trim()||!String(t.direccion||"").trim()||!String(t.codigo_postal||"").trim();}
  function desdeDias(dias){const d=new Date();d.setDate(d.getDate()-dias);return d.toISOString();}

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

  async function contarDesde(dias){
    const {count,error}=await supabase.from("talleres").select("id",{count:"exact",head:true}).gte("created_at",desdeDias(dias));
    if(error)throw error;return count||0;
  }

  async function cargarMetricas(){
    const [r1,r7,r30,recientes]=await Promise.all([
      contarDesde(1),contarDesde(7),contarDesde(30),supabase.from("talleres").select("telefono,direccion,codigo_postal").gte("created_at",desdeDias(30)).limit(5000)
    ]);
    $("alta-24h").textContent=r1.toLocaleString("es-ES");
    $("alta-7d").textContent=r7.toLocaleString("es-ES");
    $("alta-30d").textContent=r30.toLocaleString("es-ES");
    $("alta-incompletas").textContent=recientes.error?"—":(recientes.data||[]).filter(incompleta).length.toLocaleString("es-ES");
  }

  function construirConsulta(){
    const dias=Number($("alta-periodo").value)||7;
    const termino=String($("alta-busqueda").value||"").replace(/[,%().]/g," ").replace(/\s+/g," ").trim().slice(0,80);
    const calidad=$("alta-estado").value;
    let q=supabase.from("talleres").select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,verificado,slug,created_at",{count:"exact"}).gte("created_at",desdeDias(dias));
    if(termino)q=q.or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,ciudad.ilike.%${termino}%,codigo_postal.ilike.%${termino}%`);
    if(calidad==="no-verificadas")q=q.or("verificado.is.false,verificado.is.null");
    return q.order("created_at",{ascending:false}).range(pagina*PAGE_SIZE,pagina*PAGE_SIZE+PAGE_SIZE-1);
  }

  function aplicarFiltroCalidad(data){
    const calidad=$("alta-estado").value;
    if(calidad==="completas")return data.filter(t=>!incompleta(t));
    if(calidad==="incompletas")return data.filter(incompleta);
    return data;
  }

  function render(){
    const tbody=$("tabla-altas");
    if(!filas.length){tbody.innerHTML='<tr><td colspan="7">No hay altas con estos filtros.</td></tr>';}
    else tbody.innerHTML=filas.map(t=>{
      const faltas=[];if(!String(t.telefono||"").trim())faltas.push("teléfono");if(!String(t.direccion||"").trim())faltas.push("dirección");if(!String(t.codigo_postal||"").trim())faltas.push("CP");
      const slug=slugTaller(t);
      return `<tr>
        <td>${fecha(t.created_at)}</td>
        <td><strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.provincia||"")}</small></td>
        <td>${esc(t.ciudad||"—")}<small>${esc(t.direccion||"Sin dirección")}</small></td>
        <td>${esc(t.telefono||"—")}</td>
        <td>${faltas.length?`<span class="chip warn">Falta ${esc(faltas.join(", "))}</span>`:'<span class="chip ok">Completa</span>'}</td>
        <td>${t.verificado?'<span class="chip ok">Verificado</span>':'<span class="chip">Publicado</span>'}</td>
        <td><div class="actions"><a href="admin-editor.html">Editar</a><a href="/talleres/${encodeURIComponent(slug)}" target="_blank" rel="noopener">Ver ficha</a></div></td>
      </tr>`;
    }).join("");
    $("alta-info").textContent=`${total.toLocaleString("es-ES")} altas en el periodo · página ${pagina+1} de ${Math.max(1,Math.ceil(total/PAGE_SIZE))}`;
    $("alta-anterior").disabled=pagina<=0;
    $("alta-siguiente").disabled=(pagina+1)*PAGE_SIZE>=total;
  }

  async function buscar(reset=false){
    if(reset)pagina=0;
    estado("Cargando altas…");
    const {data,error,count}=await construirConsulta();
    if(error){estado(`Error: ${error.message}`,"error");filas=[];total=0;render();return;}
    filas=aplicarFiltroCalidad(Array.isArray(data)?data:[]);
    total=Number(count)||0;
    estado("Datos actualizados","ok");render();
  }

  function enlazar(){
    $("btn-filtrar").addEventListener("click",()=>buscar(true));
    $("alta-busqueda").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();buscar(true);}});
    ["alta-periodo","alta-estado"].forEach(id=>$(id).addEventListener("change",()=>buscar(true)));
    $("alta-anterior").addEventListener("click",()=>{if(pagina>0){pagina--;buscar(false);}});
    $("alta-siguiente").addEventListener("click",()=>{if((pagina+1)*PAGE_SIZE<total){pagina++;buscar(false);}});
    $("btn-cerrar-sesion").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  }

  async function iniciar(){enlazar();if(!await proteger())return;await Promise.allSettled([cargarMetricas(),buscar(true)]);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
}());