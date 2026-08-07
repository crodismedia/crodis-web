(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const PAGE_SIZE=50;
  let pagina=0;
  let total=0;
  let filas=[];
  let seleccion=new Set();

  function escapar(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function terminoSeguro(v){return String(v||"").replace(/[,%().]/g," ").replace(/\s+/g," ").trim().slice(0,80);}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function slugTaller(t){if(t.slug)return String(t.slug);const base=`${t.nombre||"taller"}-${t.ciudad||""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");return t.id?`${base}-${String(t.id).slice(0,8)}`:base;}

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

  async function cargarProvincias(){
    const {data,error}=await supabase.from("talleres").select("provincia").not("provincia","is",null).limit(5000);
    if(error)return;
    const valores=[...new Set((data||[]).map(x=>String(x.provincia||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    valores.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;$("filtro-provincia").appendChild(o);});
  }

  function construirConsulta(){
    const termino=terminoSeguro($("filtro-busqueda").value);
    const provincia=$("filtro-provincia").value;
    const estadoFiltro=$("filtro-estado").value;
    const calidad=$("filtro-calidad").value;
    let q=supabase.from("talleres").select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,verificado,slug,created_at",{count:"exact"});
    if(termino)q=q.or(`nombre.ilike.%${termino}%,telefono.ilike.%${termino}%,ciudad.ilike.%${termino}%,codigo_postal.ilike.%${termino}%,provincia.ilike.%${termino}%`);
    if(provincia)q=q.eq("provincia",provincia);
    if(estadoFiltro==="verificados")q=q.eq("verificado",true);
    if(estadoFiltro==="no-verificados")q=q.or("verificado.is.false,verificado.is.null");
    if(calidad==="sin-telefono")q=q.or("telefono.is.null,telefono.eq.");
    if(calidad==="sin-direccion")q=q.or("direccion.is.null,direccion.eq.");
    if(calidad==="sin-cp")q=q.or("codigo_postal.is.null,codigo_postal.eq.");
    return q.order("nombre",{ascending:true}).range(pagina*PAGE_SIZE,pagina*PAGE_SIZE+PAGE_SIZE-1);
  }

  function calidadTaller(t){
    const faltan=[];
    if(!String(t.telefono||"").trim())faltan.push("teléfono");
    if(!String(t.direccion||"").trim())faltan.push("dirección");
    if(!String(t.codigo_postal||"").trim())faltan.push("CP");
    return faltan;
  }

  function render(){
    const tbody=$("tabla-talleres");
    if(!filas.length){tbody.innerHTML='<tr><td colspan="8" class="empty">No hay talleres con estos filtros.</td></tr>';}
    else tbody.innerHTML=filas.map(t=>{
      const faltan=calidadTaller(t);
      const slug=slugTaller(t);
      return `<tr>
        <td><input class="fila-check" type="checkbox" data-id="${escapar(t.id)}" ${seleccion.has(String(t.id))?"checked":""}></td>
        <td><strong>${escapar(t.nombre||"Sin nombre")}</strong><small>${escapar(t.codigo_postal||"")}</small></td>
        <td>${escapar(t.ciudad||"—")}<small>${escapar(t.direccion||"Sin dirección")}</small></td>
        <td>${escapar(t.telefono||"—")}</td>
        <td>${escapar(t.provincia||"—")}</td>
        <td>${faltan.length?`<span class="chip warn">Falta ${escapar(faltan.join(", "))}</span>`:'<span class="chip ok">Completa</span>'}</td>
        <td>${t.verificado?'<span class="chip ok">Verificado</span>':'<span class="chip">Publicado</span>'}</td>
        <td><div class="actions"><a href="admin-editor.html">Editar</a><a href="/talleres/${encodeURIComponent(slug)}" target="_blank" rel="noopener">Ver ficha</a><button class="verify" data-toggle="${escapar(t.id)}" data-value="${t.verificado?"false":"true"}">${t.verificado?"Quitar verificación":"Verificar"}</button></div></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll(".fila-check").forEach(c=>c.addEventListener("change",()=>{const id=String(c.dataset.id);c.checked?seleccion.add(id):seleccion.delete(id);actualizarSeleccion();}));
    tbody.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>cambiarVerificacion([b.dataset.toggle],b.dataset.value==="true")));
    $("resultado-info").textContent=`${total.toLocaleString("es-ES")} talleres · página ${pagina+1} de ${Math.max(1,Math.ceil(total/PAGE_SIZE))}`;
    $("btn-anterior").disabled=pagina<=0;
    $("btn-siguiente").disabled=(pagina+1)*PAGE_SIZE>=total;
    $("seleccionar-todos").checked=filas.length>0&&filas.every(t=>seleccion.has(String(t.id)));
    actualizarSeleccion();
  }

  function actualizarSeleccion(){
    $("seleccion-info").textContent=`${seleccion.size} seleccionado${seleccion.size===1?"":"s"}`;
    $("btn-verificar-seleccion").disabled=!seleccion.size;
    $("btn-desverificar-seleccion").disabled=!seleccion.size;
  }

  async function buscar(reset=false){
    if(reset)pagina=0;
    estado("Cargando talleres…");
    $("tabla-talleres").innerHTML='<tr><td colspan="8">Cargando…</td></tr>';
    const {data,error,count}=await construirConsulta();
    if(error){estado(`Error: ${error.message}`,"error");filas=[];total=0;render();return;}
    filas=Array.isArray(data)?data:[];
    total=Number(count)||0;
    estado("Datos actualizados","ok");
    render();
  }

  async function cambiarVerificacion(ids,valor){
    if(!ids.length)return;
    estado("Guardando cambios…");
    const {error}=await supabase.from("talleres").update({verificado:valor}).in("id",ids);
    if(error){estado(`No se pudo actualizar: ${error.message}`,"error");return;}
    seleccion.clear();
    estado("Cambios guardados","ok");
    await buscar(false);
  }

  function enlazar(){
    $("btn-buscar-talleres").addEventListener("click",()=>buscar(true));
    $("filtro-busqueda").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();buscar(true);}});
    ["filtro-provincia","filtro-estado","filtro-calidad"].forEach(id=>$(id).addEventListener("change",()=>buscar(true)));
    $("btn-anterior").addEventListener("click",()=>{if(pagina>0){pagina--;buscar(false);}});
    $("btn-siguiente").addEventListener("click",()=>{if((pagina+1)*PAGE_SIZE<total){pagina++;buscar(false);}});
    $("seleccionar-todos").addEventListener("change",e=>{filas.forEach(t=>{const id=String(t.id);e.target.checked?seleccion.add(id):seleccion.delete(id);});render();});
    $("btn-verificar-seleccion").addEventListener("click",()=>cambiarVerificacion([...seleccion],true));
    $("btn-desverificar-seleccion").addEventListener("click",()=>cambiarVerificacion([...seleccion],false));
    $("btn-cerrar-sesion").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  }

  async function iniciar(){
    enlazar();
    if(!await proteger())return;
    await cargarProvincias();
    await buscar(true);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
}());
