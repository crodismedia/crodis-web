import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const source=path.join(process.cwd(),'scripts','sync-editor-v4-static.mjs');
const target=path.join(process.cwd(),'.sync-editor-v4-static-runtime.mjs');
const code=fs.readFileSync(source,'utf8').replace("itemListElement':","itemListElement:");
fs.writeFileSync(target,code,'utf8');
try{
  await import(pathToFileURL(target).href+`?t=${Date.now()}`);
} finally {
  fs.rmSync(target,{force:true});
}
