(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const checks=[];

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function add(nombre,ok,detalle,nivel){checks.push({nombre,ok,detalle,nivel:nivel||(ok?"ok":"error")});}

  async function proteger(){
    if(!supabase){add("Cliente Supabase",false,"window.supabaseClient no está disponible.");render();return false;}
    add("Cliente Supabase",true,"Cliente JavaScript cargado correctamente.");
    const {data:{session},error:sessionError}=await supabase.auth.getSession();
    if(sessionError||!session){add("Sesión administrativa",false,sessionError?.message||"No hay una sesión activa.");render();location.replace("admin-login.html");return false;}
    add("Sesión administrativa",true,session.user?.email||"Sesión activa.");
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){add("Permiso de administrador",false,error?.message||"La sesión no tiene permiso administrativo.");render();return false;}
    add("Permiso de administrador",true,"es_administrador() devuelve acceso autorizado.");
    $("admin-usuario").textContent=session.user?.email||"Administrador";
    return true;
  }

  async function comprobarTabla(nombre,etiqueta){
    try{
      const {count,error}=await supabase.from(nombre).select("*",{count:"exact",head:true});
      if(error){add(etiqueta,false,error.message);return;}
      add(etiqueta,true,`${new Intl.NumberFormat("es-ES").format(count||0)} registros accesibles.`);
    }catch(e){add(etiqueta,false,e?.message||String(e));}
  }

  async function comprobarTalleres(){
    try{
      const {data,error}=await supabase.from("talleres").select("id,nombre,ciudad,provincia,created_at").order("created_at",{ascending:false}).limit(1);
      if(error){add("Lectura reciente de talleres",false,error.message);return;}
      const t=data?.[0];
      add("Lectura reciente de talleres",true,t?`${t.nombre||"Sin nombre"} · ${t.ciudad||"—"} · ${t.provincia||"—"}`:"La tabla responde, pero no devolvió filas.",t?"ok":"warn");
    }catch(e){add("Lectura reciente de talleres",false,e?.message||String(e));}
  }

  async function ejecutar(){
    checks.length=0;
    estado("Comprobando…");
    $("lista-comprobaciones").innerHTML='<div class="check"><div><strong>Ejecutando diagnóstico…</strong><small>Consultando servicios.</small></div><span class="chip">En curso</span><div class="detail">—</div></div>';
    const autorizado=await proteger();
    if(!autorizado){estado("Incidencia de acceso","error");return;}
    await Promise.all([
      comprobarTabla("talleres","Tabla talleres"),
      comprobarTabla("registro_actividad","Historial registro_actividad"),
      comprobarTabla("taller_servicios","Relación taller_servicios"),
      comprobarTabla("talleres_servicios","Relación talleres_servicios"),
      comprobarTalleres()
    ]);
    render();
    const incidencias=checks.filter(c=>!c.ok).length;
    estado(incidencias?`${incidencias} incidencia(s) detectada(s)`:"Sistema operativo",incidencias?"error":"ok");
  }

  function render(){
    const lista=$("lista-comprobaciones");
    lista.innerHTML=checks.map(c=>`<div class="check"><div><strong>${esc(c.nombre)}</strong><small>${c.ok?"Comprobación completada":"Requiere revisión"}</small></div><span class="chip ${esc(c.nivel)}">${c.nivel==="warn"?"Aviso":c.ok?"Correcto":"Error"}</span><div class="detail">${esc(c.detalle||"—")}</div></div>`).join("")||'<div class="check"><div><strong>Sin resultados</strong></div><span class="chip warn">Aviso</span><div class="detail">No se pudo completar el diagnóstico.</div></div>';
    const correctas=checks.filter(c=>c.ok).length;
    const incidencias=checks.filter(c=>!c.ok).length;
    $("salud-total").textContent=checks.length;
    $("salud-ok").textContent=correctas;
    $("salud-incidencias").textContent=incidencias;
    $("salud-fecha").textContent=new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"medium"}).format(new Date());
  }

  $("btn-recargar")?.addEventListener("click",ejecutar);
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase?.auth.signOut();location.replace("admin-login.html");});
  ejecutar();
}());