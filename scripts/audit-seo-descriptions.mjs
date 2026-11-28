import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
const {values: opt} = parseArgs({options:{live:{type:'boolean'},root:{type:'string',default:'.'},out:{type:'string',default:'audit-seo-descriptions'},base:{type:'string',default:'https://www.tallermap.es'},concurrency:{type:'string',default:'4'}}});
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
const rows=[];let pos=0,done=0;const queue=[...urls];
async function audit(url){
 const row={url,estado:'',url_final:'',archivo:'',titulo:'',descripcion:'',longitud:0,robots:'',canonical:'',redirecciones:'',anomalias:[],observaciones:[]};
 try{
  const r=await read(url);
  Object.assign(row,{estado:r.status,url_final:r.final,archivo:r.file??'',redirecciones:(r.chain??[]).join(' | ')});
  if(r.chain?.length)row.anomalias.push('REDIRECCION');
  if(![200,'LOCAL'].includes(r.status)){row.anomalias.push('NO_ACCESIBLE');return row;}
  if(r.type&&!/html/i.test(r.type)){row.anomalias.push('NO_HTML');return row;}
  const html=r.body.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
  const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1]??'';
  row.titulo=list(head,'title')[0]??'';
  const metas=[...head.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m=>attrs(m[0]));
  const descriptions=metas.filter(m=>/^description$/i.test((m.name??'').trim()));
  row.descripcion=(descriptions[0]?.content??'').replace(/\s+/g,' ').trim();
  row.longitud=[...row.descripcion].length;
  if(!descriptions.length)row.anomalias.push('DESCRIPTION_AUSENTE');
  else if(!row.descripcion)row.anomalias.push('DESCRIPTION_VACIA');
  if(descriptions.length>1)row.anomalias.push('VARIAS_DESCRIPTION');
  if(row.descripcion){
   if(row.longitud<70)row.observaciones.push('DESCRIPTION_CORTA');
   if(row.longitud>160)row.observaciones.push('DESCRIPTION_LARGA');
   if(/Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â€|�|ï¿½/.test(row.descripcion))row.anomalias.push('CODIFICACION_SOSPECHOSA');
   if(row.titulo&&norm(row.descripcion)===norm(row.titulo))row.observaciones.push('IGUAL_AL_TITULO');
   if(/(?:\.\.\.|…|\ben Taller)$/i.test(row.descripcion))row.observaciones.push('POSIBLE_TEXTO_TRUNCADO');
   if(/\/servicios\//.test(url)&&!/(valencia|valenciana|alicante|castell[oó]n)/i.test(row.descripcion))row.observaciones.push('SERVICIO_SIN_REFERENCIA_GEOGRAFICA');
  }
  row.robots=[...metas.filter(m=>/^(robots|googlebot)$/i.test(m.name??'')).map(m=>m.content??''),r.robots??''].filter(Boolean).join(' | ');
  if(/\b(noindex|none)\b/i.test(row.robots))row.anomalias.push('NOINDEX');
  if(/\b(nofollow|none)\b/i.test(row.robots))row.anomalias.push('NOFOLLOW');
  const canon=[...head.matchAll(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m=>attrs(m[0])).find(m=>/\bcanonical\b/i.test(m.rel??''));
  row.canonical=canon?.href??'';
  if(!row.canonical)row.observaciones.push('SIN_CANONICAL');
  else{try{if(new URL(row.canonical,r.final).href!==url)row.observaciones.push('CANONICAL_DIFERENTE');}catch{row.anomalias.push('CANONICAL_INVALIDA');}}
 }catch(e){row.estado='ERROR_LECTURA';row.anomalias.push('ERROR_LECTURA');row.observaciones.push(e.message);}
 return row;
}
console.log('Modo '+(opt.live?'WEB':'LOCAL')+' | '+seenMaps.size+' sitemaps | '+queue.length+' URL');
await Promise.all(Array.from({length:concurrency},async()=>{while(pos<queue.length){const url=queue[pos++];rows.push(await audit(url));if(++done%100===0||done===queue.length)console.log(done+'/'+queue.length);if(opt.live)await sleep(150);}}));
const groups=new Map();for(const r of rows){const k=norm(r.descripcion);if(k){if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}}for(const g of groups.values())if(g.length>1)for(const r of g)r.anomalias.push('DESCRIPTION_DUPLICADA_NORMALIZADA');
rows.sort((a,b)=>a.url.localeCompare(b.url));const counts={};for(const r of rows)for(const a of r.anomalias)counts[a]=(counts[a]??0)+1;
const observations={};for(const r of rows)for(const a of r.observaciones)observations[a]=(observations[a]??0)+1;
const headers=['url','estado','url_final','archivo','titulo','descripcion','longitud','robots','canonical','redirecciones','anomalias','observaciones'];const csvCell=v=>{let s=Array.isArray(v)?v.join(' | '):String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const csv=rs=>'\ufeff'+[headers.join(';'),...rs.map(r=>headers.map(h=>csvCell(r[h])).join(';'))].join('\r\n')+'\r\n';
await fs.mkdir(out,{recursive:true});const issues=rows.filter(r=>r.anomalias.length);await fs.writeFile(path.join(out,'descripciones-todos.csv'),csv(rows));await fs.writeFile(path.join(out,'descripciones-anomalias.csv'),csv(issues));await fs.writeFile(path.join(out,'descripciones-revision-manual.csv'),csv(rows.filter(r=>r.observaciones.length)));const summary={fecha:new Date().toISOString(),modo:opt.live?'web':'local',sitemaps:seenMaps.size,total:rows.length,con_anomalias:issues.length,sin_anomalias:rows.length-issues.length,grupos_duplicados:[...groups.values()].filter(g=>g.length>1).length,por_tipo:counts,con_observaciones:rows.filter(r=>r.observaciones.length).length,observaciones_por_tipo:observations};await fs.writeFile(path.join(out,'resumen.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));console.log('Informes: '+out);
