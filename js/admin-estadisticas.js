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
    const filas=[],tam=1000;
    for(let desde=0;;desde+=tam){
      const {data,error}=await supabase.from("talleres").select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,verificado,created_at").range(desde,desde+tam-1);
      if(error)throw error;
      filas.push(...(data||[]));
      if(!data||data.length<tam)break;
    }
    return filas;
  }

  function barras(id,entradas){
    const cont=$(id);if(!cont)return;
    if(!entradas.length){cont.innerHTML='<p class="stats-note">Sin datos.</p>';return;}
    const max=Math.max(...entradas.map(([,v])=>v),1);
    cont.innerHTML=entradas.map(([etiqueta,valor])=>`<div class="stats-row"><small title="${esc(etiqueta)}">${esc(etiqueta)}</small><div class="stats-bar"><i style="width:${Math.max(2,(valor/max)*100)}%"></i></div><strong>${n(valor)}</strong></div>`).join("");
  }

  function mesesUltimos6(talleres){
    const ahora=new Date(),claves=[];
    for(let i=5;i>=0;i--){const d=new Date(ahora.getFullYear(),ahora.getMonth()-i,1);const clave=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;const etiqueta=new Intl.DateTimeFormat("es-ES",{month:"short",year:"numeric"}).format(d);claves.push([clave,etiqueta,0]);}
    const mapa=new Map(claves.map(([k,e])=>[k,{etiqueta:e,valor:0}]));
    talleres.forEach(t=>{if(!t.created_at)return;const d=new Date(t.created_at);if(Number.isNaN(d.getTime()))return;const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(mapa.has(k))mapa.get(k).valor++;});
    return claves.map(([k,e])=>[e,mapa.get(k)?.valor||0]);
  }

  function agrupar(talleres,campo,limite=10){const mapa=new Map();talleres.forEach(t=>{const valor=String(t[campo]||`Sin ${campo}`).trim()||`Sin ${campo}`;mapa.set(valor,(mapa.get(valor)||0)+1);});return [...mapa.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"es")).slice(0,limite);}

  function calidad(talleres){
    const total=talleres.length;const controles=[["Teléfono",t=>!vacio(t.telefono)],["Dirección",t=>!vacio(t.direccion)],["Código postal",t=>!vacio(t.codigo_postal)],["Población",t=>!vacio(t.ciudad)],["Provincia",t=>!vacio(t.provincia)]];
    $("stats-calidad").innerHTML=controles.map(([nombre,fn])=>{const ok=talleres.filter(fn).length;return `<tr><td>${nombre}</td><td class="stats-good"><strong>${n(ok)}</strong> <small>(${pct(ok,total)})</small></td><td class="stats-warn"><strong>${n(total-ok)}</strong></td></tr>`;}).join("");
  }

  async function cargarInteracciones(){
    const dias=Math.max(1,Math.min(Number($("stats-periodo")?.value)||30,365));
    const [resumenRes,rankingRes]=await Promise.all([
      supabase.rpc("admin_resumen_interacciones",{p_dias:dias}),
      supabase.rpc("admin_ranking_interacciones",{p_dias:dias,p_limite:100})
    ]);
    if(resumenRes.error)throw resumenRes.error;if(rankingRes.error)throw rankingRes.error;
    const r=(resumenRes.data||[])[0]||{};
    $("inter-vistas").textContent=n(r.vistas);$("inter-telefono").textContent=n(r.telefono);$("inter-mapa").textContent=n(r.como_llegar);$("inter-whatsapp").textContent=n(r.whatsapp);$("inter-web").textContent=n(r.web);$("inter-talleres").textContent=`${n(r.talleres_con_interaccion)} talleres con actividad`;
    const rows=rankingRes.data||[];
    $("stats-ranking").innerHTML=rows.length?rows.map(x=>{
      const url=x.slug?`/talleres/${encodeURIComponent(x.slug)}`:"";
      const name=url?`<a href="${url}" target="_blank" rel="noopener">${esc(x.nombre||"Taller")}</a>`:esc(x.nombre||"Taller");
      const zona=[x.ciudad,x.provincia].filter(Boolean).join(" · ");
      return `<tr><td><div class="stats-rank-name">${name}</div><div class="stats-muted">${esc(zona)}</div></td><td>${n(x.vistas)}</td><td>${n(x.telefono)}</td><td>${n(x.como_llegar)}</td><td>${n(x.whatsapp)}</td><td>${n(x.web)}</td><td><strong>${n(x.total_interacciones)}</strong></td></tr>`;
    }).join(""):'<tr><td colspan="7">Todavía no hay interacciones registradas en este periodo.</td></tr>';
  }

  async function cargar(){
    estado("Calculando estadísticas…");
    const [talleres]=await Promise.all([cargarTodo(),cargarInteracciones()]);
    const total=talleres.length,verificados=talleres.filter(t=>t.verificado===true).length,completos=talleres.filter(completa).length,limite30=Date.now()-30*24*60*60*1000;
    const altas30=talleres.filter(t=>{const d=new Date(t.created_at);return !Number.isNaN(d.getTime())&&d.getTime()>=limite30;}).length;
    $("stat-total").textContent=n(total);$("stat-verificados").textContent=n(verificados);$("stat-verificados-pct").textContent=`${pct(verificados,total)} del total`;$("stat-completos").textContent=n(completos);$("stat-completos-pct").textContent=`${pct(completos,total)} del total`;$("stat-altas30").textContent=n(altas30);
    barras("stats-meses",mesesUltimos6(talleres));barras("stats-provincias",agrupar(talleres,"provincia",8));barras("stats-municipios",agrupar(talleres,"ciudad",10));calidad(talleres);estado("Estadísticas actualizadas","ok");
  }

  async function iniciar(){try{if(!await proteger())return;await cargar();}catch(error){console.error(error);estado("No se pudieron calcular las estadísticas","error");}}
  $("stats-periodo")?.addEventListener("change",async()=>{try{estado("Actualizando periodo…");await cargarInteracciones();estado("Estadísticas actualizadas","ok");}catch(error){console.error(error);estado("No se pudieron cargar las interacciones","error");}});
  $("btn-recargar")?.addEventListener("click",iniciar);
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  iniciar();
}());