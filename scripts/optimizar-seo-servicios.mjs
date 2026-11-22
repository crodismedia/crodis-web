import fs from 'node:fs';
import path from 'node:path';
const ROOT=process.cwd(), DIR=path.join(ROOT,'servicios');
const SPECS={"index.html":["Servicios para reparar tu coche | TallerMap","Encuentra talleres mecánicos por servicio: cambio de aceite, frenos, neumáticos, embrague, diagnosis, chapa y pintura y más en la Comunidad Valenciana."],"aire-acondicionado.html":["Carga y reparación de aire acondicionado | TallerMap","Busca talleres para carga de gas del aire acondicionado del coche, detección de fugas y reparación de climatización en Alicante, Castellón y Valencia."],"alineacion-direccion.html":["Alineación de ruedas y dirección | TallerMap","Encuentra talleres para alineación de ruedas, paralelo, geometría y revisión de dirección. Consulta talleres de Alicante, Castellón y Valencia."],"alternador-motor-arranque.html":["Reparar alternador y motor de arranque | TallerMap","Busca talleres para reparar alternador, motor de arranque y averías de carga o encendido. Consulta servicios y teléfonos por municipio."],"baterias.html":["Cambiar la batería del coche | TallerMap","Encuentra talleres para cambio de batería del coche, comprobación de carga y diagnóstico de arranque en Alicante, Castellón y Valencia."],"cadena-distribucion.html":["Reparación de cadena de distribución | TallerMap","Busca talleres para revisar o reparar la cadena de distribución, tensores, holguras y ruidos del motor. Consulta sus fichas en TallerMap."],"caja-cambios-automatica-dsg.html":["Talleres de cambio automático y DSG | TallerMap","Busca talleres para mantenimiento y reparación de cajas de cambios automáticas y DSG en Alicante, Castellón y Valencia. Consulta teléfonos y fichas."],"caja-cambios.html":["Reparación de cajas de cambios | TallerMap","Encuentra talleres para reparar cajas de cambios manuales o automáticas, ruidos y problemas al engranar marchas en la Comunidad Valenciana."],"calefaccion-climatizacion.html":["Reparación de calefacción del coche | TallerMap","Busca talleres de calefacción y climatización del coche: ventilador, desempañado, aire caliente y control de temperatura en tu municipio."],"cambio-aceite-filtros.html":["Cambio de aceite y filtros del coche | TallerMap","Busca talleres para cambio de aceite de motor y filtros de aceite, aire o habitáculo en Alicante, Castellón y Valencia. Consulta su ficha y teléfono."],"carroceria.html":["Reparación de carrocería del coche | TallerMap","Encuentra talleres de carrocería para reparar golpes, abolladuras, paragolpes y daños exteriores del coche en Alicante, Castellón y Valencia."],"centralitas-electronica.html":["Reparación y diagnosis de centralitas | TallerMap","Busca talleres para diagnosis de centralitas, sensores y averías electrónicas del coche por población o código postal en la Comunidad Valenciana."],"chapa-pintura.html":["Talleres de chapa y pintura del coche | TallerMap","Encuentra talleres de chapa y pintura para reparar golpes, arañazos y daños de carrocería en Alicante, Castellón y Valencia."],"correa-distribucion.html":["Cambio de correa de distribución | TallerMap","Busca talleres para cambiar la correa y el kit de distribución del coche en Alicante, Castellón y Valencia. Consulta teléfono y dirección."],"diagnosis-electronica.html":["Diagnosis de coches y averías electrónicas | TallerMap","Encuentra talleres para diagnosis electrónica del coche, lectura de averías, sensores y centralitas en Alicante, Castellón y Valencia."],"electricidad-automovil.html":["Electricidad del automóvil y averías | TallerMap","Busca talleres de electricidad del automóvil para problemas de batería, alternador, luces y arranque en Alicante, Castellón y Valencia."],"embrague.html":["Cambio y reparación de embrague | TallerMap","Encuentra talleres para cambiar o reparar el embrague del coche, diagnosticar patinamientos, ruidos y vibraciones en Alicante, Castellón y Valencia."],"equilibrado-ruedas.html":["Equilibrado de ruedas del coche | TallerMap","Busca talleres para equilibrado de ruedas, corrección de vibraciones y revisión de neumáticos en Alicante, Castellón y Valencia."],"escape-catalizador.html":["Reparación de escape y catalizador | TallerMap","Encuentra talleres para reparar escape, silencioso y catalizador del coche. Consulta servicios y contactos en Alicante, Castellón y Valencia."],"filtro-particulas-dpf-fap.html":["Limpieza del filtro de partículas DPF/FAP | TallerMap","Busca talleres que ofrecen diagnóstico y limpieza del filtro de partículas DPF/FAP. Consulta fichas y confirma el servicio en tu municipio."],"frenos.html":["Cambio de pastillas y reparación de frenos | TallerMap","Encuentra talleres para cambiar pastillas y discos de freno, revisar ABS y reparar el sistema de frenado en Alicante, Castellón y Valencia."],"hibridos-electricos.html":["Talleres para coches híbridos y eléctricos | TallerMap","Busca talleres que publican servicios para coches híbridos y eléctricos: mantenimiento, diagnosis y reparación. Comprueba su especialidad."],"inyeccion-diesel.html":["Reparación de inyección diésel | TallerMap","Encuentra talleres de inyección diésel para diagnosis de inyectores y averías de alimentación del motor en Alicante, Castellón y Valencia."],"lunas-cristales.html":["Cambio de lunas y reparación de parabrisas | TallerMap","Busca talleres para reparar impactos en parabrisas y cambiar lunas o cristales del coche en Alicante, Castellón y Valencia."],"mecanica-general.html":["Talleres de mecánica general del coche | TallerMap","Encuentra talleres de mecánica general para mantenimiento y reparaciones de motor, embrague, frenos y distribución en Alicante, Castellón y Valencia."],"neumaticos.html":["Cambio de neumáticos y montaje de ruedas | TallerMap","Busca talleres para cambiar neumáticos, reparar pinchazos y realizar montaje y equilibrado de ruedas en Alicante, Castellón y Valencia."],"pre-itv.html":["Revisión pre-ITV del coche | TallerMap","Encuentra talleres para revisión pre-ITV de frenos, luces, neumáticos y otros puntos del vehículo antes de acudir a la inspección."],"reparacion-motor.html":["Reparación y diagnosis de motor | TallerMap","Busca talleres para reparación de motor, pérdida de potencia, fugas, ruidos o consumo anormal en Alicante, Castellón y Valencia."],"sistema-refrigeracion.html":["Reparación del sistema de refrigeración | TallerMap","Encuentra talleres para reparar radiador, bomba de agua, termostato y fugas de refrigerante del coche en la Comunidad Valenciana."],"sistemas-adas.html":["Calibración ADAS de cámaras y radares | TallerMap","Consulta talleres que publican servicios ADAS en Alicante y Valencia. Pregunta por calibración de cámaras, radares y ayudas a la conducción."],"suspension-amortiguadores.html":["Cambio de amortiguadores y suspensión | TallerMap","Busca talleres para cambiar amortiguadores y reparar suspensión, muelles, ruidos y problemas de estabilidad en Alicante, Castellón y Valencia."],"turbo.html":["Reparación y sustitución de turbo | TallerMap","Encuentra talleres que publican reparación de turbo. Consulta fichas y teléfonos para confirmar diagnosis o sustitución en tu provincia."]};
const DRY=process.argv.includes('--dry-run');
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const titleRe=/<title\b[^>]*>[\s\S]*?<\/title>/i;
const descRe=/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*>/i;
const ogTitleRe=/<meta\b(?=[^>]*\bproperty\s*=\s*["']og:title["'])[^>]*>/i;
const ogDescRe=/<meta\b(?=[^>]*\bproperty\s*=\s*["']og:description["'])[^>]*>/i;
const twitterRe=/<meta\b(?=[^>]*\bname\s*=\s*["']twitter:title["'])[^>]*>/i;
const robotsRe=/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>/i;
const canonicalRe=/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i;
const h1Re=/<h1\b[^>]*>[\s\S]*?<\/h1>/i;
const linksRe=/\b(?:href|src)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const imgRe=/<img\b[^>]*>/gi;
const files=fs.readdirSync(DIR).filter(x=>x.endsWith('.html')).sort();
if(files.length!==32||Object.keys(SPECS).length!==32||files.some(x=>!SPECS[x]))throw Error('Lista de 32 páginas de servicios inesperada. No se cambia nada.');
function snapshot(html){
  return {
    robots: html.match(robotsRe)?.[0],
    canonical: html.match(canonicalRe)?.[0],
    h1: html.match(h1Re)?.[0],
    links: [...html.matchAll(linksRe)].map(x=>x[0]),
    imgCount: [...html.matchAll(imgRe)].length
  };
}
function updateLd(html,title,description){
  return html.replace(/(<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (all,start,body,end)=>{
    let parsed;try{parsed=JSON.parse(body)}catch{return all}
    let changed=false;
    function visit(node){
      if(Array.isArray(node))return node.forEach(visit);
      if(!node||typeof node!=='object')return;
      const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
      if(types.some(x=>['CollectionPage','WebPage','SearchResultsPage'].includes(x))){
        if(node.description!==description){node.description=description;changed=true}
        if(node.name!==title.replace(/ \| TallerMap$/,'')){node.name=title.replace(/ \| TallerMap$/,'');changed=true}
      }
      if(node['@graph'])visit(node['@graph']);
    }
    visit(parsed);
    return changed?start+JSON.stringify(parsed)+end:all;
  });
}
const changes=[];
for(const name of files){
  const file=path.join(DIR,name),old=fs.readFileSync(file,'utf8');
  const [title,desc]=SPECS[name];
  if(title.length>67||desc.length>160||!old.match(titleRe)||!old.match(descRe)||!old.match(robotsRe)||!old.match(canonicalRe)||!old.match(h1Re))throw Error('Etiqueta SEO ausente: '+name);
  if(!/\bindex\s*,\s*follow\b/i.test(old.match(robotsRe)[0])||/\bnoindex\b|\bnofollow\b/i.test(old.match(robotsRe)[0]))throw Error('Revisar directivas robots: '+name);
  const original=snapshot(old);
  let current=old.replace(titleRe,'<title>'+escape(title)+'</title>')
    .replace(descRe,'<meta name="description" content="'+escape(desc)+'">');
  current=current.replace(ogTitleRe,'<meta property="og:title" content="'+escape(title)+'">')
    .replace(ogDescRe,'<meta property="og:description" content="'+escape(desc)+'">')
    .replace(twitterRe,'<meta name="twitter:title" content="'+escape(title)+'">');
  current=updateLd(current,title,desc);
  if(JSON.stringify(original)!==JSON.stringify(snapshot(current)))throw Error('Se alteraría H1, enlaces, imágenes, canonical o robots: '+name);
  if(old!==current)changes.push({file,name,content:current});
}
console.log('SEO servicios: '+files.length+' páginas revisadas, '+changes.length+' con mejoras. Simulación='+DRY);
if(!DRY)for(const item of changes)fs.writeFileSync(item.file,item.content,'utf8');
console.log('Cambios protegidos: URL, canonical, robots index,follow, H1, enlaces e imágenes.');
