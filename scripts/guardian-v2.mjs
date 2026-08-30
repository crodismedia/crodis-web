#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const ROOT = process.cwd();
const OUT = path.resolve(args.out || 'audit-reports');
fs.mkdirSync(OUT,{recursive:true});
const report={version:2,startedAt:new Date().toISOString(),files:0,issues:[],metrics:{},legacy:null,npmAudit:null,score:100};
const IGNORE = new Set(['node_modules','.git','.vercel','dist','build','out','coverage','quality-reports','audit-reports']);
const CODE_EXT = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.css','.json','.yml','.yaml']);
function add(severity,type,file,message,extra={}){report.issues.push({severity,type,file,message,...extra});}
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(IGNORE.has(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else if(CODE_EXT.has(path.extname(e.name).toLowerCase()))out.push(p);}return out;}
function rel(p){return path.relative(ROOT,p).replaceAll('\\','/');}
function sha(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function runLegacy(){try{const r=spawnSync(process.execPath,['quality-guard.cjs','--ci'],{cwd:ROOT,encoding:'utf8'});report.legacy={status:r.status,stdout:r.stdout?.slice(-12000),stderr:r.stderr?.slice(-4000)};if(r.status!==0)add('error','legacy-guardian','quality-guard.cjs',`Guardian V1 terminó con código ${r.status}`);}catch(e){add('error','legacy-guardian','quality-guard.cjs',String(e));}}
function runNpmAudit(){try{const r=spawnSync('npm',['audit','--json','--omit=dev'],{cwd:ROOT,encoding:'utf8',timeout:120000,shell:process.platform==='win32'});let data=null;try{data=JSON.parse(r.stdout||'{}');}catch{}report.npmAudit={status:r.status,metadata:data?.metadata||null,vulnerabilities:data?.vulnerabilities||null,error:r.stderr?.slice(-2000)||null};const v=data?.metadata?.vulnerabilities;if(v){for(const sev of ['critical','high','moderate','low'])if(v[sev])add(sev==='critical'||sev==='high'?'error':'warning','dependency-vulnerability','package.json',`${v[sev]} vulnerabilidades ${sev}`);}}catch(e){add('warning','npm-audit','package.json',`npm audit no pudo completarse: ${String(e)}`);}}

function scan(){const files=walk(ROOT);report.files=files.length;const hashes=new Map();let totalBytes=0,totalLines=0;
 const secretRules=[
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token',/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['google-api-key',/\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['jwt',/\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/]
 ];
 for(const f of files){let buf;try{buf=fs.readFileSync(f);}catch{continue;}totalBytes+=buf.length;const text=buf.toString('utf8');totalLines+=text.split('\n').length;const r=rel(f);
   if(buf.length>1024*1024)add('warning','large-file',r,`Archivo de ${(buf.length/1024/1024).toFixed(2)} MB`);
   if(/<<<<<<<|=======\n|>>>>>>>/.test(text))add('error','merge-marker',r,'Marcadores de conflicto Git detectados');
   for(const [type,re] of secretRules)if(re.test(text))add('error','secret',r,`Posible secreto expuesto (${type})`);
   if(/\beval\s*\(/.test(text)||/new\s+Function\s*\(/.test(text))add('error','unsafe-js',r,'eval/new Function detectado');
   if(/document\.write\s*\(/.test(text))add('warning','unsafe-dom',r,'document.write detectado');
   if(/\.innerHTML\s*=/.test(text))add('warning','xss-surface',r,'Asignación a innerHTML; revisar sanitización');
   if(/\bhttp:\/\//.test(text)&&!/localhost|127\.0\.0\.1|schema\.org/.test(text))add('warning','mixed-content-risk',r,'Referencia HTTP no segura detectada');
   if(/TODO|FIXME/.test(text)){const n=(text.match(/TODO|FIXME/g)||[]).length;if(n>10)add('warning','technical-debt',r,`${n} TODO/FIXME`);}
   const h=sha(buf);if(!hashes.has(h))hashes.set(h,[]);hashes.get(h).push(r);
   if(['.js','.mjs','.cjs'].includes(path.extname(f))){const chk=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(chk.status!==0)add('error','syntax',r,'Node --check falló',{detail:chk.stderr?.slice(0,1000)});}
 }
 for(const paths of hashes.values())if(paths.length>1){const meaningful=paths.filter(p=>!p.includes('/generated/'));if(meaningful.length>1)add('warning','duplicate-file',meaningful[0],`${meaningful.length} archivos idénticos`,{files:meaningful.slice(0,20)});}
 report.metrics={totalBytes,totalLines,duplicateGroups:report.issues.filter(i=>i.type==='duplicate-file').length};
}
function structuralChecks(){for(const f of ['package.json','vercel.json','robots.txt'])if(!fs.existsSync(path.join(ROOT,f)))add('warning','missing-config',f,'Archivo esperado no existe');
 const apiDir=path.join(ROOT,'api');if(fs.existsSync(apiDir)){const api=walk(apiDir).filter(f=>['.js','.mjs','.cjs'].includes(path.extname(f)));for(const f of api){const t=fs.readFileSync(f,'utf8');if(!/try\s*\{|\.catch\s*\(/.test(t))add('warning','api-error-handling',rel(f),'Endpoint sin manejo de errores evidente');if(!/method|req\.method|request\.method/i.test(t))add('warning','api-method-guard',rel(f),'Endpoint sin validación de método HTTP evidente');}}
}
function score(){const p=report.issues.reduce((s,i)=>s+(i.severity==='error'?3:i.severity==='warning'?0.4:0),0);report.score=Math.max(0,Math.round((100-p)*10)/10);}
function md(){const e=report.issues.filter(i=>i.severity==='error').length,w=report.issues.filter(i=>i.severity==='warning').length;return `# Guardian V2\n\nFecha: ${report.finishedAt}\n\n- Score: **${report.score}/100**\n- Archivos: **${report.files}**\n- Líneas: **${report.metrics.totalLines||0}**\n- Errores: **${e}**\n- Advertencias: **${w}**\n- Guardian V1: **${report.legacy?.status===0?'OK':'ERROR'}**\n\n## Hallazgos\n\n${report.issues.slice(0,250).map(i=>`- **${i.severity.toUpperCase()} · ${i.type}** — ${i.file}: ${i.message}`).join('\n')||'Ninguno'}\n`;}
function main(){console.log('🛡️ Guardian V2 profundo');runLegacy();scan();structuralChecks();runNpmAudit();score();report.finishedAt=new Date().toISOString();const stamp=report.finishedAt.replace(/[:.]/g,'-');const jp=path.join(OUT,`guardian-v2-${stamp}.json`),mp=path.join(OUT,`guardian-v2-${stamp}.md`);fs.writeFileSync(jp,JSON.stringify(report,null,2));fs.writeFileSync(mp,md());const e=report.issues.filter(i=>i.severity==='error').length,w=report.issues.filter(i=>i.severity==='warning').length;console.log(`✅ Guardian V2 ${report.score}/100 | ${e} errores | ${w} advertencias`);console.log(jp);if(args.strict&&e)process.exitCode=1;}
main();
