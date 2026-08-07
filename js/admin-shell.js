(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const estado=$("estado-acceso-admin");
  const form=$("form-taller");
  const resultados=$("resultados-talleres");
  const campos=["nombre","telefono","web","direccion","codigo_postal","ciudad","provincia","descripcion"];
  const editables=[...campos,"servicios","horarios"];
  let valoresOriginales={};

  function texto(v){return String(v??"").trim();}
  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
  function mensaje(msg,ok=false){const n=$("estado-ficha");if(!n)return;n.textContent=msg;n.style.color=ok?"#15803d":"#667085";}
  function valor(id){return $(id)?.value.trim()||"";}
  function normalizarUrl(v){v=texto(v);if(!v)return "";return /^https?:\/\//i.test(v)?v:`https://${v}`;}

  async function proteger(){
    if(!supabase){estado.textContent="Sin conexión";return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    estado.textContent="Acceso verificado";
    return true;
  }

  function estadoCampo(id){
    const campo=$(id),c=campo?.closest(".tm-field");
    if(!campo||!c)return;
    c.classList.remove("tm-field-empty","tm-field-dirty","tm-field-ok");
    const actual=campo.value.trim();
    c.classList.add(!actual?"tm-field-empty":actual!==(valoresOriginales[id]??"")?"tm-field-dirty":"tm-field-ok");
  }
  function estados(){editables.forEach(estadoCampo);}

  function cargarFicha(t){
    $("taller-id").value=t.id;
    campos.forEach(c=>$(c).value=t[c]??"");
    $("servicios").value=Array.isArray(t.servicios)?t.servicios.join("\n"):(t.servicios??"");
    $("horarios").value=typeof t.horarios==="string"?t.horarios:JSON.stringify(t.horarios??{},null,2);
    valoresOriginales=Object.fromEntries(editables.map(id=>[id,$(id).value.trim()]));
    form.hidden=false;
    estados();
    mensaje(`Editando: ${t.nombre||"taller"}`,true);
    form.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function pintarResultados(data){
    resultados.innerHTML=(data||[]).map((t,i)=>`<button type="button" class="tm-result" data-i="${i}"><strong>${esc(texto(t.nombre)||"Sin nombre")}</strong><span>${esc(texto(t.telefono))} · ${esc(texto(t.ciudad))} ${esc(texto(t.codigo_postal))}</span></button>`).join("")||'<div class="tm-result">No hay resultados.</div>';
    resultados.querySelectorAll("[data-i]").forEach(btn=>btn.addEventListener("click",()=>{
      resultados.querySelectorAll(".tm-result").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      cargarFicha(data[Number(btn.dataset.i)]);
    }));
  }

  async function buscar(){
    const termino=valor("buscar-taller");
    resultados.innerHTML='<div class="tm-result">Buscando…</div>';
    let q=supabase.from("talleres").select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios").order("nombre").limit(50);
    if(termino){
      const seguro=termino.replace(/[,%().]/g," ").replace(/\s+/g," ").trim().slice(0,80);
      q=q.or(`nombre.ilike.%${seguro}%,telefono.ilike.%${seguro}%,ciudad.ilike.%${seguro}%,codigo_postal.ilike.%${seguro}%,provincia.ilike.%${seguro}%`);
    }
    const {data,error}=await q;
    if(error){pintarResultados([]);mensaje(`Error al consultar: ${error.message}`);return;}
    pintarResultados(data||[]);
    mensaje(`${(data||[]).length} fichas encontradas. Selecciona una para editar.`,true);
  }

  async function cargarPorId(id){
    id=texto(id);if(!id)return false;
    resultados.innerHTML='<div class="tm-result">Abriendo ficha…</div>';
    const {data,error}=await supabase.from("talleres").select("id,nombre,telefono,direccion,codigo_postal,ciudad,provincia,web,descripcion,servicios,horarios").eq("id",id).maybeSingle();
    if(error||!data){pintarResultados([]);mensaje(error?`No se pudo abrir la ficha: ${error.message}`:"No se encontró la ficha solicitada.");return false;}
    $("buscar-taller").value=data.nombre||data.telefono||id;
    pintarResultados([data]);
    resultados.querySelector(".tm-result")?.classList.add("active");
    cargarFicha(data);
    return true;
  }

  function serviciosPayload(){return valor("servicios").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);}
  function horariosPayload(){const v=valor("horarios");if(!v)return {};try{return JSON.parse(v);}catch{return {texto:v};}}
  async function guardar(e){
    e.preventDefault();
    const id=valor("taller-id");if(!id)return;
    const payload={};campos.forEach(c=>payload[c]=valor(c));
    payload.web=normalizarUrl(payload.web);
    payload.servicios=serviciosPayload();
    payload.horarios=horariosPayload();
    mensaje("Guardando cambios…");
    const {error}=await supabase.from("talleres").update(payload).eq("id",id);
    if(error){mensaje(`No se pudo guardar: ${error.message}`);return;}
    valoresOriginales=Object.fromEntries(editables.map(id=>[id,$(id).value.trim()]));
    estados();
    mensaje("Ficha guardada correctamente.",true);
  }

  function buscarGoogle(){
    const q=[valor("nombre"),valor("direccion"),valor("ciudad"),valor("codigo_postal"),valor("telefono")].filter(Boolean).join(" ");
    if(q)window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`,"_blank","noopener,noreferrer");
  }

  editables.forEach(id=>$(id)?.addEventListener("input",()=>estadoCampo(id)));
  $("btn-buscar")?.addEventListener("click",buscar);
  $("buscar-taller")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();buscar();}});
  form?.addEventListener("submit",guardar);
  $("btn-google")?.addEventListener("click",buscarGoogle);
  $("boton-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});

  async function iniciar(){
    if(!await proteger())return;
    const id=new URLSearchParams(location.search).get("id");
    if(id&&await cargarPorId(id))return;
    await buscar();
  }
  iniciar();
}());
