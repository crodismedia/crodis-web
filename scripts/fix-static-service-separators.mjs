import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('talleres');
let scanned = 0;
let changed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name === 'index.html') fix(full);
  }
}

function fix(file) {
  scanned++;
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(
    /(<div\s+id=["']taller-servicios["'][^>]*>[\s\S]*?<\/div>)/gi,
    block => block.replace(/<\/span>\s*<span>/g, '</span> · <span>')
  );
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
  }
}

if (!fs.existsSync(ROOT)) throw new Error('No existe el directorio talleres/');
walk(ROOT);
console.log(`Fichas revisadas: ${scanned}`);
console.log(`Fichas corregidas: ${changed}`);
