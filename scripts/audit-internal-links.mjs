import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
const {values: opt} = parseArgs({options:{gsc:{type:'string'},live:{type:'boolean'},root:{type:'string',default:'.'},out:{type:'string',default:'audit-internal-links'},base:{type:'string',default:'https://www.tallermap.es'},concurrency:{type:'string',default:'4'}}});
const root=path.resolve(opt.root), base=new URL(opt.base), out=path.resolve(opt.out);
const concurrency=Number(opt.concurrency); if(!Number.isInteger(concurrency)||concurrency<1||concurrency>10) throw Error('concurrency debe estar entre 1 y 10');
const decode=s=>String(s??'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|aacute|eacute|iacute|oacute|uacute|ntilde|uuml);/gi,(m,k)=>{if(k[0]==='#'){let n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;}return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',uuml:'ü'})[k.toLowerCase()]??m;});
const clean=s=>decode(String(s??'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const norm=s=>clean(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const list=(s,tag)=>[...s.matchAll(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'\\s*>','gi'))].map(m=>clean(m[1]));
const allowed=u=>{const a=new URL(u,base);if(a.origin!==base.origin)throw Error('URL fuera del dominio: '+a.href);return a;};
async function local(u){let a=allowed(u), p=decodeURIComponent(a.pathname).replace(/^\/+/,''), full=path.resolve(root,p);if(full!==root&&!full.startsWith(root+path.sep))throw Error('Ruta no permitida');for(const f of (a.pathname.endsWith('/')?[path.join(full,'index.html')]:[full,path.join(full,'index.html'),full+'.html'])){try{if((await fs.stat(f)).isFile())return {body:await fs.readFile(f,'utf8'),status:'LOCAL',final:a.href,file:path.relative(root,f)};}catch(e){if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}}return {body:'',status:'ARCHIVO_NO_ENCONTRADO',final:a.href,file:''};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function live(u){let current=allowed(u).href, chain=[];for(let hop=0;hop<=8;hop++){let response;for(let attempt=0;attempt<3;attempt++){try{response=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'TallerMap-SEO-Audit/1.0'}});if(![429,502,503,504].includes(response.status)||attempt===2)break;await response.body?.cancel();await sleep(1000*2**attempt);}catch(e){if(attempt===2)throw e;await sleep(1000*2**attempt);}}if([301,302,303,307,308].includes(response.status)&&response.headers.get('location')){chain.push(response.status+' '+current);let next=new URL(response.headers.get('location'),current);await response.body?.cancel();if(next.origin!==base.origin)return {body:'',status:'REDIRECCION_EXTERNA',final:next.href,chain};if(next.href===current||chain.some(x=>x.endsWith(' '+next.href)))return {body:'',status:'BUCLE_REDIRECCION',final:next.href,chain};current=next.href;continue;}return {body:await response.text(),status:response.status,final:current,chain,robots:response.headers.get('x-robots-tag')??'',type:response.headers.get('content-type')??''};}return {body:'',status:'DEMASIADAS_REDIRECCIONES',final:current,chain};}
const read=opt.live?live:local;
const seenMaps=new Set(), urls=new Set();
async function sitemap(u){u=allowed(u).href;if(seenMaps.has(u))return;seenMaps.add(u);let r=await read(u);if(![200,'LOCAL'].includes(r.status))throw Error('Sitemap inaccesible: '+u+' ('+r.status+')');const locs=list(r.body,'loc');if(!locs.length)throw Error('Sitemap sin loc: '+u);if(/<sitemapindex\b/i.test(r.body)){for(const loc of locs)await sitemap(loc);}else if(/<urlset\b/i.test(r.body)){for(const loc of locs)urls.add(allowed(loc).href);}else throw Error('XML no reconocido: '+u);}
await sitemap(new URL('/sitemap-index.xml',base).href);
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4])]));}

