(function(){
  "use strict";
  const supabase=window.supabaseClient;
  const $=(id)=>document.getElementById(id);
  const LOTE_SEGURO=100;
  let filas=[];
  let procesandoLote=false;
  let detenerSolicitado=false;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function txt(v){return String(v??"").trim();}
  function digitos(v){return txt(v).replace(/\D/g,"");}
  function normalizar(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function esperar(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function provinciaPorCp(cp){
    const p=digitos(cp).slice(0,2);
    if(p==="03")return "Alicante";
    if(p==="12")return "Castellón";
    if(p==="46")return "Valencia";
    return "";
  }
  function provinciaCanonica(v){
    const p=normalizar(v);
    if(p==="alicante"||p==="alacant")return "Alicante";
    if(p==="castellon"||p==="castello"||p==="castellon/castello"||p==="castello/castellon")return "Castellón";
    if(p==="valencia"||p==="valencia/valencia")return "Valencia";
    return "";
  }

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
        .select("id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,verificado")
        .order("id",{ascending:true})
        .range(desde,desde+lote-1);
      if(error)throw error;
      todos.push(...(data||[]));
      if(!data||data.length<lote)break;
    }
    return todos;
  }

  function propuestaSegura(t){
    const cambios={};
    const textos=[];
    const cp=digitos(t.codigo_postal);
    const provinciaCp=cp.length===5?provinciaPorCp(cp):"";
    const provinciaActual=provinciaCanonica(t.provincia);

    if(!txt(t.provincia)&&provinciaCp){
      cambios.provincia=provinciaCp;
      textos.push(`Provincia: ${provinciaCp} (por CP ${cp})`);
    }else if(provinciaCp&&provinciaActual&&provinciaCp!==provinciaActual){
      textos.push(`Revisar provincia: el CP ${cp} corresponde a ${provinciaCp}`);
    }

    const tel=digitos(t.telefono);
    if(txt(t.telefono)&&tel.length===9&&txt(t.telefono)!==tel){
      cambios.telefono=tel;
      textos.push(`Normalizar teléfono: ${tel}`);
    }

    const web=txt(t.web);
    if(web&&!/^https?:\/\//i.test(web)&&web.includes(".")&&!/\s/.test(web)){
      cambios.web=`https://${web}`;
      textos.push(`Normalizar web: https://${web}`);
    }

    return {cambios,textos,aplicable:Object.keys(cambios).length>0};
  }

  function evaluar(t){
    const campos=[
      ["nombre",txt(t.nombre)],
      ["dirección",txt(t.direccion)],
      ["código postal",txt(t.codigo_postal)],
      ["población",txt(t.ciudad)],
      ["provincia",txt(t.provincia)],
      ["teléfono",txt(t.telefono)],
      ["web",txt(t.web)]
    ];
    const completos=campos.filter(([,v])=>Boolean(v)).length;
    const porcentaje=Math.round((completos/campos.length)*100);
    const faltan=campos.filter(([,v])=>!v).map(([k])=>k);
    const propuesta=propuestaSegura(t);
    return {...t,porcentaje,faltan,sugerencias:propuesta.textos,cambiosSeguros:propuesta.cambios,aplicable:propuesta.aplicable,prioridad:porcentaje<60?"alta":porcentaje<85?"media":"baja"};
  }

  function metricas(talleres){
    $("auto-total").textContent=talleres.length.toLocaleString("es-ES");
    $("auto-incompletos").textContent=filas.length.toLocaleString("es-ES");
    $("auto-alta").textContent=filas.filter(f=>f.prioridad==="alta").length.toLocaleString("es-ES");
    $("auto-sugerencias").textContent=filas.filter(f=>f.aplicable).length.toLocaleString("es-ES");
  }

  async function leerFichaActual(id){
    const {data,error}=await supabase.from("talleres")
      .select("id,nombre,telefono,web,direccion,codigo_postal,ciudad,provincia,verificado")
      .eq("id",id)
      .maybeSingle();
    if(error)throw error;
    return data;
  }

  async function aplicarCambiosSeguros(id,cambios){
    const {error}=await supabase.rpc("aplicar_autocompletado_seguro_admin",{
      p_taller_id:id,
      p_cambios:cambios
    });
    if(error)throw error;
  }

  async function procesarFichaSegura(id){
    const actual=await leerFichaActual(id);
    if(!actual)return {estado:"omitida",motivo:"ficha no encontrada"};
    const propuesta=propuestaSegura(actual);
    if(!propuesta.aplicable)return {estado:"omitida",motivo:"sin cambios seguros pendientes"};
    await aplicarCambiosSeguros(id,propuesta.cambios);
    return {estado:"actualizada",cambios:propuesta.cambios};
  }

  async function aplicarSeguras(id,boton){
    if(procesandoLote||boton?.disabled)return;
    boton.disabled=true;
    $("admin-estado").textContent="Verificando ficha antes de aplicar…";
    try{
      const actual=await leerFichaActual(id);
      if(!actual)throw new Error("La ficha ya no existe");
      const propuesta=propuestaSegura(actual);
      if(!propuesta.aplicable){
        alert("La ficha ya no tiene cambios automáticos seguros pendientes.");
        await cargar();
        return;
      }
      const resumen=Object.entries(propuesta.cambios).map(([campo,valor])=>`${campo}: ${valor}`).join("\n");
      if(!confirm(`Se aplicarán únicamente estos cambios seguros:\n\n${resumen}\n\n¿Continuar?`)){
        $("admin-estado").textContent="Aplicación cancelada";
        boton.disabled=false;
        return;
      }
      await aplicarCambiosSeguros(id,propuesta.cambios);
      $("admin-estado").textContent="Sugerencias seguras aplicadas";
      await cargar();
    }catch(error){
      console.error(error);
      $("admin-estado").textContent=`Error: ${error.message||"no se pudo actualizar"}`;
      if(boton)boton.disabled=false;
    }
  }

  function bloquearControlesLote(activo){
    procesandoLote=activo;
    ["btn-recargar","btn-lote-100","btn-lote-todas","auto-filtro"].forEach(id=>{const el=$(id);if(el)el.disabled=activo;});
    const detener=$("btn-detener-lote");
    if(detener)detener.hidden=!activo;
    document.querySelectorAll("[data-aplicar]").forEach(b=>{b.disabled=activo;});
  }

  async function procesarLote({todas=false}={}){
    if(procesandoLote)return;
    const aplicables=filas.filter(f=>f.aplicable);
    const objetivo=todas?aplicables:aplicables.slice(0,LOTE_SEGURO);
    if(!objetivo.length){alert("No hay fichas con cambios automáticos seguros pendientes.");return;}

    const texto=todas
      ? `Se procesarán ${objetivo.length.toLocaleString("es-ES")} fichas aplicables en bloques internos de ${LOTE_SEGURO}.`
      : `Se procesarán hasta ${objetivo.length.toLocaleString("es-ES")} fichas con cambios seguros.`;
    if(!confirm(`${texto}\n\nCada ficha se volverá a leer antes de escribir. El proceso se detendrá al primer error.\n\n¿Continuar?`))return;

    detenerSolicitado=false;
    bloquearControlesLote(true);
    const resumen={procesadas:0,actualizadas:0,omitidas:0,errores:0,detenida:false,error:""};

    try{
      for(let i=0;i<objetivo.length;i++){
        if(detenerSolicitado){resumen.detenida=true;break;}
        const ficha=objetivo[i];
        $("admin-estado").textContent=`Procesando ${i+1} de ${objetivo.length.toLocaleString("es-ES")} · actualizadas ${resumen.actualizadas} · omitidas ${resumen.omitidas}`;
        try{
          const resultado=await procesarFichaSegura(ficha.id);
          resumen.procesadas+=1;
          if(resultado.estado==="actualizada")resumen.actualizadas+=1;
          else resumen.omitidas+=1;
        }catch(error){
          console.error("Error en lote de autocompletado",ficha.id,error);
          resumen.procesadas+=1;
          resumen.errores+=1;
          resumen.error=error.message||"error desconocido";
          break;
        }
        if((i+1)%LOTE_SEGURO===0&&i+1<objetivo.length)await esperar(350);
      }
    }finally{
      bloquearControlesLote(false);
      await cargar();
    }

    const partes=[
      `${resumen.procesadas.toLocaleString("es-ES")} procesadas`,
      `${resumen.actualizadas.toLocaleString("es-ES")} actualizadas`,
      `${resumen.omitidas.toLocaleString("es-ES")} omitidas`,
      `${resumen.errores.toLocaleString("es-ES")} errores`
    ];
    if(resumen.detenida)partes.push("proceso detenido por el administrador");
    if(resumen.error)partes.push(`último error: ${resumen.error}`);
    alert(`Resultado del lote:\n\n${partes.join("\n")}`);
  }

  function render(){
    const filtro=$("auto-filtro").value;
    let lista=filas;
    if(filtro==="alta")lista=lista.filter(f=>f.prioridad==="alta");
    if(filtro==="sugerencia")lista=lista.filter(f=>f.aplicable);
    const body=$("auto-tabla");
    body.innerHTML=lista.slice(0,250).map(t=>{
      const ubic=[t.ciudad,t.provincia,t.codigo_postal].filter(Boolean).join(" · ")||"—";
      const faltan=t.faltan.length?t.faltan.join(", "):"—";
      const sugerencia=t.sugerencias.length?t.sugerencias.join(" · "):"Sin sugerencia automática segura";
      const clase=t.prioridad==="alta"?"bad":t.prioridad==="media"?"warn":"ok";
      const aplicar=t.aplicable?`<button class="admin-btn primary" type="button" data-aplicar="${esc(t.id)}">Aplicar seguras</button>`:"";
      return `<tr><td><strong>${esc(t.nombre||"Sin nombre")}</strong><br><small>${esc(t.id)}</small></td><td>${esc(ubic)}</td><td><span class="admin-badge ${clase}">${t.porcentaje}%</span></td><td>${esc(faltan)}</td><td>${esc(sugerencia)}</td><td><div class="admin-row-actions">${aplicar}<a class="admin-btn" href="admin-editor.html?id=${encodeURIComponent(t.id)}">Revisar</a></div></td></tr>`;
    }).join("")||'<tr><td colspan="6">No hay fichas con este filtro.</td></tr>';
    body.querySelectorAll("[data-aplicar]").forEach(b=>b.addEventListener("click",()=>aplicarSeguras(b.dataset.aplicar,b)));
    if(procesandoLote)document.querySelectorAll("[data-aplicar]").forEach(b=>{b.disabled=true;});
    if(lista.length>250&&!procesandoLote)$("admin-estado").textContent=`Mostrando 250 de ${lista.length.toLocaleString("es-ES")} fichas`;
  }

  async function cargar(){
    if(procesandoLote)return;
    $("admin-estado").textContent="Analizando fichas…";
    $("auto-tabla").innerHTML='<tr><td colspan="6">Analizando…</td></tr>';
    try{
      const talleres=await cargarTodos();
      filas=talleres.map(evaluar).filter(t=>t.faltan.length>0||t.aplicable).sort((a,b)=>a.porcentaje-b.porcentaje||String(a.nombre||"").localeCompare(String(b.nombre||""),"es"));
      metricas(talleres);
      render();
      $("admin-estado").textContent=`Análisis completado: ${filas.length.toLocaleString("es-ES")} pendientes`;
    }catch(error){
      console.error(error);
      $("admin-estado").textContent=`Error: ${error.message||"no se pudo analizar"}`;
      $("auto-tabla").innerHTML='<tr><td colspan="6">No se pudieron cargar las fichas.</td></tr>';
    }
  }

  $("btn-recargar")?.addEventListener("click",cargar);
  $("auto-filtro")?.addEventListener("change",render);
  $("btn-lote-100")?.addEventListener("click",()=>procesarLote({todas:false}));
  $("btn-lote-todas")?.addEventListener("click",()=>procesarLote({todas:true}));
  $("btn-detener-lote")?.addEventListener("click",()=>{detenerSolicitado=true;$("admin-estado").textContent="Deteniendo al terminar la ficha actual…";});
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{if(procesandoLote)return;await supabase.auth.signOut();location.replace("admin-login.html");});
  proteger().then(ok=>{if(ok)cargar();});
}());
