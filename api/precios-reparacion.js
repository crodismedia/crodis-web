// Consulta pública del CSV de Artemek (CC BY 4.0). No recibe ni guarda datos del vehículo.
export default async function handler(req,res){
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
 if(req.method!=="GET"){res.status(405).json({error:"Método no permitido"});return;}
 const url="https://www.artemek.com/estudios/precios-taller-2026.csv";
 const allowed=new Set(["cambio-aceite","pastillas-freno","embrague","kit-distribucion","aire-acondicionado","neumaticos","alineacion","bomba-agua","revision-basica"]);
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(9000),headers:{"Accept":"text/csv,text/plain"}});
  if(!response.ok)throw Error("Fuente respondió "+response.status);
  const csv=await response.text();
  if(csv.length>150000)throw Error("Archivo excesivamente grande");
  const rows=csv.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const header=rows.findIndex(r=>r.startsWith("servicio,slug,unidad,"));
  if(header<0)throw Error("Esquema CSV no reconocido");
  const columns=rows[header].split(",");
  const output=[];
  for(const line of rows.slice(header+1)){
   if(!line||line.startsWith("#")||line.startsWith('"#')||line.startsWith("comunidad,"))break;
   const cells=line.match(/(?:[^,"]+|"[^"]*")+/g)?.map(v=>v.replace(/^"|"$/g,""))||[];
   const obj=Object.fromEntries(columns.map((k,i)=>[k,cells[i]??""]));
   if(!allowed.has(obj.slug)||obj.unidad!=="trabajo")continue;
   const min=Number(obj.bajo_eur),max=Number(obj.alto_eur);
   if(!(min>0&&max>=min&&max<10000))continue;
   output.push({id:obj.slug,trabajo:obj.servicio,min,max,fecha:obj.fecha_datos,fuente:"Artemek · estudio 2026",url:"https://www.artemek.com/estudios/precios-taller-2026",ambito:obj.ambito||"España",tipo:"estadistica",unidad:obj.unidad});
  }
  res.status(200).json({online:true,licencia:"CC BY 4.0",attribution:"Artemek, Lo que cuestan las reparaciones del coche en España (2026)",source:url,results:output});
 }catch(e){
  res.status(503).json({online:false,results:[],error:"No se pudo actualizar la fuente pública ahora. Se pueden usar referencias publicadas anteriormente."});
 }
}
