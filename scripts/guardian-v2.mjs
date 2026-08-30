#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const ROOT = process.cwd();
const OUT = path.resolve(args.out || 'audit-reports');
fs.mkdirSync(OUT,{recursive:true});
const report={version:'2.2',startedAt:new Date().toISOString(),files:0,issues:[],metrics:{},legacy:null,npmAudit:null,envVars:[],score:100};
const IGNORE = new Set(['node_modules','.git','.vercel','dist','build','out','coverage','quality-reports','audit-reports']);
const CODE_EXT = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.htm','.css','.scss','.json','.yml','.yaml','.md']);
const TEXT_EXT = new Set([...CODE_EXT,'.txt','.xml','.svg']);
const PROD_DIRS = ['api','lib','municipios','pages','provincias','servicios','talleres','templates','css','js','scripts'];

function add(severity,type,file,message,extra={}){report.issues.push({severity,type,file,message,...extra});}
function walk(dir,out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(IGNORE.has(e.name))continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())walk(p,out); else if(TEXT_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/');}
function sha(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function safeRead(file){try{return fs.readFileSync(file,'utf8');}catch{return null;}}
function lineOf(text,index){return text.slice(0,index).split('\n').length;}
function unique(arr){return [...new Set(arr)];}

function runLegacy(){
  try{
    const r=spawnSync(process.execPath,['quality-guard.cjs','--ci'],{cwd:ROOT,encoding:'utf8',maxBuffer:20*1024*1024});
    report.legacy={status:r.status,stdout:r.stdout?.slice(-20000),stderr:r.stderr?.slice(-6000)};
    if(r.status!==0)add('error','legacy-guardian','quality-guard.cjs',`Guardian V1 terminó con código ${r.status}`);
  }catch(e){add('error','legacy-guardian','quality-guard.cjs',String(e));}
}

function runNpmAudit(){
  try{
    const r=spawnSync('npm',['audit','--json','--omit=dev'],{cwd:ROOT,encoding:'utf8',shell:process.platform==='win32',maxBuffer:50*1024*1024});
    let data=null;try{data=JSON.parse(r.stdout||'{}');}catch{}
    report.npmAudit={status:r.status,metadata:data?.metadata||null,vulnerabilities:data?.vulnerabilities||null,error:r.stderr?.slice(-4000)||null};
    const v=data?.metadata?.vulnerabilities;
    if(v){for(const sev of ['critical','high','moderate','low'])if(v[sev])add(sev==='critical'||sev==='high'?'error':'warning','dependency-vulnerability','package.json',`${v[sev]} vulnerabilidades ${sev}`);}
  }catch(e){add('warning','npm-audit','package.json',`npm audit no pudo completarse: ${String(e)}`);}
}

function scanSecretsAndCode(files){
  const hashes=new Map(); let totalBytes=0,totalLines=0,jsFiles=0,htmlFiles=0,cssFiles=0;
  const secretRules=[
    ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['github-token',/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g],
    ['google-api-key',/\bAIza[0-9A-Za-z_-]{30,}\b/g],
    ['jwt',/\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g],
    ['supabase-service-role',/SUPABASE_(?:SERVICE_ROLE|SERVICE_KEY)\s*[:=]\s*["'][^"']{20,}["']/gi]
  ];
  const envVars=[];

  for(const f of files){
    let buf;try{buf=fs.readFileSync(f);}catch{continue;}
    const ext=path.extname(f).toLowerCase(), text=buf.toString('utf8'), r=rel(f);
    totalBytes+=buf.length; totalLines+=text.split('\n').length;
    if(['.js','.mjs','.cjs','.ts','.tsx','.jsx'].includes(ext))jsFiles++;
    if(['.html','.htm'].includes(ext))htmlFiles++;
    if(['.css','.scss'].includes(ext))cssFiles++;

    if(buf.length>2*1024*1024)add('warning','large-file',r,`Archivo de ${(buf.length/1024/1024).toFixed(2)} MB`);
    if(/<<<<<<<|=======\n|>>>>>>>/.test(text))add('error','merge-marker',r,'Marcadores de conflicto Git detectados');
    for(const [type,re] of secretRules){re.lastIndex=0;const m=re.exec(text);if(m)add('error','secret',r,`Posible secreto expuesto (${type})`,{line:lineOf(text,m.index)});}

    for(const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g))envVars.push(m[1]);
    for(const m of text.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g))envVars.push(m[1]);

    if(/\beval\s*\(/.test(text)||/new\s+Function\s*\(/.test(text))add('error','unsafe-js',r,'eval/new Function detectado');
    if(/document\.write\s*\(/.test(text))add('warning','unsafe-dom',r,'document.write detectado');
    if(/\.innerHTML\s*=/.test(text))add('warning','xss-surface',r,'Asignación a innerHTML; revisar sanitización');
    if(/\.outerHTML\s*=/.test(text))add('warning','xss-surface',r,'Asignación a outerHTML; revisar sanitización');
    if(/insertAdjacentHTML\s*\(/.test(text))add('warning','xss-surface',r,'insertAdjacentHTML detectado; revisar sanitización');
    if(/\blocalStorage\.(?:setItem|getItem)\s*\([^)]*(?:token|secret|password|passwd|apikey|api_key)/i.test(text))add('warning','client-secret-storage',r,'Posible credencial almacenada en localStorage');
    if(/\bhttp:\/\//.test(text)&&!/localhost|127\.0\.0\.1|schema\.org|www\.w3\.org/.test(text))add('warning','mixed-content-risk',r,'Referencia HTTP no segura detectada');
    if(/TODO|FIXME/.test(text)){const n=(text.match(/TODO|FIXME/g)||[]).length;if(n>10)add('warning','technical-debt',r,`${n} TODO/FIXME`);}
    if(/console\.(?:log|debug)\s*\(/.test(text) && /^(api|lib|js|scripts)\//.test(r)){const n=(text.match(/console\.(?:log|debug)\s*\(/g)||[]).length;if(n>10)add('warning','console-noise',r,`${n} console.log/debug en código operativo`);}

    if(['.js','.mjs','.cjs'].includes(ext)){
      const chk=spawnSync(process.execPath,['--check',f],{encoding:'utf8',maxBuffer:4*1024*1024});
      if(chk.status!==0)add('error','syntax',r,'Node --check falló',{detail:chk.stderr?.slice(0,1500)});
    }

    if(['.html','.htm'].includes(ext)) analyzeStaticHtml(text,r);
    if(['.css','.scss'].includes(ext)) analyzeCss(text,r);

    const h=sha(buf);if(!hashes.has(h))hashes.set(h,[]);hashes.get(h).push(r);
  }

  for(const paths of hashes.values())if(paths.length>1){
    const meaningful=paths.filter(p=>!p.includes('/generated/')&&!/sitemap.*\.xml$/i.test(p));
    if(meaningful.length>1)add('warning','duplicate-file',meaningful[0],`${meaningful.length} archivos idénticos`,{files:meaningful.slice(0,30)});
  }
  report.envVars=unique(envVars).sort();
  report.metrics={totalBytes,totalLines,jsFiles,htmlFiles,cssFiles,duplicateGroups:report.issues.filter(i=>i.type==='duplicate-file').length};
}

function analyzeStaticHtml(text,file){
  if(!/<!doctype html>/i.test(text))add('warning','html-doctype',file,'Falta <!DOCTYPE html>');
  if(!/<html\b[^>]*\blang\s*=/i.test(text))add('warning','html-lang',file,'Falta lang en <html>');
  if(!/<meta\b[^>]*name=["']viewport["']/i.test(text))add('warning','html-viewport',file,'Falta meta viewport');
  const h1=(text.match(/<h1\b/gi)||[]).length;if(h1!==1)add(h1===0?'error':'warning','html-h1',file,`Número de H1: ${h1}`);
  const title=(text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1];if(!title?.trim())add('error','html-title',file,'Falta <title>');
  const imgs=text.match(/<img\b[^>]*>/gi)||[];const missing=imgs.filter(t=>!(/\balt\s*=/i.test(t)));if(missing.length)add('error','html-alt',file,`${missing.length}/${imgs.length} imágenes sin alt`);
  const emptyLinks=[...text.matchAll(/<a\b[^>]*href\s*=\s*["']\s*(?:#)?\s*["']/gi)];if(emptyLinks.length)add('warning','empty-link',file,`${emptyLinks.length} enlaces vacíos o #`);
}

function analyzeCss(text,file){
  const imp=(text.match(/!important/g)||[]).length;if(imp>20)add('warning','css-important',file,`${imp} usos de !important`);
  const badUrl=[...text.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/gi)].map(m=>m[2]).filter(u=>u.startsWith('http://')&&!/localhost|127\.0\.0\.1/.test(u));
  if(badUrl.length)add('warning','css-http-url',file,`${badUrl.length} recursos CSS por HTTP`);
}

function structuralChecks(){
  for(const f of ['package.json','vercel.json','robots.txt'])if(!fs.existsSync(path.join(ROOT,f)))add('warning','missing-config',f,'Archivo esperado no existe');
  const apiDir=path.join(ROOT,'api');
  if(fs.existsSync(apiDir)){
    const api=walk(apiDir).filter(f=>['.js','.mjs','.cjs','.ts'].includes(path.extname(f)));
    for(const f of api){
      const t=safeRead(f)||'', r=rel(f);
      if(!/try\s*\{|\.catch\s*\(/.test(t))add('warning','api-error-handling',r,'Endpoint sin manejo de errores evidente');
      if(!/method|req\.method|request\.method/i.test(t))add('warning','api-method-guard',r,'Endpoint sin validación de método HTTP evidente');
      if(/Access-Control-Allow-Origin["'\s,:=]+\*/i.test(t))add('warning','cors-wildcard',r,'CORS permite *; verificar si es intencionado');
      if(/JSON\.parse\s*\(/.test(t)&&!/try\s*\{[\s\S]{0,1200}JSON\.parse/.test(t))add('warning','json-parse-unguarded',r,'JSON.parse sin try/catch cercano');
      if(/res\.status\(500\).*error\.message|JSON\.stringify\([^)]*error/i.test(t))add('warning','error-leak',r,'Posible exposición de detalle interno en respuesta de error');
    }
  }
  validatePackageScripts();
  validateVercelConfig();
  validateRelativeReferences();
}

function validatePackageScripts(){
  const p=path.join(ROOT,'package.json'); if(!fs.existsSync(p))return;
  try{
    const pkg=JSON.parse(fs.readFileSync(p,'utf8'));
    for(const [name,cmd] of Object.entries(pkg.scripts||{})){
      for(const m of cmd.matchAll(/(?:node|bash)\s+([^\s;&|]+)/g)){
        const target=m[1].replace(/^['"]|['"]$/g,'');
        if(target.startsWith('-')||target.includes('$')||/^https?:/.test(target))continue;
        const fp=path.resolve(ROOT,target); if(!fs.existsSync(fp))add('error','broken-package-script','package.json',`Script ${name} apunta a archivo inexistente: ${target}`);
      }
    }
  }catch(e){add('error','package-json','package.json',`No se pudo validar package.json: ${e.message}`);}
}

function validateVercelConfig(){
  const p=path.join(ROOT,'vercel.json');if(!fs.existsSync(p))return;
  try{
    const cfg=JSON.parse(fs.readFileSync(p,'utf8'));
    const collections=[...(cfg.rewrites||[]),...(cfg.redirects||[])];
    for(const x of collections){if(x.destination && x.destination.startsWith('/') && !/[?:*]/.test(x.destination)){
      const local=path.join(ROOT,x.destination.replace(/^\//,''));
      if(/\.(?:html|js|json|xml|txt)$/i.test(local)&&!fs.existsSync(local))add('warning','vercel-target-missing','vercel.json',`Destino no existe en repositorio: ${x.destination}`);
    }}
  }catch(e){add('error','vercel-json','vercel.json',`JSON inválido: ${e.message}`);}
}

function validateRelativeReferences(){
  const roots=PROD_DIRS.map(d=>path.join(ROOT,d)).filter(fs.existsSync);
  const files=roots.flatMap(d=>walk(d)).filter(f=>['.html','.htm','.css'].includes(path.extname(f).toLowerCase()));
  let checked=0;
  for(const f of files){const text=safeRead(f);if(text===null)continue;const r=rel(f);
    const refs=[];
    if(/\.html?$/.test(f)){
      for(const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))refs.push(m[1]);
    }else{
      for(const m of text.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/gi))refs.push(m[2]);
    }
    for(const raw of refs){if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw))continue;
      const clean=raw.split('#')[0].split('?')[0];if(!clean)continue;
      let target;
      if(clean.startsWith('/'))target=path.join(ROOT,clean.replace(/^\//,'')); else target=path.resolve(path.dirname(f),clean);
      if(clean.endsWith('/'))continue;
      checked++;
      if(!fs.existsSync(target)&&!fs.existsSync(`${target}.html`)&&!fs.existsSync(path.join(target,'index.html')))add('warning','broken-static-reference',r,`Referencia local no encontrada: ${raw}`);
    }
  }
  report.metrics.staticReferencesChecked=checked;
}

function score(){
  const weights={error:2.5,warning:0.35,info:0};
  const p=report.issues.reduce((s,i)=>s+(weights[i.severity]||0),0);
  report.score=Math.max(0,Math.round((100-p)*10)/10);
}
function md(){
  const e=report.issues.filter(i=>i.severity==='error').length,w=report.issues.filter(i=>i.severity==='warning').length;
  const groups=Object.entries(report.issues.reduce((a,i)=>(a[i.type]=(a[i.type]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]);
  return `# Guardian V2.2\n\nFecha: ${report.finishedAt}\n\n- Score: **${report.score}/100**\n- Archivos: **${report.files}**\n- Líneas: **${report.metrics.totalLines||0}**\n- Referencias estáticas comprobadas: **${report.metrics.staticReferencesChecked||0}**\n- Variables de entorno referenciadas: **${report.envVars.length}**\n- Errores: **${e}**\n- Advertencias: **${w}**\n- Guardian V1: **${report.legacy?.status===0?'OK':'ERROR'}**\n\n## Categorías\n${groups.map(([k,v])=>`- ${k}: ${v}`).join('\n')||'- Sin hallazgos'}\n\n## Hallazgos\n\n${report.issues.slice(0,1000).map(i=>`- **${i.severity.toUpperCase()} · ${i.type}** — ${i.file}: ${i.message}`).join('\n')||'Ninguno'}\n`;
}
function main(){
  console.log('🛡️ Guardian V2.2 profundo');
  runLegacy();
  const files=walk(ROOT);report.files=files.length;
  scanSecretsAndCode(files);structuralChecks();runNpmAudit();score();
  report.finishedAt=new Date().toISOString();
  const stamp=report.finishedAt.replace(/[:.]/g,'-');
  const jp=path.join(OUT,`guardian-v2-${stamp}.json`),mp=path.join(OUT,`guardian-v2-${stamp}.md`);
  fs.writeFileSync(jp,JSON.stringify(report,null,2));fs.writeFileSync(mp,md());
  const e=report.issues.filter(i=>i.severity==='error').length,w=report.issues.filter(i=>i.severity==='warning').length;
  console.log(`✅ Guardian V2.2 ${report.score}/100 | ${e} errores | ${w} advertencias`);console.log(jp);
  if(args.strict&&e)process.exitCode=1;
}
main();
