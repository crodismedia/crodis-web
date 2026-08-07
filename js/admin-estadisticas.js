(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const fmt=new Intl.NumberFormat("es-ES");

  function n(v){return fmt.format(Number(v)||0);}
  function pct(a,b){return b?`${((a/b)*100).toFixed(1).replace(".",",")}%`:"0%";}
  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function vacio(v){return v===null||v===undefined||String(v).trim()==="";}
  function completa(t){return !vacio(t.nombre)&&!vacio(t.telefono)&&!vacio(t.direccion)&&!vacio(t.codigo_postal)&&!vacio(t.ciudad)&&!vacio(t.provincia);}

  async function proteger(){
    if(!supabase){estado("Sin conexión con Supabase","error");return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    return true;
  }

  async function cargarTodo(){
    const filas=[];
    const tam=1000;
    for(let desde=0;;desde+=tam){
      const {data,error}=await supabase.from("talleres")
        .select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,verificado,created_at")
        .range(desde,desde+tam-1);
      if(error)throw error;
      filas.push(...(data||[]));
      if(!data||data.length<tam)break;
    }
    return filas;
  }

  function barras(id,entradas){
    const cont=$(id);
    if(!entradas.length){cont.innerHTML='<p class="stats-note">Sin datos.</p>';return;}
    const max=Math.max(...entradas.map(([,v])=>v),1);
    cont.innerHTML=entradas.map(([etiqueta,valor])=>`<div class="stats-row"><small title="${esc(etiqueta)}">${esc(etiqueta)}</small><div class="stats-bar"><i style="width:${Math.max(2,(valor/max)*100)}%"></i></div><strong>${n(valor)}</strong></div>`).join("");
  }

  function mesesUltimos6(talleres){
    const ahora=new Date();
    const claves=[];
    for(let i=5;i>=0;i--){
      const d=new Date(ahora.getFullYear(),ahora.getMonth()-i,1);
      const clave=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const etiqueta=new Intl.DateTimeFormat("es-ES",{month:"short",year:"numeric"}).format(d);
      claves.push([clave,etiqueta,0]);
    }
    const mapa=new Map(claves.map(([k,e])=>[k,{etiqueta:e,valor:0}]));
    talleres.forEach(t=>{
      if(!t.created_at)return;
      const d=new Date(t.created_at);
      if(Number.isNaN(d.getTime()))return;
      const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if(mapa.has(k))mapa.get(k).valor++;
    });
    return claves.map(([k,e])=>[e,mapa.get(k)?.valor||0]);
  }

  function agrupar(talleres,campo,limite=10){
    const mapa=new Map();
    talleres.forEach(t=>{
      const valor=String(t[campo]||`Sin ${campo}`).trim()||`Sin ${campo}`;
      mapa.set(valor,(mapa.get(valor)||0)+1);
    });
    return [...mapa.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"es")).slice(0,limite);
  }

  function calidad(talleres){
    const total=talleres.length;
    const controles=[
      ["Teléfono",t=>!vacio(t.telefono)],
      ["Dirección",t=>!vacio(t.direccion)],
      ["Código postal",t=>!vacio(t.codigo_postal)],
      ["Población",t=>!vacio(t.ciudad)],
      ["Provincia",t=>!vacio(t.provincia)]
    ];
    $("stats-calidad").innerHTML=controles.map(([nombre,fn])=>{
      const ok=talleres.filter(fn).length;
      return `<tr><td>${nombre}</td><td class="stats-good"><strong>${n(ok)}</strong> <small>(${pct(ok,total)})</small></td><td class="stats-warn"><strong>${n(total-ok)}</strong></td></tr>`;
    }).join("");
  }

  async function cargar(){
    estado("Calculando estadísticas…");
    const talleres=await cargarTodo();
    const total=talleres.length;
    const verificados=talleres.filter(t=>t.verificado===true).length;
    const completos=talleres.filter(completa).length;
    const limite30=Date.now()-30*24*60*60*1000;
    const altas30=talleres.filter(t=>{const d=new Date(t.created_at);return !Number.isNaN(d.getTime())&&d.getTime()>=limite30;}).length;

    $("stat-total").textContent=n(total);
    $("stat-verificados").textContent=n(verificados);
    $("stat-verificados-pct").textContent=`${pct(verificados,total)} del total`;
    $("stat-completos").textContent=n(completos);
    $("stat-completos-pct").textContent=`${pct(completos,total)} del total`;
    $("stat-altas30").textContent=n(altas30);

    barras("stats-meses",mesesUltimos6(talleres));
    barras("stats-provincias",agrupar(talleres,"provincia",8));
    barras("stats-municipios",agrupar(talleres,"ciudad",10));
    calidad(talleres);
    estado("Estadísticas actualizadas","ok");
  }

  async function iniciar(){
    try{if(!await proteger())return;await cargar();}
    catch(error){console.error(error);estado("No se pudieron calcular las estadísticas","error");}
  }

  $("btn-recargar")?.addEventListener("click",iniciar);
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  iniciar();
}());