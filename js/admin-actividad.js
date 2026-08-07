(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const PAGE_SIZE=50;
  let registros=[];
  let filtrados=[];
  let pagina=0;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function valor(obj,claves){for(const k of claves){if(obj&&obj[k]!==undefined&&obj[k]!==null&&obj[k]!=="")return obj[k];}return "";}
  function texto(obj){try{return JSON.stringify(obj);}catch{return String(obj||"");}}
  function fechaRegistro(r){return valor(r,["creado_at","created_at","fecha","timestamp","updated_at"]);}
  function accionRegistro(r){return String(valor(r,["accion","action","tipo","operacion","evento"])||"Cambio");}
  function tallerRegistro(r){return valor(r,["taller_id","id_taller","registro_id","entity_id"]);}
  function usuarioRegistro(r){return valor(r,["usuario_id","usuario","user_id","email","origen","actor"]);}
  function origenRegistro(r){return valor(r,["origen","source"]);}

  function datosNuevos(r){
    const v=valor(r,["datos_nuevos","new_data","nuevo","after"]);
    return v&&typeof v==="object"?v:null;
  }
  function datosAnteriores(r){
    const v=valor(r,["datos_anteriores","old_data","anterior","before"]);
    return v&&typeof v==="object"?v:null;
  }
  function camposRegistro(r){
    const v=valor(r,["campos_modificados","campos","fields"]);
    return Array.isArray(v)?v.filter(Boolean):[];
  }

  function resumenEspecial(r){
    const accion=accionRegistro(r).toLowerCase();
    const nuevos=datosNuevos(r)||{};
    const anteriores=datosAnteriores(r)||{};
    const reclamacion=nuevos.reclamacion_id||anteriores.reclamacion_id||"";
    const usuario=nuevos.usuario_id||anteriores.usuario_id||"";

    if(accion==="reclamar_taller"){
      const partes=["Solicitud de reclamación creada"];
      if(nuevos.email)partes.push(`correo: ${nuevos.email}`);
      if(nuevos.relacion)partes.push(`relación: ${nuevos.relacion}`);
      if(reclamacion)partes.push(`solicitud: ${reclamacion}`);
      return partes.join(" · ");
    }
    if(accion==="aprobar_reclamacion"){
      return `Reclamación aprobada${usuario?` · propietario: ${usuario}`:""}${reclamacion?` · solicitud: ${reclamacion}`:""}`;
    }
    if(accion==="rechazar_reclamacion"){
      return `Reclamación rechazada${usuario?` · solicitante: ${usuario}`:""}${reclamacion?` · solicitud: ${reclamacion}`:""}`;
    }
    if(accion==="revocar_reclamacion"){
      return `Acceso de propietario revocado${usuario?` · propietario: ${usuario}`:""}${reclamacion?` · solicitud: ${reclamacion}`:""}`;
    }
    return "";
  }

  function detalleCompacto(r){
    const especial=resumenEspecial(r);
    if(especial)return especial;

    const campos=camposRegistro(r);
    if(campos.length){
      const visibles=campos.slice(0,8).join(", ");
      return `Campos modificados: ${visibles}${campos.length>8?` (+${campos.length-8})`:""}`;
    }

    const accion=accionRegistro(r).toLowerCase();
    if(accion.includes("eliminar")||accion.includes("delete"))return "Taller eliminado. Los datos anteriores quedan disponibles en el detalle técnico.";
    if(accion.includes("crear")||accion.includes("insert")||accion.includes("alta"))return "Registro creado.";
    if(accion.includes("actual")||accion.includes("update")||accion.includes("edit"))return "Registro actualizado.";

    const directo=valor(r,["detalle","detalles","descripcion"]);
    if(directo&&typeof directo!=="object")return String(directo).slice(0,300);
    return "Cambio registrado.";
  }

  function detalleTecnico(r){
    const copia={...r};
    ["id","creado_at","created_at","fecha","timestamp","updated_at","accion","action","tipo","operacion","evento","taller_id","id_taller","registro_id","entity_id","usuario_id","usuario","user_id","email","origen","actor"].forEach(k=>delete copia[k]);
    try{return JSON.stringify(copia,null,2);}catch{return String(copia||"");}
  }

  function formatoFecha(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"medium"}).format(d);}
  function claseAccion(a){const t=String(a).toLowerCase();if(t.includes("delete")||t.includes("borr")||t.includes("elimin")||t.includes("rechaz")||t.includes("revocar"))return "delete";if(t.includes("insert")||t.includes("alta")||t.includes("crear")||t.includes("reclamar")||t.includes("aprobar"))return "insert";if(t.includes("update")||t.includes("actual")||t.includes("edit"))return "update";return "";}

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

  async function consultarActividad(){
    let respuesta=await supabase.from("registro_actividad").select("*").order("creado_at",{ascending:false}).limit(500);
    if(respuesta.error)respuesta=await supabase.from("registro_actividad").select("*").limit(500);
    if(respuesta.error)throw respuesta.error;
    const data=Array.isArray(respuesta.data)?respuesta.data:[];
    data.sort((a,b)=>new Date(fechaRegistro(b)||0)-new Date(fechaRegistro(a)||0));
    return data;
  }

  function cargarTipos(){
    const select=$("act-tipo");
    const actual=select.value;
    select.innerHTML='<option value="">Todas</option>';
    [...new Set(registros.map(accionRegistro).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})).forEach(a=>{
      const o=document.createElement("option");o.value=a;o.textContent=a;select.appendChild(o);
    });
    if([...select.options].some(o=>o.value===actual))select.value=actual;
  }

  function actualizarMetricas(){
    $("act-total").textContent=registros.length.toLocaleString("es-ES");
    const hace24=Date.now()-24*60*60*1000;
    const recientes=registros.filter(r=>{const d=new Date(fechaRegistro(r));return !Number.isNaN(d.getTime())&&d.getTime()>=hace24;}).length;
    $("act-hoy").textContent=recientes.toLocaleString("es-ES");
    const talleres=new Set(registros.map(r=>String(tallerRegistro(r)||"")).filter(Boolean));
    $("act-talleres").textContent=talleres.size.toLocaleString("es-ES");
  }

  function aplicarFiltros(reset=true){
    if(reset)pagina=0;
    const q=$("act-busqueda").value.trim().toLowerCase();
    const tipo=$("act-tipo").value;
    filtrados=registros.filter(r=>{
      if(tipo&&accionRegistro(r)!==tipo)return false;
      if(!q)return true;
      return texto(r).toLowerCase().includes(q);
    });
    render();
  }

  function render(){
    const tbody=$("tabla-actividad");
    const desde=pagina*PAGE_SIZE;
    const lote=filtrados.slice(desde,desde+PAGE_SIZE);
    tbody.innerHTML=lote.length?lote.map(r=>{
      const accion=accionRegistro(r);
      const taller=tallerRegistro(r);
      const usuario=usuarioRegistro(r);
      const origen=origenRegistro(r);
      const resumen=detalleCompacto(r);
      const tecnico=detalleTecnico(r);
      const actor=[usuario,origen&&origen!==usuario?origen:""] .filter(Boolean).join(" · ")||"Sistema / no indicado";
      return `<tr><td>${formatoFecha(fechaRegistro(r))}</td><td><span class="chip ${claseAccion(accion)}">${esc(accion)}</span></td><td>${taller?`<strong>${esc(taller)}</strong>`:"—"}</td><td>${esc(actor)}</td><td><div class="details-summary">${esc(resumen)}</div>${tecnico&&tecnico!=="{}"?`<details class="details-raw"><summary>Ver detalle técnico</summary><pre>${esc(tecnico)}</pre></details>`:""}</td></tr>`;
    }).join(""):'<tr><td colspan="5">No hay registros con estos filtros.</td></tr>';
    const paginas=Math.max(1,Math.ceil(filtrados.length/PAGE_SIZE));
    $("act-info").textContent=`${filtrados.length.toLocaleString("es-ES")} registros · página ${pagina+1} de ${paginas}`;
    $("act-anterior").disabled=pagina<=0;
    $("act-siguiente").disabled=(pagina+1)*PAGE_SIZE>=filtrados.length;
  }

  async function cargar(){
    estado("Cargando actividad…");
    $("tabla-actividad").innerHTML='<tr><td colspan="5">Cargando…</td></tr>';
    try{
      registros=await consultarActividad();
      cargarTipos();
      actualizarMetricas();
      aplicarFiltros(true);
      estado("Actividad actualizada","ok");
    }catch(error){
      console.error("No se pudo cargar registro_actividad:",error);
      registros=[];filtrados=[];actualizarMetricas();render();
      estado(`No se pudo cargar el historial: ${error.message||"error desconocido"}`,"error");
    }
  }

  function enlazar(){
    $("btn-filtrar").addEventListener("click",()=>aplicarFiltros(true));
    $("act-busqueda").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();aplicarFiltros(true);}});
    $("act-tipo").addEventListener("change",()=>aplicarFiltros(true));
    $("act-anterior").addEventListener("click",()=>{if(pagina>0){pagina--;render();}});
    $("act-siguiente").addEventListener("click",()=>{if((pagina+1)*PAGE_SIZE<filtrados.length){pagina++;render();}});
    $("btn-recargar").addEventListener("click",cargar);
    $("btn-cerrar-sesion").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  }

  async function iniciar(){enlazar();if(!await proteger())return;await cargar();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
}());
