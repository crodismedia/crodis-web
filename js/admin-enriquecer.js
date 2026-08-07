(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const PAGE_SIZE=50;
  const BATCH_SIZE=100;
  const STORAGE_KEY="tallermap_enriquecimiento_lote_v1";
  let filas=[];
  let filtradas=[];
  let pagina=1;
  let modoLote=false;
  let loteActual=[];
  let loteOffset=0;
  let revisadas=new Set();

  function txt(v){return String(v??"").trim();}
  function normalizar(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function tieneServicios(v){return Array.isArray(v)?v.filter(Boolean).length>0:txt(v)!==""&&txt(v)!=="[]";}
  function tieneHorarios(v){if(!v)return false;if(typeof v==="string")return txt(v)!==""&&txt(v)!=="{}";if(typeof v==="object")return Object.keys(v).length>0;return false;}

  async function proteger(){
    if(!supabase){$("admin-estado").textContent="Sin conexión";return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    $("admin-estado").textContent="Acceso verificado";
    return true;
  }

  async function cargarTodos(){
    const todos=[];
    const lote=1000;
    for(let desde=0;;desde+=lote){
      const {data,error}=await supabase.from("talleres")
        .select("id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,descripcion,servicios,horarios,verificado")
        .order("id",{ascending:true})
        .range(desde,desde+lote-1);
      if(error)throw error;
      todos.push(...(data||[]));
      if(!data||data.length<lote)break;
    }
    return todos;
  }

  function evaluar(t){
    const checks={
      telefono:Boolean(txt(t.telefono)),
      direccion:Boolean(txt(t.direccion)),
      codigo_postal:Boolean(txt(t.codigo_postal)),
      ciudad:Boolean(txt(t.ciudad)),
      provincia:Boolean(txt(t.provincia)),
      web:Boolean(txt(t.web)),
      servicios:tieneServicios(t.servicios),
      horarios:tieneHorarios(t.horarios),
      descripcion:Boolean(txt(t.descripcion))
    };
    const pesos={telefono:18,direccion:16,codigo_postal:10,ciudad:10,provincia:6,web:12,servicios:12,horarios:8,descripcion:8};
    let puntos=0;
    Object.entries(checks).forEach(([k,ok])=>{if(ok)puntos+=pesos[k]||0;});
    const faltan=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
    const faltanValor=faltan.filter(k=>["telefono","direccion","codigo_postal","ciudad","web","servicios","horarios"].includes(k));
    const prioridad=faltanValor.length>=3||(!checks.telefono&&!checks.direccion)?"alta":faltanValor.length>=1?"media":"baja";
    return {...t,checks,faltan,faltanValor,puntos,prioridad};
  }

  function contextoBase(t){return [txt(t.nombre),txt(t.ciudad),txt(t.codigo_postal),txt(t.provincia)].filter(Boolean).join(" ");}
  function queryCampo(t,campo){
    const base=contextoBase(t);
    const extras={
      telefono:"teléfono contacto",
      web:"web oficial",
      direccion:"dirección taller",
      codigo_postal:"dirección código postal",
      ciudad:"ubicación municipio",
      horarios:"horario apertura",
      servicios:"servicios taller mecánico"
    };
    return [base,extras[campo]||"taller mecánico"].filter(Boolean).join(" ");
  }
  function abrirGoogle(t,campo){window.open(`https://www.google.com/search?q=${encodeURIComponent(queryCampo(t,campo))}`,"_blank","noopener,noreferrer");}
  function abrirMaps(t){window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([txt(t.nombre),txt(t.direccion),txt(t.ciudad),txt(t.codigo_postal),txt(t.provincia)].filter(Boolean).join(" "))}`,"_blank","noopener,noreferrer");}
  function abrirEditor(t){guardarEstadoLote();location.href=`admin-editor.html?id=${encodeURIComponent(t.id)}`;}

  function metricas(talleres){
    $("enr-total").textContent=talleres.length.toLocaleString("es-ES");
    $("enr-pendientes").textContent=filas.length.toLocaleString("es-ES");
    $("enr-alta").textContent=filas.filter(f=>f.prioridad==="alta").length.toLocaleString("es-ES");
    $("enr-telefono").textContent=filas.filter(f=>!f.checks.telefono).length.toLocaleString("es-ES");
    $("enr-web").textContent=filas.filter(f=>!f.checks.web).length.toLocaleString("es-ES");
  }

  function provincias(){
    const vals=[...new Set(filas.map(f=>txt(f.provincia)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    $("enr-provincia").innerHTML='<option value="">Todas las provincias</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function calcularFiltradas(){
    const filtro=$("enr-filtro").value;
    const provincia=$("enr-provincia").value;
    const q=normalizar($("enr-buscar").value);
    return filas.filter(f=>{
      if(filtro==="alta"&&f.prioridad!=="alta")return false;
      if(["telefono","web","direccion","codigo_postal","ciudad","servicios","horarios"].includes(filtro)&&f.checks[filtro])return false;
      if(provincia&&txt(f.provincia)!==provincia)return false;
      if(q){
        const texto=normalizar([f.nombre,f.ciudad,f.codigo_postal,f.provincia,f.direccion,f.telefono].join(" "));
        if(!texto.includes(q))return false;
      }
      return true;
    });
  }

  function aplicarFiltros(){
    filtradas=calcularFiltradas();
    salirLote(false);
    pagina=1;
    render();
  }

  function botonesInvestigacion(t){
    const orden=["telefono","web","direccion","codigo_postal","ciudad","horarios","servicios"];
    const etiquetas={telefono:"Teléfono",web:"Web",direccion:"Dirección",codigo_postal:"CP",ciudad:"Población",horarios:"Horarios",servicios:"Servicios"};
    const botones=orden.filter(k=>!t.checks[k]).slice(0,4).map(k=>`<button class="admin-btn" type="button" data-buscar-campo="${esc(k)}" data-id="${esc(t.id)}">${esc(etiquetas[k])}</button>`);
    botones.push(`<button class="admin-btn" type="button" data-maps="${esc(t.id)}">Maps</button>`);
    return botones.join("");
  }

  function guardarEstadoLote(){
    try{
      const payload={
        modoLote,
        loteOffset,
        loteIds:loteActual.map(t=>String(t.id)),
        revisadas:[...revisadas],
        filtro:$("enr-filtro")?.value||"todas",
        provincia:$("enr-provincia")?.value||"",
        buscar:$("enr-buscar")?.value||""
      };
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify(payload));
    }catch(_error){}
  }

  function limpiarEstadoLote(){try{sessionStorage.removeItem(STORAGE_KEY);}catch(_error){}}

  function actualizarEstadoLote(){
    const btnPreparar=$("enr-preparar-lote");
    const btnSiguiente=$("enr-siguiente-lote");
    const btnSalir=$("enr-salir-lote");
    if(!modoLote){
      $("enr-lote-estado").textContent="Sin lote activo";
      $("enr-lote-progreso").textContent=`${filtradas.length.toLocaleString("es-ES")} fichas coinciden con los filtros actuales.`;
      btnPreparar.hidden=false;
      btnSiguiente.hidden=true;
      btnSalir.hidden=true;
      return;
    }
    const numero=Math.floor(loteOffset/BATCH_SIZE)+1;
    const totalLotes=Math.max(1,Math.ceil(filtradas.length/BATCH_SIZE));
    const revisadasLote=loteActual.filter(t=>revisadas.has(String(t.id))).length;
    $("enr-lote-estado").textContent=`Lote ${numero} de ${totalLotes} · ${loteActual.length} fichas`;
    $("enr-lote-progreso").textContent=`${revisadasLote} de ${loteActual.length} marcadas como revisadas · posiciones ${loteOffset+1}-${Math.min(loteOffset+loteActual.length,filtradas.length)} de ${filtradas.length.toLocaleString("es-ES")}`;
    btnPreparar.hidden=true;
    btnSiguiente.hidden=loteOffset+BATCH_SIZE>=filtradas.length;
    btnSalir.hidden=false;
  }

  function prepararLote(offset=0){
    if(!filtradas.length){alert("No hay fichas con los filtros actuales.");return;}
    loteOffset=Math.max(0,offset);
    loteActual=filtradas.slice(loteOffset,loteOffset+BATCH_SIZE);
    if(!loteActual.length){alert("No quedan más fichas en esta selección.");return;}
    modoLote=true;
    revisadas=new Set();
    pagina=1;
    guardarEstadoLote();
    render();
  }

  function siguienteLote(){prepararLote(loteOffset+BATCH_SIZE);}

  function salirLote(renderizar=true){
    modoLote=false;
    loteActual=[];
    loteOffset=0;
    revisadas=new Set();
    limpiarEstadoLote();
    pagina=1;
    if(renderizar)render();
  }

  function alternarRevisada(id){
    const key=String(id);
    if(revisadas.has(key))revisadas.delete(key);else revisadas.add(key);
    guardarEstadoLote();
    render();
  }

  function restaurarEstadoLote(){
    let saved=null;
    try{saved=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"null");}catch(_error){saved=null;}
    if(!saved)return false;
    if(saved.filtro&&$("enr-filtro"))$("enr-filtro").value=saved.filtro;
    if($("enr-provincia"))$("enr-provincia").value=saved.provincia||"";
    if($("enr-buscar"))$("enr-buscar").value=saved.buscar||"";
    filtradas=calcularFiltradas();
    if(!saved.modoLote)return false;
    const ids=new Set((saved.loteIds||[]).map(String));
    loteActual=filtradas.filter(t=>ids.has(String(t.id)));
    loteOffset=Number.isFinite(Number(saved.loteOffset))?Number(saved.loteOffset):0;
    revisadas=new Set((saved.revisadas||[]).map(String));
    modoLote=loteActual.length>0;
    return modoLote;
  }

  function render(){
    const fuente=modoLote?loteActual:filtradas;
    const totalPaginas=Math.max(1,Math.ceil(fuente.length/PAGE_SIZE));
    if(pagina>totalPaginas)pagina=totalPaginas;
    const inicio=(pagina-1)*PAGE_SIZE;
    const lote=fuente.slice(inicio,inicio+PAGE_SIZE);
    $("enr-tabla").innerHTML=lote.map(t=>{
      const falta=t.faltanValor.map(k=>k.replace("codigo_postal","CP").replace("ciudad","población")).join(", ")||"—";
      const ubic=[t.ciudad,t.provincia,t.codigo_postal].filter(Boolean).join(" · ")||"—";
      const clase=t.prioridad==="alta"?"bad":t.prioridad==="media"?"warn":"ok";
      const revisada=revisadas.has(String(t.id));
      const estado=modoLote?`<button class="admin-btn${revisada?" primary":""}" type="button" data-revisada="${esc(t.id)}">${revisada?"✓ Revisada":"Marcar revisada"}</button>`:"—";
      return `<tr>
        <td><strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.id)}</small></td>
        <td>${esc(ubic)}<small>${esc(t.direccion||"")}</small></td>
        <td><span class="admin-badge ${clase}">${t.puntos}%</span></td>
        <td>${esc(falta)}</td>
        <td><div class="admin-row-actions">${botonesInvestigacion(t)}</div></td>
        <td><button class="admin-btn primary" type="button" data-editor="${esc(t.id)}">Investigar y editar</button></td>
        <td>${estado}</td>
      </tr>`;
    }).join("")||'<tr><td colspan="7">No hay fichas con estos filtros.</td></tr>';
    $("enr-pagina").textContent=`Página ${pagina} de ${totalPaginas} · ${fuente.length.toLocaleString("es-ES")} fichas${modoLote?" en el lote":""}`;
    $("enr-anterior").disabled=pagina<=1;
    $("enr-siguiente").disabled=pagina>=totalPaginas;
    const porId=new Map(filas.map(f=>[String(f.id),f]));
    document.querySelectorAll("[data-buscar-campo]").forEach(b=>b.addEventListener("click",()=>abrirGoogle(porId.get(b.dataset.id),b.dataset.buscarCampo)));
    document.querySelectorAll("[data-maps]").forEach(b=>b.addEventListener("click",()=>abrirMaps(porId.get(b.dataset.maps))));
    document.querySelectorAll("[data-editor]").forEach(b=>b.addEventListener("click",()=>abrirEditor(porId.get(b.dataset.editor))));
    document.querySelectorAll("[data-revisada]").forEach(b=>b.addEventListener("click",()=>alternarRevisada(b.dataset.revisada)));
    actualizarEstadoLote();
  }

  async function cargar(){
    $("admin-estado").textContent="Analizando fichas…";
    $("enr-tabla").innerHTML='<tr><td colspan="7">Analizando…</td></tr>';
    try{
      const talleres=await cargarTodos();
      filas=talleres.map(evaluar)
        .filter(t=>t.faltanValor.length>0)
        .sort((a,b)=>a.puntos-b.puntos||String(a.nombre||"").localeCompare(String(b.nombre||""),"es"));
      filtradas=[...filas];
      metricas(talleres);
      provincias();
      restaurarEstadoLote();
      if(!modoLote)filtradas=calcularFiltradas();
      pagina=1;
      render();
      $("admin-estado").textContent=`${filas.length.toLocaleString("es-ES")} fichas por enriquecer`;
    }catch(error){
      console.error(error);
      $("admin-estado").textContent=`Error: ${error.message||"no se pudo analizar"}`;
      $("enr-tabla").innerHTML='<tr><td colspan="7">No se pudieron cargar las fichas.</td></tr>';
    }
  }

  $("btn-recargar")?.addEventListener("click",cargar);
  $("enr-filtro")?.addEventListener("change",aplicarFiltros);
  $("enr-provincia")?.addEventListener("change",aplicarFiltros);
  $("enr-buscar")?.addEventListener("input",aplicarFiltros);
  $("enr-preparar-lote")?.addEventListener("click",()=>prepararLote(0));
  $("enr-siguiente-lote")?.addEventListener("click",siguienteLote);
  $("enr-salir-lote")?.addEventListener("click",()=>salirLote(true));
  $("enr-anterior")?.addEventListener("click",()=>{if(pagina>1){pagina--;render();}});
  $("enr-siguiente")?.addEventListener("click",()=>{const fuente=modoLote?loteActual:filtradas;if(pagina*PAGE_SIZE<fuente.length){pagina++;render();}});
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{limpiarEstadoLote();await supabase.auth.signOut();location.replace("admin-login.html");});
  proteger().then(ok=>{if(ok)cargar();});
}());
