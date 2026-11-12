import fs from "node:fs";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const catalog=JSON.parse(read("data/catalogo-marcas-modelos-preliminar.json"));
const faults=JSON.parse(read("data/averias-habituales.json"));
const map=JSON.parse(read("data/averias-servicios.json"));
const html=read("buscar-reparacion.html");
const precios=JSON.parse(read("data/referencias-precios-reparacion.json"));
const preciosJs=read("js/precios-reparacion.js");
const js=read("js/buscador-reparacion.js");
assert.equal(Object.keys(catalog.marcas).length,35,"Se esperan 35 marcas iniciales");
for(const [name,models] of Object.entries(catalog.marcas)){
 assert.ok(models.length>0,"Marca sin modelos: "+name);
 assert.equal(models.length,new Set(models.map(m=>m.toLowerCase())).size,"Modelos repetidos: "+name);
}
assert.equal(faults.opciones.length,30,"Se esperan 30 síntomas");
assert.ok(precios.precios.length>=12,"Fuentes de precios insuficientes");
for(const r of precios.precios){assert.ok(r.min>0&&r.max>=r.min&&r.url.startsWith("https://"),"Referencia de precios inválida");}
assert.ok(preciosJs.includes("MIN_WAIT=180000"),"Debe esperar tres minutos completos");
assert.ok(preciosJs.includes("results.sort((a,b)=>a.min-b.min"),"Debe ordenar de menor a mayor");
assert.ok(!preciosJs.includes("/api/precios-reparacion"),"No usar nuevas funciones del plan Hobby");
for(const f of faults.opciones)assert.ok(map.relaciones[f.id]?.length,"Síntoma sin servicios: "+f.id);
for(const id of ["marca","modelo","motor","anio","cilindrada","potencia","averia","municipio","municipio-texto","estado","resultados","tarjetas","copiar-consulta","descripcion-precio","buscar-precio","resultado-precios","lista-precios","barra-precios","cuenta-precios"]){
 assert.ok(html.includes('id="'+id+'"'),"Falta campo: "+id);
}
for(const p of ["data/catalogo-marcas-modelos-preliminar.json","data/averias-habituales.json","data/averias-servicios.json","js/catalogo-municipios-estatico.js","js/precios-reparacion.js","data/referencias-precios-reparacion.json"])assert.ok(fs.existsSync(new URL("../"+p,import.meta.url)),"Falta archivo: "+p);
assert.ok(html.includes('name="description"')&&html.includes('rel="canonical"'),"Metadatos SEO incompletos");
assert.ok(!html.includes('noindex'),"La página no debe tener noindex");
assert.ok(js.includes('textContent')&&js.includes('new Option'),"Render seguro esperado");
const check=spawnSync(process.execPath,["--check",new URL("../js/buscador-reparacion.js",import.meta.url).pathname],{encoding:"utf8"});
assert.equal(check.status,0,check.stderr||"Error de sintaxis JS");
for(const p of ["js/precios-reparacion.js"]){
 const c=spawnSync(process.execPath,["--check",new URL("../"+p,import.meta.url).pathname],{encoding:"utf8"});
 assert.equal(c.status,0,c.stderr||"Error sintáctico en "+p);
}
console.log("Buscador de reparaciones y precios: validación estática correcta.");
