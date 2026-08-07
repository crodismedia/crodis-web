(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const PAGE=50;
  const TIMEOUT=8000;
  let pagina=0,total=0;
  const esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const num=v=>new Intl.NumberFormat("es-ES").format(Number(v)||0);
  const limpio=v=>String(v??"").trim();
  function estado(t,tipo=""){const e=$("admin-estado");if(!e)return;e.textContent=t;e.dataset.tipo=tipo;}
  function fecha(v){try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));}catch(_){return "—";}}
  function estrellas(v){const n=Math.max(0,Math.min(5,Number(v)||0));return `${"★".repeat(n)}${"☆".repeat(5-n)}`;}
  function conTimeout(promesa,alternativa){return Promise.race([promesa,new Promise(resolve=>setTimeout(()=>resolve(alternativa),TIMEOUT))]);}

  async function proteger(){
    if(!supabase){estado("Sin conexión con Supabase","error");return false;}
    const sesion=await conTimeout(supabase.auth.getSession(),{data:{session:null},error:new Error("timeout")});
    const session=sesion?.data?.session;
    if(!session){location.replace("admin-login.html");return false;}
    const resp=await conTimeout(supabase.rpc("es_administrador"),{data:false,error:new Error("timeout")});
    if(resp.error||!resp.data){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    $("admin-usuario").textContent=session.user?.email||"Administrador";estado("Acceso verificado","ok");return true;
  }

  async function contar(mutador){let q=supabase.from("valoraciones").select("id",{count:"exact",head:true});q=mutador(q);const {count,error}=await q;if(error)throw error;return count||0;}
  async function puntuacionesPublicadas(){const todas=[];let desde=0;while(desde<100000){const {data,error}=await supabase.from("valoraciones").select("puntuacion").eq("aprobada",true).eq("activa",true).range(desde,desde+999);if(error)throw error;const lote=data||[];todas.push(...lote);if(lote.length<1000)break;desde+=1000;}return todas;}
  async function metricas(){const rs=await Promise.allSettled([contar(q=>q.eq("aprobada",false).eq("activa",true)),contar(q=>q.eq("aprobada",true).eq("activa",true)),contar(q=>q.eq("activa",false)),puntuacionesPublicadas()]);$("val-pendientes").textContent=rs[0].status==="fulfilled"?num(rs[0].value):"—";$("val-publicadas").textContent=rs[1].status==="fulfilled"?num(rs[1].value):"—";$("val-rechazadas").textContent=rs[2].status==="fulfilled"?num(rs[2].value):"—";if(rs[3].status==="fulfilled"&&rs[3].value.length){const a=rs[3].value.reduce((s,r)=>s+(Number(r.puntuacion)||0),0)/rs[3].value.length;$("val-media").textContent=a.toFixed(2).replace(".",",");}else $("val-media").textContent="—";}

  async function idsTalleresPorNombre(termino){if(!termino)return [];const {data,error}=await supabase.from("talleres").select("id").ilike("nombre",`%${termino}%`).limit(50);return error?[]:(data||[]).map(x=>x.id).filter(Boolean);}
  async function aplicarFiltros(q){const est=$("val-estado").value;const puntuacion=$("val-puntuacion").value;const bus=limpio($("val-busqueda").value).replace(/[,%().]/g," ").replace(/\s+/g," ").slice(0,80);if(est==="pendiente")q=q.eq("aprobada",false).eq("activa",true);else if(est==="publicada")q=q.eq("aprobada",true).eq("activa",true);else if(est==="rechazada")q=q.eq("activa",false);if(puntuacion)q=q.eq("puntuacion",Number(puntuacion));if(bus){const ids=await idsTalleresPorNombre(bus);const partes=[`nombre_cliente.ilike.%${bus}%`,`titulo.ilike.%${bus}%`,`comentario.ilike.%${bus}%`];if(ids.length)partes.push(`taller_id.in.(${ids.join(",")})`);q=q.or(partes.join(","));}return q;}

  async function mapaTalleres(datos){
    const ids=[...new Set((datos||[]).map(r=>r.taller_id).filter(Boolean))];
    if(!ids.length)return new Map();
    const respuesta=await conTimeout(supabase.from("talleres").select("id,nombre,slug,ciudad,provincia").in("id",ids),{data:[],error:new Error("timeout")});
    if(respuesta?.error)return new Map();
    return new Map((respuesta.data||[]).map(t=>[String(t.id),t]));
  }
  function etiquetaEstado(r){if(!r.activa)return '<span class="chip bad">Rechazada</span>';if(r.aprobada)return '<span class="chip ok">Publicada</span>';return '<span class="chip warn">Pendiente</span>';}
  function render(datos,talleres){
    const cuerpo=$("tabla-valoraciones");
    cuerpo.innerHTML=(datos||[]).map(r=>{const t=talleres.get(String(r.taller_id))||{};const ficha=t.slug?`<a href="/talleres/${encodeURIComponent(t.slug)}" target="_blank" rel="noopener">Ficha</a>`:"";let acciones="";if(!r.aprobada&&r.activa)acciones=`<button type="button" data-accion="aprobar" data-id="${esc(r.id)}">Aprobar</button><button type="button" data-accion="rechazar" data-id="${esc(r.id)}">Rechazar</button>`;else if(r.aprobada&&r.activa)acciones=`<button type="button" data-accion="rechazar" data-id="${esc(r.id)}">Ocultar</button>`;else acciones=`<button type="button" data-accion="aprobar" data-id="${esc(r.id)}">Publicar</button>`;return `<tr><td><strong>${esc(r.titulo||"Sin título")}</strong><small>${esc(r.nombre_cliente||"Cliente de TallerMap")}</small><div style="max-width:520px;white-space:normal">${esc(r.comentario||"")}</div></td><td><strong>${esc(t.nombre||`Taller ${r.taller_id||"—"}`)}</strong><small>${esc([t.ciudad,t.provincia].filter(Boolean).join(" · "))}</small>${ficha}</td><td><span style="color:#d97706;letter-spacing:1px">${estrellas(r.puntuacion)}</span><small>${Number(r.puntuacion)||0}/5</small></td><td>${etiquetaEstado(r)}</td><td>${esc(fecha(r.created_at))}</td><td><div class="actions">${acciones}</div></td></tr>`;}).join("")||'<tr><td colspan="6">No hay reseñas con estos filtros.</td></tr>';
    cuerpo.querySelectorAll("[data-accion]").forEach(b=>b.addEventListener("click",()=>moderar(b.dataset.id,b.dataset.accion)));
  }

  async function cargar(){
    estado("Cargando reseñas…");
    const cuerpo=$("tabla-valoraciones");
    try{
      let q=supabase.from("valoraciones").select("id,taller_id,nombre_cliente,puntuacion,titulo,comentario,aprobada,activa,created_at",{count:"exact"});
      q=await aplicarFiltros(q);q=q.order("created_at",{ascending:false}).range(pagina*PAGE,pagina*PAGE+PAGE-1);
      const respuesta=await conTimeout(q,{data:null,count:0,error:new Error("Tiempo de espera agotado al cargar reseñas")});
      const {data,count,error}=respuesta||{};
      if(error)throw error;
      total=count||0;
      render(data||[],new Map());
      const talleres=await mapaTalleres(data||[]);
      if(talleres.size)render(data||[],talleres);
      const ini=total?pagina*PAGE+1:0,fin=Math.min((pagina+1)*PAGE,total);$("val-info").textContent=`${num(ini)}–${num(fin)} de ${num(total)}`;$("val-anterior").disabled=pagina===0;$("val-siguiente").disabled=(pagina+1)*PAGE>=total;estado("Reseñas actualizadas","ok");
    }catch(error){console.error("Error cargando valoraciones",error);estado(`Error: ${error?.message||"No se pudieron cargar las reseñas"}`,"error");cuerpo.innerHTML='<tr><td colspan="6">No se pudieron cargar las valoraciones. Pulsa Actualizar para reintentar.</td></tr>';}
  }

  async function moderar(id,accion){if(!id)return;const cambio=accion==="aprobar"?{aprobada:true,activa:true}:{aprobada:false,activa:false};const {error}=await supabase.from("valoraciones").update(cambio).eq("id",id);if(error){estado(`No se pudo actualizar la reseña: ${error.message}`,"error");return;}estado(accion==="aprobar"?"Reseña publicada":"Reseña retirada","ok");await Promise.allSettled([metricas(),cargar()]);}

  $("btn-filtrar")?.addEventListener("click",()=>{pagina=0;cargar();});$("btn-recargar")?.addEventListener("click",()=>Promise.allSettled([metricas(),cargar()]));$("val-busqueda")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();pagina=0;cargar();}});$("val-anterior")?.addEventListener("click",()=>{if(pagina>0){pagina--;cargar();}});$("val-siguiente")?.addEventListener("click",()=>{if((pagina+1)*PAGE<total){pagina++;cargar();}});$("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  (async()=>{if(!await proteger())return;await Promise.allSettled([metricas(),cargar()]);})();
}());