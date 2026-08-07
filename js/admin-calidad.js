(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const PAGE_SIZE=50;
  let incidencias=[];
  let filtradas=[];
  let pagina=1;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function num(v){return new Intl.NumberFormat("es-ES").format(Number(v)||0);}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function normalizar(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
  function soloDigitos(v){return String(v||"").replace(/\D/g,"");}
  function provinciaCanonica(v){
    const p=normalizar(v);
    if(p==="alicante"||p==="alacant")return "Alicante";
    if(p==="castellon"||p==="castello"||p==="castellon/castello"||p==="castello/castellon")return "Castellón";
    if(p==="valencia"||p==="valencia/valencia")return "Valencia";
    return null;
  }
  function webValida(v){
    const texto=String(v||"").trim();
    if(!texto)return true;
    try{
      const url=new URL(/^https?:\/\//i.test(texto)?texto:`https://${texto}`);
      return Boolean(url.hostname&&url.hostname.includes("."));
    }catch{return false;}
  }

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

  async function cargarTodos(){
    const todos=[];
    const lote=1000;
    for(let desde=0;;desde+=lote){
      const {data,error}=await supabase.from("talleres")
        .select("id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,verificado")
        .order("id",{ascending:true})
        .range(desde,desde+lote-1);
      if(error)throw error;
      todos.push(...(data||[]));
      if(!data||data.length<lote)break;
    }
    return todos;
  }

  function analizarTaller(t){
    const salida=[];
    const telefono=soloDigitos(t.telefono);
    if(String(t.telefono||"").trim()&&telefono.length!==9){
      salida.push({tipo:"telefono",etiqueta:"Teléfono dudoso",dato:t.telefono||"—",t});
    }
    const cp=soloDigitos(t.codigo_postal);
    if(String(t.codigo_postal||"").trim()&&cp.length!==5){
      salida.push({tipo:"cp",etiqueta:"Código postal dudoso",dato:t.codigo_postal||"—",t});
    }
    if(String(t.provincia||"").trim()&&!provinciaCanonica(t.provincia)){
      salida.push({tipo:"provincia",etiqueta:"Provincia no reconocida",dato:t.provincia||"—",t});
    }
    if(!String(t.ciudad||"").trim()){
      salida.push({tipo:"ciudad",etiqueta:"Sin población",dato:"Vacío",t});
    }
    if(String(t.web||"").trim()&&!webValida(t.web)){
      salida.push({tipo:"web",etiqueta:"Web dudosa",dato:t.web||"—",t});
    }
    return salida;
  }

  function rellenarProvincias(talleres){
    const valores=[...new Set(talleres.map(t=>String(t.provincia||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    $("filtro-provincia").innerHTML='<option value="">Todas las provincias</option>'+valores.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function actualizarMetricas(talleres){
    const contar=(tipo)=>incidencias.filter(i=>i.tipo===tipo).length;
    $("metrica-total").textContent=num(talleres.length);
    $("metrica-telefono").textContent=num(contar("telefono"));
    $("metrica-cp").textContent=num(contar("cp"));
    $("metrica-provincia").textContent=num(contar("provincia"));
    $("metrica-web").textContent=num(contar("web"));
  }

  function aplicarFiltros(){
    const q=normalizar($("buscar").value);
    const tipo=$("filtro-tipo").value;
    const provincia=$("filtro-provincia").value;
    filtradas=incidencias.filter(i=>{
      const t=i.t;
      const texto=normalizar([t.nombre,t.ciudad,t.provincia,t.telefono,t.codigo_postal,i.dato,i.etiqueta].join(" "));
      if(q&&!texto.includes(q))return false;
      if(tipo&&i.tipo!==tipo)return false;
      if(provincia&&String(t.provincia||"")!==provincia)return false;
      return true;
    });
    pagina=1;
    render();
  }

  function render(){
    const totalPaginas=Math.max(1,Math.ceil(filtradas.length/PAGE_SIZE));
    if(pagina>totalPaginas)pagina=totalPaginas;
    const inicio=(pagina-1)*PAGE_SIZE;
    const lote=filtradas.slice(inicio,inicio+PAGE_SIZE);
    const cuerpo=$("tabla-calidad");
    cuerpo.innerHTML=lote.map(i=>{
      const t=i.t;
      return `<tr>
        <td><strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.id||"")}</small></td>
        <td>${esc(t.ciudad||"—")}<small>${esc(t.provincia||"—")} · ${esc(t.codigo_postal||"—")}</small></td>
        <td>${esc(i.dato)}</td>
        <td><span class="admin-chip ${i.tipo==="provincia"||i.tipo==="ciudad"?"warn":"soft"}">${esc(i.etiqueta)}</span></td>
        <td><a class="admin-link" href="admin-editor.html?id=${encodeURIComponent(t.id)}">Editar</a></td>
      </tr>`;
    }).join("")||'<tr><td colspan="5">No hay incidencias con estos filtros.</td></tr>';
    $("pagina-info").textContent=`Página ${pagina} de ${totalPaginas} · ${num(filtradas.length)} incidencias`;
    $("btn-anterior").disabled=pagina<=1;
    $("btn-siguiente").disabled=pagina>=totalPaginas;
  }

  async function analizar(){
    estado("Analizando datos…");
    $("tabla-calidad").innerHTML='<tr><td colspan="5">Analizando…</td></tr>';
    try{
      const talleres=await cargarTodos();
      incidencias=talleres.flatMap(analizarTaller);
      rellenarProvincias(talleres);
      actualizarMetricas(talleres);
      filtradas=[...incidencias];
      pagina=1;
      render();
      estado(`Análisis completado: ${num(incidencias.length)} incidencias`,incidencias.length?"ok":"ok");
    }catch(error){
      console.error(error);
      estado("No se pudo completar el análisis","error");
      $("tabla-calidad").innerHTML='<tr><td colspan="5">No se pudieron cargar los datos.</td></tr>';
    }
  }

  $("btn-analizar")?.addEventListener("click",analizar);
  $("buscar")?.addEventListener("input",aplicarFiltros);
  $("filtro-tipo")?.addEventListener("change",aplicarFiltros);
  $("filtro-provincia")?.addEventListener("change",aplicarFiltros);
  $("btn-anterior")?.addEventListener("click",()=>{if(pagina>1){pagina--;render();}});
  $("btn-siguiente")?.addEventListener("click",()=>{if(pagina*PAGE_SIZE<filtradas.length){pagina++;render();}});
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  $("admin-menu")?.addEventListener("click",()=>document.body.classList.toggle("admin-menu-open"));

  proteger().then(ok=>{if(ok)analizar();});
}());