const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const key=u=>{const a=new URL(u,base);if(!['http:','https:'].includes(a.protocol)||![base.hostname,base.hostname.replace(/^www\./,'')].includes(a.hostname))return null;a.hash='';a.protocol=base.protocol;a.host=base.host;return a.href;};
const route=u=>new URL(u).pathname.replace(/\/+$/,'')||'/';
const rules=(config.redirects??[]).filter(r=>!r.missing&&!/[:*()]/.test(r.source)&&(r.has??[]).every(c=>c.type==='query'&&typeof c.value==='string'&&!/[^a-zA-Z0-9_-]/.test(c.value)));
function matchingRule(u){const a=new URL(u);return rules.find(r=>(r.source.replace(/\/+$/,'')||'/')===route(u)&&(r.has??[]).every(c=>a.searchParams.getAll(c.key).includes(c.value)));}
const sitemapKeys=new Set([...urls].map(key));
const incoming=new Map(), links=new Map(), sourceErrors=[];
function csvParse(s){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){rows.push(row);row=[];}}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
const gsc=opt.gsc?csvParse((await fs.readFile(opt.gsc,'utf8')).replace(/^\uFEFF/,'' )).slice(1).filter(r=>r[0]?.startsWith('http')):[];
// Clasificaciones históricas: solo se aplican a la URL exacta del CSV.
const classifications=new Map();
try {
  const records=csvParse((await fs.readFile(path.join(root,'scripts/audit-data/gsc-404-clasificacion.csv'),'utf8')).replace(/^\uFEFF/,''));
  const expected=['url','id_prefijo','nombre','clasificacion','evidencia','fecha_revision'];
  if(records.shift()?.join(',')!==expected.join(',')) throw Error('Cabecera de clasificación incorrecta');
  for(const [url,id,nombre,clasificacion,evidencia,fecha_revision] of records){
    if(!url)continue;
    const k=key(url);
    if(!k||!evidencia?.trim()||!['404_JUSTIFICADO_HISTORICO','PENDIENTE_VERIFICACION'].includes(clasificacion))throw Error('Clasificación inválida: '+url);
    if(classifications.has(k))throw Error('Clasificación duplicada: '+url);
    classifications.set(k,{clasificacion,evidencia,fecha_revision});
  }
}catch(e){if(e.code!=='ENOENT')throw e;}
const pool=async(items,fn)=>{let i=0;await Promise.all(Array.from({length:concurrency},async()=>{while(i<items.length){const item=items[i++];await fn(item);if(opt.live)await sleep(150);}}));};
await pool([...urls],async source=>{try{const r=await read(source);if(![200,'LOCAL'].includes(r.status)){sourceErrors.push({url:source,estado:r.status});return;}const html=r.body.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');const bt=html.match(/<base\b(?:[^>"']|"[^"]*"|'[^']*')*>/i);const resolution=bt?new URL(attrs(bt[0]).href??source,r.final).href:r.final;
for(const m of html.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)){const href=attrs(m[0]).href;if(!href||href.startsWith('#'))continue;let dest;try{dest=key(new URL(href,resolution).href);}catch{continue;}if(!dest)continue;const set=links.get(dest)??new Set();set.add(source);links.set(dest,set);if(dest!==key(source)){const inc=incoming.get(dest)??new Set();inc.add(source);incoming.set(dest,inc);}}
}catch(e){sourceErrors.push({url:source,estado:e.message});}});
const candidates=new Map();
for(const u of sitemapKeys){const p=route(u),m=p.match(/^\/talleres\/(.+)-([a-f0-9]{8})$/i);if(m){for(const k of [m[1],m[2]]){const a=candidates.get(k)??[];a.push(u);candidates.set(k,a);}}}
function equivalents(u){const a=new URL(u),m=route(u).match(/^\/talleres\/(.+)-([a-f0-9]{8})$/i);const ids=[...a.searchParams.values()].filter(v=>/^[a-f0-9]{8}(?:-[a-f0-9-]+)?$/i.test(v)).map(v=>v.slice(0,8));const keys=m?[m[1],m[2]]:ids;return [...new Set(keys.flatMap(k=>candidates.get(k)??[]))].filter(v=>v!==u);}
const results=new Map();
async function check(u){if(results.has(u))return;let current=u,chain=[],status='',detail='';try{if(opt.live){const r=await live(u);status=String(r.status);current=r.final;chain=r.chain??[];}else{const seen=new Set();while(matchingRule(current)){if(seen.has(current)||chain.length>=20){status='BUCLE_O_CADENA_EXCESIVA';break;}seen.add(current);const rule=matchingRule(current);chain.push(current);const next=key(new URL(rule.destination,current).href);if(!next){status='REDIRECCION_EXTERNA';break;}current=next;}if(!status){const r=await local(current);status=r.status==='LOCAL'?'ARCHIVO_EXISTE':'NO_ENCONTRADO_LOCAL';if(new URL(current).search)detail='Los parámetros no se validan en modo local';}}}catch(e){status='ERROR_COMPROBACION';detail=e.message;}results.set(u,{url:u,estado:status,destino_final:current,saltos:chain.length,cadena:chain.join(' | '),detalle:detail,en_sitemap:sitemapKeys.has(u),origenes:links.get(u)?.size??0,candidatas:equivalents(u).join(' | ')});}
await pool([...new Set([...links.keys(),...gsc.map(r=>key(r[0])).filter(Boolean),...sitemapKeys])],check);
const all=[...results.values()],bad=all.filter(r=>['404','410','NO_ENCONTRADO_LOCAL','BUCLE_O_CADENA_EXCESIVA','BUCLE_REDIRECCION'].includes(r.estado));
const edges=bad.flatMap(r=>[...(links.get(r.url)??[])].map(origen=>({...r,origen})));
const gscRows=gsc.map(([url,ultimo_rastreo])=>{
  const result=results.get(key(url))??{}, documented=classifications.get(key(url))??{};
  const redirected=result.saltos>0&&['ARCHIVO_EXISTE','200'].includes(result.estado);
  const justified=['404','410','NO_ENCONTRADO_LOCAL'].includes(result.estado)&&documented.clasificacion==='404_JUSTIFICADO_HISTORICO'&&!result.origenes&&!result.en_sitemap;
  return {...result,url_original:url,ultimo_rastreo,...documented,resolucion:redirected?'REDIRECCION_CON_DESTINO':justified?'BAJA_JUSTIFICADA_HISTORICA':'PENDIENTE'};
});
const orphans=[...sitemapKeys].filter(u=>route(u)!=='/'&&!incoming.has(u)).map(url=>({url,nota:'Sin enlaces entrantes desde HTML de páginas del sitemap; no incluye JS'}));
const csvCell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
await fs.mkdir(out,{recursive:true});
async function save(name,rows,headers){await fs.writeFile(path.join(out,name),'\ufeff'+[headers.join(';'),...rows.map(r=>headers.map(h=>csvCell(r[h])).join(';'))].join('\r\n')+'\r\n');}
const headers=['url','estado','destino_final','saltos','cadena','detalle','en_sitemap','origenes','candidatas'];
await save('enlaces-rotos.csv',edges,['origen',...headers]);
await save('errores-404-gsc.csv',gscRows,['url_original','ultimo_rastreo',...headers,'clasificacion','evidencia','fecha_revision','resolucion']);
await save('redirecciones-existentes.csv',all.filter(r=>r.saltos),headers);
await save('posibles-equivalencias.csv',gscRows.filter(r=>r.candidatas),['url_original',...headers]);
await save('paginas-huerfanas.csv',orphans,['url','nota']);
await save('destinos-todos.csv',all,headers);
await save('origenes-no-leidos.csv',sourceErrors,['url','estado']);
const gscEstados={};for(const r of gscRows)gscEstados[r.estado??'FUERA_DOMINIO']=(gscEstados[r.estado??'FUERA_DOMINIO']??0)+1;
const gscResolucion={};for(const r of gscRows)gscResolucion[r.resolucion]=(gscResolucion[r.resolucion]??0)+1;
await save('gsc-pendientes.csv',gscRows.filter(r=>r.resolucion==='PENDIENTE'),['url_original','ultimo_rastreo',...headers,'clasificacion','evidencia','fecha_revision','resolucion']);
const summary={gsc_resolucion:gscResolucion,gsc_porcentaje_clasificado:gscRows.length?Number((100*(gscRows.length-(gscResolucion.PENDIENTE??0))/gscRows.length).toFixed(2)):null,modo:opt.live?'web':'local',paginas_sitemap:urls.size,origenes_no_leidos:sourceErrors.length,destinos:all.length,enlaces_problematicos:edges.length,destinos_problematicos:bad.length,gsc_total:gscRows.length,gsc_estados:gscEstados,gsc_con_enlaces:gscRows.filter(r=>r.origenes>0).length,gsc_con_candidatas:gscRows.filter(r=>r.candidatas).length,redirecciones:all.filter(r=>r.saltos).length,paginas_sin_entrantes:orphans.length};
await fs.writeFile(path.join(out,'resumen.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
