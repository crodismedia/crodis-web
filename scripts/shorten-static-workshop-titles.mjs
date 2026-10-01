import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DIR=path.join(ROOT,'talleres');
const MAX=65;

function decodeHtml(value){
  return String(value??'')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}
function esc(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function makeTitle(name,city){
  const full=`${name} | Taller en ${city} | TallerMap`;
  if(full.length<=MAX)return full;
  const compact=`${name} | ${city} | TallerMap`;
  if(compact.length<=MAX)return compact;
  const brandOnly=`${name} | TallerMap`;
  if(brandOnly.length<=MAX)return brandOnly;
  const suffix=' | TallerMap';
  const max=Math.max(20,MAX-suffix.length-1);
  let short=name.slice(0,max).trim();
  const cut=short.lastIndexOf(' ');
  if(cut>=Math.floor(max*0.65))short=short.slice(0,cut).trim();
  return `${short}…${suffix}`;
}

if(!fs.existsSync(DIR))throw new Error('No existe /talleres');

let scanned=0,changed=0,stillLong=0;
for(const entry of fs.readdirSync(DIR,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const file=path.join(DIR,entry.name,'index.html');
  if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  const titleMatch=html.match(/<title>([\s\S]*?)<\/title>/i);
  if(!titleMatch)continue;
  scanned++;
  const current=decodeHtml(titleMatch[1].replace(/<[^>]+>/g,'')).trim();
  if(current.length<=MAX)continue;

  const nameMatch=html.match(/<h1[^>]*id=["']taller-nombre["'][^>]*>([\s\S]*?)<\/h1>/i);
  const cityMatch=html.match(/<p><strong>Municipio:<\/strong>\s*([\s\S]*?)<\/p>/i);
  if(!nameMatch||!cityMatch)continue;

  const name=decodeHtml(nameMatch[1].replace(/<[^>]+>/g,'')).trim();
  const city=decodeHtml(cityMatch[1].replace(/<[^>]+>/g,'')).trim();
  if(!name||!city)continue;

  const next=makeTitle(name,city);
  if(next.length>MAX)stillLong++;
  html=html.replace(titleMatch[0],`<title>${esc(next)}</title>`);
  fs.writeFileSync(file,html,'utf8');
  changed++;
}
console.log(`TITLES_ESCANEADOS=${scanned}`);
console.log(`TITLES_ACORTADOS=${changed}`);
console.log(`TITLES_AUN_LARGOS=${stillLong}`);
if(stillLong>0)process.exitCode=1;
