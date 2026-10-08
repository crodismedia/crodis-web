import fs from "node:fs";
import path from "node:path";
const ROOT=process.cwd();
const MAP=JSON.parse(fs.readFileSync(path.join(ROOT,"scripts/municipios-nombres-castellanos.json"),"utf8"));
const rows=fs.readFileSync(path.join(ROOT,"datos/municipios.csv"),"utf8").replace(/^\\uFEFF/,"").trim().split(/\\r?\\n/).slice(1).map(line=>line.split(";"));
const rules=[
 ...rows.filter(([name])=>name.includes("/")).map(([original,code])=>[original,MAP[code]]),
 ["Castellón/Castelló","Castellon"],["Castellón / Castelló","Castellon"],
 ["Alicante/Alacant","Alicante"],["Alicante / Alacant","Alicante"],
 ["Valencia/València","Valencia"],["Valencia / València","Valencia"]
].sort((a,b)=>b[0].length-a[0].length);
if(rules.some(([a,b])=>!a||!b||b.includes("/")))throw Error("Alias mal formado");
const normalizedRules=[];
for(const [from,to] of rules){
 for(const form of [from,from.replaceAll("/"," / "),from.replaceAll("'","&#x27;"),from.replaceAll("'","&#39;")]){
  if(!normalizedRules.some(x=>x[0]===form))normalizedRules.push([form,to]);
 }
}
let touched=0,seen=0,replaceTotal=0;
function transform(text){
 let out=text;
 for(const [original,name] of normalizedRules){
  if(out.includes(original)){const all=out.split(original);replaceTotal+=all.length-1;out=all.join(name);}
 }
 return out;
}
const folder=path.join(ROOT,"talleres");
for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const filename=path.join(folder,entry.name,"index.html");
 if(!fs.existsSync(filename))continue;
 const old=fs.readFileSync(filename,"utf8");
 if(!old.includes("<html"))continue;
 seen++;
 const originalCanonical=old.match(/<link\\b[^>]*\\brel="canonical"[^>]*href="([^"]+)"/i)?.[1];
 const originalHref=[...old.matchAll(/\\bhref="([^"]+)"/g)].map(m=>m[1]);
 const next=transform(old);
 const newCanonical=next.match(/<link\\b[^>]*\\brel="canonical"[^>]*href="([^"]+)"/i)?.[1];
 const newHref=[...next.matchAll(/\\bhref="([^"]+)"/g)].map(m=>m[1]);
 if(originalCanonical!==newCanonical || JSON.stringify(originalHref)!==JSON.stringify(newHref))
  throw Error("Enlaces modificados: "+filename);
 if(next!==old){fs.writeFileSync(filename,next,"utf8");touched++;}
}
console.log("FICHAS_REVISADAS="+seen);
console.log("FICHAS_CORREGIDAS="+touched);
console.log("NOMBRES_DOBLES_SUSTITUIDOS="+replaceTotal);
