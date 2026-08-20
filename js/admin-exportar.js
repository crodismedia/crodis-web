(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const PAGE=1000;
  let cache=[];

  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function progreso(texto,tipo=""){const el=$("exp-progreso");if(!el)return;el.textContent=texto;el.className=`progress ${tipo}`.trim();}
  function num(v){return new Intl.NumberFormat("es-ES").format(Number(v)||0);}
  function limpio(v){return String(v??"").trim();}
  function incompleto(t){return !limpio(t.telefono)||!limpio(t.direccion)||!limpio(t.codigo_postal)||!limpio(t.ciudad)||!limpio(t.provincia);}

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

  async function cargarTodo(){
    if(cache.length)return cache;
    progreso("Cargando talleres…");
    const filas=[];
    for(let desde=0;;desde+=PAGE){
      const {data,error}=await supabase.from("talleres")
        .select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,verificado,servicios,horarios,created_at")
        .order("id",{ascending:true})
        .range(desde,desde+PAGE-1);
      if(error)throw error;
      const lote=data||[];
      filas.push(...lote);
      progreso(`Cargando talleres… ${num(filas.length)}`);
      if(lote.length<PAGE)break;
    }
    cache=filas;
    return cache;
  }

  function filtrar(datos){
    const provincia=$("exp-provincia").value;
    const estadoFiltro=$("exp-estado").value;
    const calidad=$("exp-calidad").value;
    return datos.filter(t=>{
      if(provincia&&limpio(t.provincia)!==provincia)return false;
      if(estadoFiltro==="verificados"&&!t.verificado)return false;
      if(estadoFiltro==="no-verificados"&&t.verificado)return false;
      if(calidad==="completas"&&incompleto(t))return false;
      if(calidad==="incompletas"&&!incompleto(t))return false;
      return true;
    });
  }

  function resumen(datos){
    $("exp-total").textContent=num(datos.length);
    $("exp-verificados").textContent=num(datos.filter(t=>t.verificado).length);
    $("exp-incompletos").textContent=num(datos.filter(incompleto).length);
    $("exp-provincias").textContent=num(new Set(datos.map(t=>limpio(t.provincia)).filter(Boolean)).size);
  }

  async function provincias(){
    const datos=await cargarTodo();
    const valores=[...new Set(datos.map(t=>limpio(t.provincia)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    const select=$("exp-provincia");
    valores.forEach(p=>select.appendChild(new Option(p,p)));
  }

  async function calcular(){
    try{
      const datos=filtrar(await cargarTodo());
      resumen(datos);
      progreso(`Selección preparada: ${num(datos.length)} talleres.`,`ok`);
      return datos;
    }catch(error){
      console.error(error);
      progreso("No se pudo preparar la selección.","error");
      estado("Error al leer talleres","error");
      return [];
    }
  }

  function valorCSV(v){
    let s=v;
    if(Array.isArray(s)||s&&typeof s==="object")s=JSON.stringify(s);
    s=String(s??"").replace(/\r?\n/g," ");
    return `"${s.replace(/"/g,'""')}"`;
  }

  async function exportar(){
    const btn=$("btn-exportar");
    btn.disabled=true;
    try{
      const datos=await calcular();
      if(!datos.length){progreso("La selección no contiene talleres.","error");return;}
      const cabeceras=["id","nombre","telefono","direccion","codigo_postal","ciudad","provincia","web","verificado","servicios","horarios","created_at"];
      const lineas=[cabeceras.join(";")];
      datos.forEach(t=>lineas.push(cabeceras.map(c=>valorCSV(t[c])).join(";")));
      const blob=new Blob(["\uFEFF"+lineas.join("\r\n")],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      const fecha=new Date().toISOString().slice(0,10);
      a.href=url;
      a.download=`tallermap-talleres-${fecha}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      progreso(`CSV generado con ${num(datos.length)} talleres.`,`ok`);
    }finally{btn.disabled=false;}
  }

  $("btn-contar")?.addEventListener("click",calcular);
  $("btn-exportar")?.addEventListener("click",exportar);
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  ["exp-provincia","exp-estado","exp-calidad"].forEach(id=>$(id)?.addEventListener("change",()=>{resumen([]);progreso("Filtros modificados. Pulsa “Calcular selección”.");}));

  (async()=>{
    if(!await proteger())return;
    try{await provincias();await calcular();estado("Exportaciones preparadas","ok");}
    catch(error){console.error(error);estado("No se pudo cargar la exportación","error");progreso("Error al cargar datos.","error");}
  })();
}());
