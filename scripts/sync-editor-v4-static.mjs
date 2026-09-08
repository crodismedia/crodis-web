import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const U=process.env.SUPABASE_URL||'https://cnyptelvbsndpkzbrete.supabase.co';
const K=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
const CURSOR=path.join(ROOT,'datos','static-sync-cursor.json');
const SITE='https://www.tallermap.es';

const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=v=>clean(v,200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const safePhone=v=>{const x=String(v??'').replace(/[^0-9+]/g,'');return /^\+?[0-9]{6,15}$/.test(x)?x:''};
const safeUrl=v=>{const x=clean(v,500);if(!x)return'';try{const u=new URL(/^https?:\/\//i.test(x)?x:`https://${x}`);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}};

async function api(url,options={}){
  const r=await fetch(url,{...options,headers:{apikey:K,Authorization:`Bearer ${K}`,'Content-Type':'application/json',...(options.headers||{})}});
  if(!r.ok)throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,400)}`);
  return r.json();
}

function readCursor(){
  if(!fs.existsSync(CURSOR))return '2026-08-30T10:18:08.743593Z';
  try{return JSON.parse(fs.readFileSync(CURSOR,'utf8')).last_sync||'2026-08-30T10:18:08.743593Z'}catch{return '2026-08-30T10:18:08.743593Z'}
}

async function changes(from,to){
  return api(`${U}/rest/v1/rpc/listar_cambios_talleres_estaticos`,{method:'POST',body:JSON.stringify({p_desde:from,p_hasta:to})});
}
async function workshop(slug){
  const u=new URL(`${U}/rest/v1/talleres`);u.searchParams.set('select','*');u.searchParams.set('slug',`eq.${slug}`);u.searchParams.set('limit','1');
  const rows=await api(u);return rows[0]||null;
}
async function serviceMap(){
  const u=new URL(`${U}/rest/v1/servicios`);u.searchParams.set('select','slug,nombre');u.searchParams.set('activo','eq.true');u.searchParams.set('limit','500');
  const rows=await api(u);return new Map(rows.map(x=>[x.slug,x.nombre]));
}
async function related(t){
  const u=new URL(`${U}/rest/v1/talleres`);u.searchParams.set('select','slug,nombre,direccion,codigo_postal,ciudad');u.searchParams.set('activo','eq.true');u.searchParams.set('estado','eq.publicado');u.searchParams.set('ciudad',`eq.${t.ciudad}`);u.searchParams.set('order','nombre.asc');u.searchParams.set('limit','8');
  return (await api(u)).filter(x=>x.slug!==t.slug).slice(0,6);
}

function municipalities(){
  const rows=fs.readFileSync(path.join(ROOT,'datos','municipios.csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1);
  return rows.map(r=>{const[nombre,codigo,archivo]=r.split(';');return{nombre,codigo,archivo,formas:nombre.split('/').map(norm)}});
}
function municipioFor(t,all){
  const city=norm(t.ciudad),pc=clean(t.codigo_postal,10).slice(0,2);
  return all.find(m=>m.codigo?.startsWith(pc)&&m.formas.includes(city))||all.find(m=>m.formas.includes(city))||null;
}
function provincePath(t){const p=clean(t.provincia,100).toLowerCase();if(p.includes('alicante'))return'/provincias/alicante.html';if(p.includes('castell'))return'/provincias/castellon.html';return'/provincias/valencia.html'}
function scheduleRows(h){
  if(!h||typeof h!=='object')return'<p>Horario no disponible.</p>';
  const days=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
  const out=[];for(const[k,l]of days){const d=h[k];if(!d)continue;let v='';if(d.cerrado===true)v='Cerrado';else if(Array.isArray(d.turnos))v=d.turnos.map(x=>x?.apertura&&x?.cierre?`${clean(x.apertura,10)}–${clean(x.cierre,10)}`:'').filter(Boolean).join(' y ');if(v)out.push(`<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`)}
  return out.length?`<dl class="taller-horario-visible">${out.join('')}</dl>`:'<p>Horario no disponible.</p>';
}
function openingSpecs(h){
  if(!h||typeof h!=='object')return[];const map={lunes:'Monday',martes:'Tuesday',miercoles:'Wednesday',jueves:'Thursday',viernes:'Friday',sabado:'Saturday',domingo:'Sunday'},out=[];
  for(const[k,day]of Object.entries(map)){const d=h[k];if(!d||d.cerrado===true||!Array.isArray(d.turnos))continue;for(const x of d.turnos){if(x?.apertura&&x?.cierre)out.push({'@type':'OpeningHoursSpecification',dayOfWeek:day,opens:x.apertura,closes:x.cierre})}}
  return out;
}
function actionHtml(t){
  const name=clean(t.nombre,140),addr=[t.direccion,t.codigo_postal,t.ciudad,t.provincia,'España'].filter(Boolean).join(', '),phone=safePhone(t.telefono),web=safeUrl(t.web),maps=addr?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${addr}`)}`:'';
  const a=[];if(phone)a.push(`<a class="boton accion-principal" href="tel:${esc(phone)}">☎ Llamar ahora</a>`);if(maps)a.push(`<a class="boton boton-claro accion-mapa" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`);if(web)a.push(`<a class="boton boton-claro accion-web" href="${esc(web)}" target="_blank" rel="noopener noreferrer">Web</a>`);return a.join('');
}
function render(t,labels,m,rels){
  const slug=clean(t.slug,180),name=clean(t.nombre||'Taller',140),city=clean(t.ciudad,100),prov=clean(t.provincia,100),cp=clean(t.codigo_postal,10),street=clean(t.direccion,180),phone=safePhone(t.telefono);
  const address=[street,cp,city,prov].filter(Boolean).join(', '),desc=clean(t.descripcion||`Consulta teléfono, dirección, horarios, servicios y cómo llegar a ${name} en ${city}.`,260),municipioPath=m?`/${String(m.archivo).replaceAll('\\','/')}`:'/',provPath=provincePath(t);
  const serviceSlugs=Array.isArray(t.servicios)?t.servicios:[],services=serviceSlugs.map(s=>labels.get(s)||String(s).replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
  const canonical=`${SITE}/talleres/${encodeURIComponent(slug)}`;
  const structured={'@context':'https://schema.org','@type':'AutoRepair','@id':`${canonical}#negocio`,name,url:canonical,description:desc,address:{'@type':'PostalAddress',streetAddress:street,postalCode:cp,addressLocality:city,addressRegion:prov,addressCountry:'ES'},openingHoursSpecification:openingSpecs(t.horarios),serviceType:services};if(phone)structured.telephone=phone;
  const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement':[{'@type':'ListItem',position:1,name:'Inicio',item:`${SITE}/`},{'@type':'ListItem',position:2,name:prov,item:`${SITE}${provPath}`},{'@type':'ListItem',position:3,name:city,item:`${SITE}${municipioPath}`},{'@type':'ListItem',position:4,name,item:canonical}]};
  const relatedHtml=rels.map(x=>`<a class="taller-relacionado" href="/talleres/${encodeURIComponent(x.slug)}"><strong>${esc(x.nombre)}</strong><small>${esc([x.direccion,x.codigo_postal,x.ciudad].filter(Boolean).join(', '))}</small></a>`).join('');
  return `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${esc(name)} | Taller en ${esc(city)} | TallerMap</title>\n<meta name="description" content="${esc(desc)}">\n<meta name="robots" id="robots-taller" content="index,follow,max-image-preview:large">\n<link rel="canonical" id="canonical-taller" href="${esc(canonical)}">\n<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="stylesheet" href="/css/taller-shell.css?v=20260823-2"><link rel="stylesheet" href="/css/valoraciones.css?v=20260823-1"><link rel="stylesheet" href="/css/taller-publico.css?v=20260818-6"><link rel="stylesheet" href="/css/taller-publico-verde.css?v=20260818-6"><link rel="stylesheet" href="/css/taller-botones-contexto.css?v=20260820-1"><link rel="stylesheet" href="/css/cookie-consent.css">\n<script type="application/ld+json" id="datos-estructurados-taller">${JSON.stringify(structured)}</script>\n<script type="application/ld+json" id="datos-estructurados-migas">${JSON.stringify(crumbs)}</script>\n</head>\n<body>\n<header class="cabecera"><div class="contenedor cabecera-contenido"><a href="/" class="marca"><img class="marca-icono marca-icono-logo" src="/favicon.svg" alt="TallerMap" aria-hidden="true" width="46" height="46"><span class="marca-texto"><strong>TallerMap</strong><small>Talleres cerca de ti</small></span></a><a href="/#talleres" class="boton boton-pequeno">Buscar talleres</a></div></header>\n<main class="ficha-publica">\n<a class="ficha-publica-volver" href="${esc(municipioPath)}">← Volver a ${esc(city)}</a>\n<nav id="migas-pan" class="ficha-migas" aria-label="Migas de pan"><a href="/">Inicio</a><span class="ficha-migas-separador">›</span><a href="${esc(provPath)}">${esc(prov)}</a><span class="ficha-migas-separador">›</span><a href="${esc(municipioPath)}">${esc(city)}</a><span class="ficha-migas-separador">›</span><span>${esc(name)}</span></nav>\n<article id="ficha-taller"><h1 id="taller-nombre">${esc(name)}</h1><p id="taller-direccion" class="ficha-publica-direccion">${esc(address)}</p>\n<div id="taller-foto" class="ficha-publica-foto ficha-publica-portada-verde"><div class="tm-auto-portada tm-auto-portada-grande tm-auto-portada-horario" role="group" aria-label="Horario de atención"><div class="tm-portada-identidad" aria-hidden="true"><img src="/favicon.svg" alt="TallerMap" width="58" height="58"><strong>TallerMap</strong><span>Conectamos conductores<br>con talleres de confianza</span></div><div class="tm-portada-horario-contenido"><h2><span aria-hidden="true">◷</span> Horario de atención</h2>${scheduleRows(t.horarios)}</div></div></div>\n<div class="ficha-estado"></div><div id="taller-acciones" class="ficha-publica-acciones">${actionHtml(t)}</div>${t.descripcion?`<p class="ficha-publica-descripcion">${esc(t.descripcion)}</p>`:''}\n<section class="ficha-servicios-ofrecidos" aria-labelledby="servicios-ofrecidos-titulo"><h2 id="servicios-ofrecidos-titulo">Servicios que se ofrecen</h2><div id="taller-servicios" class="especialidades especialidades-destacadas">${services.map(s=>`<span>${esc(s)}</span>`).join('')}</div></section>\n<div id="taller-datos" class="ficha-publica-datos"><p><strong>Teléfono:</strong> ${phone?`<a href="tel:${esc(phone)}">${esc(phone)}</a>`:'No disponible'}</p><p><strong>Dirección:</strong> ${esc(street||'No disponible')}</p><p><strong>Código postal:</strong> ${esc(cp||'No disponible')}</p><p><strong>Municipio:</strong> ${esc(city)}</p><p><strong>Provincia:</strong> ${esc(prov)}</p></div>\n<p class="ficha-aviso">TallerMap publica información facilitada por negocios o procedente de fuentes públicas. La ficha puede corregirse, reclamarse o retirarse cuando corresponda.</p><div class="ficha-publica-gestion"><a id="reclamar-ficha" class="boton" href="mailto:info@tallermap.es">Soy el propietario: reclamar ficha</a><a id="corregir-ficha" class="boton boton-claro" href="mailto:info@tallermap.es">Informar de datos incorrectos</a></div></article>\n<section id="contexto-local" class="ficha-contexto"><h2>Talleres en ${esc(city)}</h2><p>Consulta otros talleres publicados en ${esc(city)}.</p><div class="ficha-contexto-enlaces"><a class="boton" href="${esc(municipioPath)}">Ver talleres en ${esc(city)}</a><a class="boton boton-claro" href="${esc(provPath)}">Ver talleres en ${esc(prov)}</a></div></section>\n<section class="ficha-relacionados" aria-labelledby="relacionados-titulo"><h2 id="relacionados-titulo">Otros talleres en ${esc(city)}</h2><div id="talleres-relacionados" class="ficha-relacionados-lista">${relatedHtml}</div></section>\n</main>\n<footer class="pie"><div class="contenedor copyright"><span>© 2026 TallerMap</span><span>Una plataforma de CRODIS Media</span></div></footer>\n<script defer src="/js/valoraciones.js?v=20260823-2" data-tallermap-valoraciones="true"></script><script defer src="/js/reclamacion-link.js?v=20260823-2" data-tallermap-reclamacion-link="true"></script><script defer src="/js/cookie-consent.js"></script>\n</body></html>\n`;
}

const from=readCursor(),to=new Date().toISOString(),list=await changes(from,to),labels=await serviceMap(),munis=municipalities();
let touched=0;
for(const ch of list){const slug=clean(ch.slug,180);if(!/^[a-z0-9-]{2,180}$/.test(slug))continue;const dir=path.join(ROOT,'talleres',slug);if(ch.operacion==='delete'){if(fs.existsSync(dir)){fs.rmSync(dir,{recursive:true,force:true});touched++;}continue;}const t=await workshop(slug);if(!t||t.activo!==true||t.estado!=='publicado'){if(fs.existsSync(dir)){fs.rmSync(dir,{recursive:true,force:true});touched++;}continue;}const html=render(t,labels,municipioFor(t,munis),await related(t));fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'index.html'),before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';if(before!==html){fs.writeFileSync(file,html,'utf8');touched++;}}
fs.writeFileSync(CURSOR,JSON.stringify({last_sync:to},null,2)+'\n','utf8');
console.log(`CAMBIOS_LOG=${list.length}`);console.log(`FICHAS_CAMBIADAS=${touched}`);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`changed=${list.length>0?'true':'false'}\n`);
