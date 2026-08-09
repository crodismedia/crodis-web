(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const escape=(v)=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const fecha=(v)=>{if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short"}).format(d);};
  let cargando=false;
  let procesando=false;

  function estado(texto,tipo=""){
    const el=$("admin-estado");
    if(!el)return;
    el.textContent=texto;
    el.dataset.tipo=tipo;
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

  async function contar(estadoSolicitud){
    let consulta=supabase.from("solicitudes_alta_taller").select("id",{count:"exact",head:true});
    if(estadoSolicitud)consulta=consulta.eq("estado",estadoSolicitud);
    const {count,error}=await consulta;
    if(error)throw error;
    return count||0;
  }

  async function cargarMetricas(){
    const resultados=await Promise.allSettled([contar("pendiente"),contar("aprobada"),contar("rechazada"),contar("")]);
    const ids=["solicitudes-pendientes","solicitudes-aprobadas","solicitudes-rechazadas","solicitudes-total"];
    resultados.forEach((resultado,indice)=>{$(ids[indice]).textContent=resultado.status==="fulfilled"?resultado.value.toLocaleString("es-ES"):"—";});
  }

  function etiquetaEstado(valor){
    const clase=valor==="aprobada"?"ok":valor==="pendiente"?"warn":"danger";
    return `<span class="admin-chip ${clase}">${escape(valor)}</span>`;
  }

  function nombresServicios(servicios){
    if(!Array.isArray(servicios)||!servicios.length)return "Sin servicios";
    return servicios.map(v=>String(v).replace(/-/g," ")).join(", ");
  }

  function acciones(solicitud){
    if(solicitud.estado!=="pendiente")return "—";
    return `<div class="admin-row-actions"><button class="admin-btn primary" data-aprobar="${solicitud.id}" type="button">Aprobar</button><button class="admin-btn danger" data-rechazar="${solicitud.id}" type="button">Rechazar</button></div>`;
  }

  function render(filas){
    const cuerpo=$("solicitudes-tabla");
    if(!filas.length){cuerpo.innerHTML='<tr><td colspan="7">No hay solicitudes con este filtro.</td></tr>';return;}
    cuerpo.innerHTML=filas.map(s=>`<tr>
      <td><strong>${escape(s.nombre_taller||"Sin nombre")}</strong><small>${escape(s.web||`Solicitud #${s.id}`)}</small></td>
      <td>${escape(s.telefono||"—")}</td>
      <td>${escape(s.ciudad||"—")}<small>${escape([s.direccion,s.codigo_postal,s.provincia].filter(Boolean).join(" · "))}</small></td>
      <td class="admin-description"><strong>${escape(nombresServicios(s.servicios))}</strong><small>${escape(s.descripcion||"Sin descripción")}</small></td>
      <td>${etiquetaEstado(s.estado)}</td>
      <td>${escape(fecha(s.created_at))}</td>
      <td>${acciones(s)}</td>
    </tr>`).join("");
    cuerpo.querySelectorAll("[data-aprobar]").forEach(b=>b.addEventListener("click",()=>resolver(b.dataset.aprobar,true)));
    cuerpo.querySelectorAll("[data-rechazar]").forEach(b=>b.addEventListener("click",()=>resolver(b.dataset.rechazar,false)));
  }

  async function cargar(){
    if(cargando)return;
    cargando=true;
    $("solicitudes-tabla").innerHTML='<tr><td colspan="7">Cargando…</td></tr>';
    let consulta=supabase.from("solicitudes_alta_taller")
      .select("id,nombre_taller,telefono,web,direccion,codigo_postal,ciudad,provincia,servicios,descripcion,estado,created_at,revisada_at")
      .order("created_at",{ascending:false})
      .limit(200);
    const filtro=$("solicitudes-filtro").value;
    if(filtro!=="todas")consulta=consulta.eq("estado",filtro);
    const {data,error}=await consulta;
    cargando=false;
    if(error){$("solicitudes-tabla").innerHTML=`<tr><td colspan="7">Error: ${escape(error.message)}</td></tr>`;estado("No se pudieron cargar las solicitudes","error");return;}
    render(data||[]);
    estado("Solicitudes actualizadas","ok");
  }

  async function resolver(id,aprobar){
    if(procesando)return;
    const accion=aprobar?"aprobar esta solicitud y publicar una ficha no verificada":"rechazar esta solicitud sin publicar el taller";
    if(!window.confirm(`¿Quieres ${accion}?`))return;
    procesando=true;
    document.querySelectorAll("[data-aprobar],[data-rechazar]").forEach(b=>{b.disabled=true;});
    estado(aprobar?"Aprobando y publicando…":"Rechazando solicitud…");
    const funcion=aprobar?"aprobar_solicitud":"rechazar_solicitud";
    const {error}=await supabase.rpc(funcion,{p_solicitud_id:id});
    procesando=false;
    if(error){
      document.querySelectorAll("[data-aprobar],[data-rechazar]").forEach(b=>{b.disabled=false;});
      estado(`Error: ${error.message}`,"error");
      return;
    }
    estado(aprobar?"Solicitud aprobada y ficha publicada":"Solicitud rechazada","ok");
    await Promise.all([cargarMetricas(),cargar()]);
  }

  $("btn-recargar")?.addEventListener("click",()=>Promise.all([cargarMetricas(),cargar()]));
  $("solicitudes-filtro")?.addEventListener("change",cargar);
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});

  proteger().then(ok=>{if(ok)Promise.all([cargarMetricas(),cargar()]);});
}());
