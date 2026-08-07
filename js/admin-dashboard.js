(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;

  function esc(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
  function num(v){return new Intl.NumberFormat("es-ES").format(Number(v)||0);}
  function fecha(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"}).format(d);}
  function estado(texto,tipo=""){const el=$("admin-estado");if(!el)return;el.textContent=texto;el.dataset.tipo=tipo;}

  async function proteger(){
    if(!supabase){estado("Sin conexión con Supabase","error");return false;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){location.replace("admin-login.html");return false;}
    const {data:admin,error}=await supabase.rpc("es_administrador");
    if(error||!admin){await supabase.auth.signOut();location.replace("admin-login.html");return false;}
    const email=session.user?.email||"Administrador";
    $("admin-usuario").textContent=email;
    estado("Acceso verificado","ok");
    return true;
  }

  async function contar(query){
    const {count,error}=await query;
    if(error)throw error;
    return count||0;
  }

  async function cargarMetricas(){
    const resultados=await Promise.allSettled([
      contar(supabase.from("talleres").select("id",{count:"exact",head:true})),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).eq("verificado",true)),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("telefono.is.null,telefono.eq.")),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("direccion.is.null,direccion.eq.")),
      contar(supabase.from("talleres").select("id",{count:"exact",head:true}).or("codigo_postal.is.null,codigo_postal.eq."))
    ]);
    const valores=resultados.map(r=>r.status==="fulfilled"?r.value:null);
    [["metrica-total",valores[0]],["metrica-verificados",valores[1]],["metrica-sin-telefono",valores[2]],["metrica-sin-direccion",valores[3]],["metrica-sin-cp",valores[4]]].forEach(([id,v])=>{$(id).textContent=v===null?"—":num(v);});
  }

  async function cargarProvincias(){
    const {data,error}=await supabase.from("talleres").select("provincia");
    if(error){$("lista-provincias").innerHTML='<p class="admin-vacio">No se pudo cargar el reparto provincial.</p>';return;}
    const mapa=new Map();
    (data||[]).forEach(t=>{const p=String(t.provincia||"Sin provincia").trim()||"Sin provincia";mapa.set(p,(mapa.get(p)||0)+1);});
    const filas=[...mapa.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
    $("lista-provincias").innerHTML=filas.map(([p,n])=>`<div class="admin-provincia"><span>${esc(p)}</span><strong>${num(n)}</strong></div>`).join("")||'<p class="admin-vacio">Sin datos.</p>';
  }

  async function cargarRecientes(){
    const cuerpo=$("tabla-recientes");
    cuerpo.innerHTML='<tr><td colspan="6">Cargando…</td></tr>';
    const {data,error}=await supabase.from("talleres")
      .select("id,nombre,ciudad,provincia,telefono,verificado,created_at")
      .order("created_at",{ascending:false})
      .limit(10);
    if(error){cuerpo.innerHTML='<tr><td colspan="6">No se pudieron cargar los talleres recientes.</td></tr>';return;}
    cuerpo.innerHTML=(data||[]).map(t=>`<tr>
      <td><strong>${esc(t.nombre||"Sin nombre")}</strong><small>${esc(t.id||"")}</small></td>
      <td>${esc(t.ciudad||"—")}</td>
      <td>${esc(t.provincia||"—")}</td>
      <td>${esc(t.telefono||"—")}</td>
      <td><span class="admin-chip ${t.verificado?"ok":"soft"}">${t.verificado?"Verificado":"Publicado"}</span></td>
      <td>${fecha(t.created_at)}</td>
    </tr>`).join("")||'<tr><td colspan="6">No hay talleres recientes.</td></tr>';
  }

  async function iniciar(){
    if(!await proteger())return;
    await Promise.allSettled([cargarMetricas(),cargarProvincias(),cargarRecientes()]);
    estado("Panel actualizado","ok");
  }

  $("btn-recargar")?.addEventListener("click",()=>{estado("Actualizando…");iniciar();});
  $("btn-cerrar-sesion")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("admin-login.html");});
  iniciar();
}());