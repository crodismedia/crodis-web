(() => {
"use strict";
const $=id=>document.getElementById(id);
const normalizar=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-+$/g,"");
const add=(sel,label,value)=>sel.add(new Option(label,value));
const cargar=async url=>{const r=await fetch(url);if(!r.ok)throw Error("No se pudo cargar "+url);return r.json()};
const estado=msg=>$("estado").textContent=msg;
const categorias={
"mantenimiento-programado":"Mantenimiento programado",
"diagnosis-electronica":"Diagnosis electrónica",
"mecanica-general":"Mecánica general"
};
const validarUrlRuta=r=>typeof r==="string"&&/^\/municipios\/[a-z0-9-]+\.html$/.test(r);
async function iniciar(){
try{
 const [catalogo,averias,mapa]=await Promise.all([
 cargar("/data/catalogo-marcas-modelos-preliminar.json"),
 cargar("/data/averias-habituales.json"),
 cargar("/data/averias-servicios.json")
 ]);
 const marcas=catalogo.marcas||{};
 for(let year=new Date().getFullYear()+1;year>=1950;year--)add($("anio"),String(year),String(year));
 const municipios=Array.isArray(window.TallerMapMunicipiosEstaticos)?window.TallerMapMunicipiosEstaticos:[];
 const lista=municipios.filter(m=>validarUrlRuta(m.ruta)&&m.nombre).map(m=>({...m,postales:Array.isArray(m.postales)?m.postales:[],aliases:Array.isArray(m.aliases)?m.aliases:[]}));
 lista.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
 Object.keys(marcas).sort((a,b)=>a.localeCompare(b,"es")).forEach(n=>add($("marca"),n,n));
 averias.opciones.forEach(a=>add($("averia"),a.nombre,a.id));
 const municipio=$("municipio"),municipioTexto=$("municipio-texto");
 const nombreMunicipio=m=>m.nombre+" ("+({"03":"Alicante","12":"Castellón","46":"Valencia"}[String(m.codigo||"").slice(0,2)]||"Comunidad Valenciana")+")";
 const actualizarMunicipios=()=>{
  const anterior=municipio.value;
  const entrada=municipioTexto.value.trim();
  const consulta=normalizar(entrada);
  const cp=entrada.replace(/\D/g,"");
  const filtrados=entrada.length<2?lista:lista.filter(m=>normalizar(m.nombre).includes(consulta)||m.aliases.some(a=>normalizar(a).includes(consulta))||(cp.length===5&&m.postales.includes(cp)));
  municipio.replaceChildren();add(municipio,"Selecciona un municipio","");
  filtrados.slice(0,250).forEach(m=>add(municipio,nombreMunicipio(m),m.ruta));
  if(filtrados.some(m=>m.ruta===anterior))municipio.value=anterior;
  else if(filtrados.length===1)municipio.value=filtrados[0].ruta;
  $("ayuda-municipio").textContent=filtrados.length?filtrados.length+" municipios encontrados"+(filtrados.length>250?" · escribe más letras para afinar":""):"Sin coincidencias. Prueba otra población o código postal.";
 };
 municipioTexto.addEventListener("input",actualizarMunicipios);
 actualizarMunicipios();
 $("marca").addEventListener("change",()=>{
 const sel=$("modelo");sel.replaceChildren();add(sel,"Selecciona un modelo","");
 const modelos=marcas[$("marca").value]||[];
 modelos.forEach(m=>add(sel,m,m));
 sel.disabled=!modelos.length;
 if(!modelos.length&&$("marca").value)estado("Esta marca aún no tiene modelos validados en nuestro catálogo preliminar.");
 else estado("");
 });
 $("formulario").addEventListener("submit",async e=>{
 e.preventDefault();
 const ruta=$("municipio").value;
 if(!validarUrlRuta(ruta))return estado("Selecciona un municipio válido.");
 const motor=$("motor").value;
 const serviciosBase=mapa.relaciones[$("averia").value]||[];
 const electrificado=["electrico","hibrido-gasolina","hibrido-diesel","microhibrido","hibrido-enchufable"].includes(motor);
 const soloElectrico=motor==="electrico";

 let servicios=serviciosBase.filter(s=>{
   if(soloElectrico && ["inyeccion-diesel","inyeccion-gasolina","turbo","filtro-particulas-dpf-fap","embrague","escape-catalizador"].includes(s))return false;
   if(motor==="diesel" && s==="inyeccion-gasolina")return false;
   if(motor==="gasolina" && ["inyeccion-diesel","filtro-particulas-dpf-fap"].includes(s))return false;
   return true;
 });
 // La propulsión modifica los servicios aplicables; no prueba compatibilidad.
 if(electrificado && ["no-arranca","arranque-dificil","bateria-descarga","perdida-potencia","testigo-motor","alternador"].includes($("averia").value))servicios=[...new Set([...servicios,"hibridos-electricos"])];
 if(soloElectrico && ["no-arranca","arranque-dificil","bateria-descarga","testigo-motor","perdida-potencia"].includes($("averia").value))servicios=[...new Set([...servicios,"baterias-alta-tension"])];
 if(motor==="hibrido-diesel")servicios=servicios.filter(s=>s!=="inyeccion-gasolina");
 if(motor==="hibrido-gasolina"||motor==="hibrido-enchufable")servicios=servicios.filter(s=>s!=="inyeccion-diesel");

 if(!servicios.length)return estado("No hay especialidades asociadas a este síntoma.");
 $("buscar").disabled=true;$("resultados").hidden=true;estado("Consultando fichas publicadas de TallerMap…");
 try{
 const res=await fetch(ruta);if(!res.ok)throw Error("No se pudo acceder al listado municipal");
 const doc=new DOMParser().parseFromString(await res.text(),"text/html");
 const tarjetas=[...doc.querySelectorAll("#lista-talleres .taller-card")];
 const candidatos=tarjetas.map(card=>{
 const publicadas=new Set([...String(card.dataset.servicios||"").split(/\s+/).map(normalizar),...Array.from(card.querySelectorAll(".especialidades span"),e=>normalizar(e.textContent))]);
 if(publicadas.has("diagnosis"))publicadas.add("diagnosis-electronica");
 if(publicadas.has("electricidad"))publicadas.add("electricidad-automovil");
 if(publicadas.has("refrigeracion"))publicadas.add("sistema-refrigeracion");
 const coincidencias=servicios.filter(s=>publicadas.has(s));
 // No asumir que un rótulo genérico identifica una especialidad concreta.

 return {card,coincidencias};
 }).filter(c=>c.coincidencias.length).sort((a,b)=>b.coincidencias.length-a.coincidencias.length);
 const salida=$("tarjetas");salida.replaceChildren();
 const detalles=[$("marca").value,$("modelo").value,$("motor").selectedOptions[0]?.textContent,$("anio").value?("Año "+$("anio").value):"", $("cilindrada").value.trim(), $("potencia").value?($("potencia").value+" CV"):"",$("averia").selectedOptions[0]?.textContent].filter(Boolean);
 $("resumen-vehiculo").textContent="Vehículo y síntoma: "+detalles.join(" · ");
 $("copiar-consulta").hidden=false;
 $("copiar-consulta").onclick=async()=>{
  const texto="Hola, tengo un "+detalles.join(" · ")+". ¿Podéis diagnosticarlo y confirmarme si trabajáis con este modelo y motor?";
  try{await navigator.clipboard.writeText(texto);estado("Consulta copiada. Puedes enviarla al taller.");}
  catch{estado("No se pudo copiar automáticamente. Selecciona el texto del resumen para compartirlo.");}
 };
 $("titulo-resultados").textContent=candidatos.length+" talleres candidatos en "+$("municipio").selectedOptions[0].text.split(" (")[0];
 if(!candidatos.length){const p=document.createElement("p");p.textContent="No hay talleres con especialidades coincidentes publicadas en este municipio. Prueba otra población cercana o consulta el directorio.";salida.append(p);}
 candidatos.forEach(({card,coincidencias})=>{
 const box=document.createElement("article");box.className="resultado";
 const h=document.createElement("h3");h.textContent=card.querySelector("h3")?.textContent?.trim()||"Taller";
 const address=document.createElement("p");address.textContent=card.querySelector(".ubicacion")?.textContent?.trim()||"Consulta su ficha para ver la dirección";
 const esp=document.createElement("p");esp.textContent="Especialidades relacionadas: "+coincidencias.map(s=>categorias[s]||s.replace(/-/g," ")).join(", ");
 const badge=document.createElement("span");badge.className="etiqueta";badge.textContent="Especialidad relacionada · disponibilidad por confirmar";
 const actions=document.createElement("div");actions.className="acciones";
 const links=card.querySelectorAll("a[href]");
 const ficha=[...links].find(a=>a.classList.contains("enlace-ficha-taller"));
 const tel=[...links].find(a=>a.getAttribute("href")?.startsWith("tel:"));
 for(const [a,label] of [[ficha,"Ver ficha"],[tel,"Llamar"]]){
 if(!a)continue;const dest=a.getAttribute("href");
 if(label==="Ver ficha"&&!/^\/talleres\/[a-z0-9-]+\/?$/.test(dest))continue;
 if(label==="Llamar"&&!/^tel:\+?[0-9 ]+$/.test(dest))continue;
 const link=document.createElement("a");link.href=dest;link.textContent=label;actions.append(link);
 }
 box.append(h,badge,address,esp,actions);salida.append(box);
 });
 const link=document.createElement("a");link.href=ruta+"?servicio="+encodeURIComponent(servicios[0])+"#talleres";link.textContent="Ver directorio municipal por especialidad principal";salida.append(link);
 $("resultados").hidden=false;estado("Búsqueda completada. Comprueba con cada taller la reparación y compatibilidad con tu vehículo.");
 $("resultados").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){estado("No se pudo realizar la búsqueda: "+err.message);}
 finally{$("buscar").disabled=false;}
 });
 estado("Selecciona marca, modelo, tipo de motor, avería y municipio. Los demás datos son opcionales.");
}catch(e){estado("No se pudo cargar el catálogo. "+e.message);}
}
document.addEventListener("DOMContentLoaded",iniciar);
})();