(() => {
"use strict";
const el=id=>document.getElementById(id);
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const eur=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n);
const MIN_WAIT=180000;
const sourceMap={
"cambio-aceite":"aceite","pastillas-freno":"pastillas","embrague":"embrague",
"kit-distribucion":"distribucion","aire-acondicionado":"clima","neumaticos":"neumatico","alineacion":"alineacion",
"bomba-agua":"bomba-agua","revision-basica":"revision-basica"
};
// Consulta anónima del CSV público; si el origen bloquea CORS, usamos referencias contrastadas locales.
async function consultarFuenteAbierta(){
 const response=await fetch("https://www.artemek.com/estudios/precios-taller-2026.csv",{mode:"cors",cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("Fuente externa no disponible");
 const raw=await response.text();
 if(raw.length>150000)throw Error("Archivo remoto demasiado grande");
 const rows=raw.split(/\r?\n/).filter(Boolean);
 const header=rows.findIndex(r=>r.startsWith("servicio,slug,unidad,"));
 if(header<0)throw Error("Formato de fuente desconocido");
 const headings=rows[header].split(",");
 const results=[];
 for(const line of rows.slice(header+1)){
  if(line.startsWith("#")||line.startsWith('"#')||line.startsWith("comunidad,"))break;
  const cells=line.match(/(?:[^,"]+|"[^"]*")+/g)?.map(v=>v.replace(/^"|"$/g,""))||[];
  const obj=Object.fromEntries(headings.map((k,i)=>[k,cells[i]??""]));
  if(obj.unidad!=="trabajo"||!sourceMap[obj.slug]||obj.slug==="neumaticos")continue;
  const min=Number(obj.bajo_eur),max=Number(obj.alto_eur);
  if(!(min>0&&max>=min&&max<10000))continue;
  results.push({id:obj.slug,trabajo:obj.servicio,min,max,fecha:obj.fecha_datos,fuente:"Artemek · estudio de precios 2026",url:"https://www.artemek.com/estudios/precios-taller-2026",ambito:obj.ambito||"España",alcance:"Mediana y tramo estadístico de precios publicados; no oferta específica."});
 }
 if(!results.length)throw Error("CSV sin datos válidos");
 return {online:true,results};
}
const matchers=[
{id:"diagnosis",rx:/\b(diagnos|revision de averia|escaneo de fallos|lectura de fallos|maquina de diagnosis)/},
{id:"embrague",rx:/\b(embrague|kit de embrague)/},
{id:"bimasa",rx:/\b(bimasa|volante motor)/},
{id:"discos-pastillas",rx:/\b(discos? (y |de )?pastillas|pastillas? (y |con )?discos|discos? de freno)/},
{id:"pastillas",rx:/\b(pastillas? de freno|cambiar pastillas|pastillas delanteras)/},
{id:"distribucion",rx:/\b(correa de distribucion|kit de distribucion|cambiar distribucion)/},
{id:"cadena",rx:/\b(cadena de distribucion)/},
{id:"bateria",rx:/\b(cambio de bateria|sustituir bateria|bateria agotada|bateria descargada)/},
{id:"aceite",rx:/\b(cambio de aceite|cambiar aceite|aceite y filtro|revision de aceite)/},
{id:"amortiguadores",rx:/\b(amortiguadores?|cambiar suspension)/},
{id:"clima",rx:/\b(carga de aire acondicionado|recarga del aire|recargar aire|refrigerante del aire)/},
{id:"dpf",rx:/\b(limpieza de dpf|regeneracion.*(dpf|fap|filtro de particulas)|limpiar filtro de particulas)/},
{id:"centralita",rx:/\b(reparar centralita|reparacion de centralita|ecu defectuosa)/},
{id:"alineacion",rx:/\b(alineacion|alinear direccion|paralelo de ruedas)/},
{id:"pre-itv",rx:/\b(pre itv|revision antes de itv)/},
{id:"filtro",rx:/\b(cambio de filtro de aire|filtro de habitaculo|filtro de combustible)/},
{id:"neumatico",rx:/\b(neumaticos|cambiar rueda|cambio de ruedas)/},
{id:"turbo",rx:/\b(reparar turbo|cambiar turbo|turbo roto|turbo averiado|sustitucion de turbo)/},
{id:"bomba-agua",rx:/\b(bomba de agua)/},
{id:"revision-basica",rx:/\b(revision basica|revision general del coche)/}
];
function selectedJobs(raw){
 const text=normalize(raw);
 const ids=new Set(matchers.filter(m=>m.rx.test(text)).map(m=>m.id));
 if(ids.has("bimasa"))ids.delete("embrague");
 if(ids.has("discos-pastillas"))ids.delete("pastillas");
 if(ids.has("cadena"))ids.delete("distribucion");
 if(ids.has("diagnosis")&&ids.size>1)ids.delete("diagnosis");
 // No deducir reparaciones a partir de síntomas sin un diagnóstico.
 if(ids.size===0)ids.add("diagnosis");
 return ids;
}
function fillDescription(){
 const fields=[["marca","Marca"],["modelo","Modelo"],["motor","Motor"],["anio","Año"],["cilindrada","Versión"],["potencia","Potencia"],["averia","Síntoma"]];
 const lines=[];
 for(const [id,label] of fields){
  const input=el(id);if(!input)continue;
  const value=input.tagName==="SELECT"?input.selectedOptions[0]?.textContent:input.value;
  if(!input.value)continue;
  lines.push(label+": "+value+(id==="potencia"?" CV":""));
 }
 if(!lines.length){el("estado-precios").textContent="Primero selecciona los datos del vehículo o escribe una descripción.";return;}
 el("descripcion-precio").value=lines.join(". ")+". Necesito precios orientativos de diagnosis o reparación.";
 el("estado-precios").textContent="Puedes completar o corregir la descripción antes de buscar.";
}
function render(results,online,chosen,consulted){
 el("resultado-precios").hidden=false;
 const list=el("lista-precios");list.replaceChildren();
 el("explicacion-precios").textContent=chosen.size===1&&chosen.has("diagnosis")?
 "El texto describe síntomas sin identificar una reparación concreta. Solo mostramos el coste publicado de una diagnosis básica; no sería fiable inventar el coste de piezas sin verificar la avería.":
 "Los precios corresponden a trabajos mencionados en la descripción, no a un diagnóstico confirmado. Una misma operación puede tener rangos distintos según la fuente.";
 for(const price of results){
  const item=document.createElement("li"),h=document.createElement("strong");h.textContent=price.trabajo;
  const amount=document.createElement("span");amount.className="precio-importe";amount.textContent=eur(price.min)+" – "+eur(price.max);
  const description=document.createElement("p");description.textContent=price.alcance||"Precio orientativo publicado en España";
  const details=document.createElement("p");details.className="precio-fuente";details.textContent=price.fuente+" · "+(price.fecha||"fecha no indicada")+" · "+(price.ambito||"España")+" · IVA según fuente";
  const link=document.createElement("a");link.href=price.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Consultar fuente original";
  item.append(h,amount,description,details,link);list.append(item);
 }
 if(!results.length){const item=document.createElement("li");item.textContent="No hay referencias suficientemente claras para este trabajo. Solicita un presupuesto al taller tras la diagnosis.";list.append(item);}
 el("estado-precios").textContent="Investigación finalizada tras 3 minutos. "+(online?"Fuente Artemek consultada en Internet y referencias publicadas contrastadas.":"La fuente en línea no respondió; se muestran únicamente referencias publicadas anteriormente.")+" "+results.length+" referencias ordenadas de menor a mayor.";
}
async function run(){
 const input=el("descripcion-precio"),description=input.value.trim();
 if(description.length<10){el("estado-precios").textContent="Describe el vehículo y la reparación (mínimo 10 caracteres).";input.focus();return;}
 const runBtn=el("buscar-precio");runBtn.disabled=true;el("completar-precio").disabled=true;
 el("resultado-precios").hidden=true;el("lista-precios").replaceChildren();
 const progress=el("progreso-precios"),bar=el("barra-precios"),count=el("cuenta-precios");
 progress.hidden=false;bar.value=0;
 const started=Date.now();
 const update=()=>{
  const elapsed=Date.now()-started,remain=Math.max(0,Math.ceil((MIN_WAIT-elapsed)/1000));
  bar.value=Math.min(180,Math.floor(elapsed/1000));
  const mm=Math.floor(remain/60),ss=String(remain%60).padStart(2,"0");
  count.textContent="Resultados ocultos · tiempo restante "+mm+":"+ss;
 };
 el("estado-precios").textContent="Consultando referencias publicadas. Los precios no aparecerán antes de los tres minutos completos.";
 update();const ticker=setInterval(update,1000);
 let results=[],online=false,chosen=selectedJobs(description);
 try{
  const [base,live]=await Promise.allSettled([
   fetch("/data/referencias-precios-reparacion.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("datos base");return r.json();}),
   consultarFuenteAbierta()
  ]);
  if(base.status!=="fulfilled")throw Error("No se pudieron cargar las referencias de precios.");
  const rows=base.value.precios||[];
  results=rows.filter(r=>chosen.has(r.id)).map(r=>({...r,ambito:"España"}));
  if(live.status==="fulfilled"&&live.value.online===true&&Array.isArray(live.value.results)){
   online=true;
   for(const a of live.value.results){
    const mapped=sourceMap[a.id];
    if(!chosen.has(mapped))continue;
    // No usar importes no comparables como hora de mano de obra o montaje por unidad.
    if(a.id==="neumaticos")continue;
    results.push({...a,alcance:"Mediana y tramo estadístico de precios de fuentes públicas; no oferta de taller."});
   }
  }
  results=results.filter(r=>Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.min>0&&r.max>=r.min&&/^https:\/\//.test(r.url));
  results.sort((a,b)=>a.min-b.min||a.max-b.max||a.fuente.localeCompare(b.fuente,"es"));
  const remain=MIN_WAIT-(Date.now()-started);
  if(remain>0)await new Promise(resolve=>setTimeout(resolve,remain));
  render(results,online,chosen);
 }catch(err){
  const remain=MIN_WAIT-(Date.now()-started);
  if(remain>0)await new Promise(resolve=>setTimeout(resolve,remain));
  el("estado-precios").textContent="No se pudieron obtener referencias verificables: "+err.message;
 }finally{
  clearInterval(ticker);bar.value=180;count.textContent="Tiempo de espera completado · 3:00";
  runBtn.disabled=false;el("completar-precio").disabled=false;
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 el("completar-precio")?.addEventListener("click",fillDescription);
 el("buscar-precio")?.addEventListener("click",run);
});
})();