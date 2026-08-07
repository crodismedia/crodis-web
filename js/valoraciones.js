(function(){
  "use strict";
  const SUPABASE_URL="https://cnyptelvbsndpkzbrete.supabase.co";
  const SUPABASE_KEY="sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
  const cliente=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
  const $=(id)=>document.getElementById(id);
  let taller=null;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function fecha(v){try{return new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v));}catch(_){return "";}}
  function estrellas(n){const p=Math.max(0,Math.min(5,Number(n)||0));return "★".repeat(p)+"☆".repeat(5-p);}
  function estado(texto,tipo=""){const el=$("valoraciones-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}
  function slugRuta(){const pref="/talleres/";if(location.pathname.startsWith(pref))return decodeURIComponent(location.pathname.slice(pref.length).split("/")[0]||"");return new URLSearchParams(location.search).get("slug")||"";}
  function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));}

  async function obtenerTaller(){
    if(!cliente)return null;
    const params=new URLSearchParams(location.search);
    const id=params.get("id")||"";
    const slug=slugRuta();
    const {data,error}=await cliente.rpc("obtener_taller_publico",{p_id:uuid(id)?id:null,p_slug:slug||null});
    if(error||!Array.isArray(data)||!data.length)return null;
    return data[0];
  }

  async function cargar(){
    if(!cliente||!taller?.id)return;
    const {data,error}=await cliente.from("valoraciones")
      .select("id,nombre_cliente,puntuacion,titulo,comentario,created_at")
      .eq("taller_id",taller.id).eq("aprobada",true).eq("activa",true)
      .order("created_at",{ascending:false}).limit(50);
    const lista=$("valoraciones-lista");
    if(error){
      lista.innerHTML='<p class="valoraciones-vacio">Las reseñas no están disponibles temporalmente.</p>';
      $("valoraciones-resumen").hidden=true;
      return;
    }
    const filas=Array.isArray(data)?data:[];
    const media=filas.length?filas.reduce((s,r)=>s+(Number(r.puntuacion)||0),0)/filas.length:0;
    $("valoraciones-media").textContent=filas.length?media.toFixed(1).replace(".",","):"—";
    $("valoraciones-estrellas").textContent=filas.length?estrellas(Math.round(media)):"☆☆☆☆☆";
    $("valoraciones-total").textContent=`${filas.length} ${filas.length===1?"reseña":"reseñas"}`;
    $("valoraciones-resumen").hidden=false;
    lista.innerHTML=filas.map(r=>`<article class="valoracion-card">
      <div class="valoracion-meta"><span class="valoracion-estrellas" aria-label="${Number(r.puntuacion)||0} de 5 estrellas">${estrellas(r.puntuacion)}</span><span>${esc(fecha(r.created_at))}</span></div>
      ${r.titulo?`<h3>${esc(r.titulo)}</h3>`:""}
      <strong>${esc(r.nombre_cliente||"Cliente de TallerMap")}</strong>
      <p>${esc(r.comentario||"")}</p>
    </article>`).join("")||'<p class="valoraciones-vacio">Este taller todavía no tiene reseñas publicadas. Puedes ser la primera persona en valorarlo.</p>';
  }

  async function enviar(e){
    e.preventDefault();
    if(!cliente||!taller?.id){estado("No se ha podido identificar el taller.","error");return;}
    const form=e.currentTarget;
    if(form.elements.empresa?.value){estado("No se pudo enviar la reseña.","error");return;}
    const puntuacion=Number(new FormData(form).get("puntuacion"));
    const nombre=String(form.elements.nombre_cliente.value||"").trim().slice(0,80);
    const titulo=String(form.elements.titulo.value||"").trim().slice(0,120);
    const comentario=String(form.elements.comentario.value||"").trim().slice(0,1500);
    if(!Number.isInteger(puntuacion)||puntuacion<1||puntuacion>5){estado("Selecciona una valoración de 1 a 5 estrellas.","error");return;}
    if(comentario.length<20){estado("Escribe al menos 20 caracteres sobre tu experiencia.","error");return;}
    const clave=`tm-review-${taller.id}`;
    const ultima=Number(localStorage.getItem(clave)||0);
    if(Date.now()-ultima<60000){estado("Espera un minuto antes de enviar otra reseña.","error");return;}
    estado("Enviando reseña…");
    const {error}=await cliente.from("valoraciones").insert({
      taller_id:taller.id,
      nombre_cliente:nombre||null,
      puntuacion,
      titulo:titulo||null,
      comentario,
      aprobada:false,
      activa:true
    });
    if(error){
      console.error("No se pudo enviar la valoración:",error);
      estado("No se pudo enviar la reseña. El sistema de moderación todavía puede requerir configuración.","error");
      return;
    }
    localStorage.setItem(clave,String(Date.now()));
    form.reset();
    estado("Reseña recibida. Se publicará después de la revisión administrativa.","ok");
    $("valoracion-pendiente").hidden=false;
  }

  async function iniciar(){
    if(!$("valoraciones-seccion"))return;
    taller=await obtenerTaller();
    if(!taller?.id){$("valoraciones-seccion").hidden=true;return;}
    $("valoraciones-taller-nombre").textContent=taller.nombre||"este taller";
    $("form-valoracion")?.addEventListener("submit",enviar);
    await cargar();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar);else iniciar();
}());