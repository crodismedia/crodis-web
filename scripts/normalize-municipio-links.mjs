import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MUNICIPIOS_DIR = path.join(ROOT, 'municipios');
const legacyInternalIndexPattern = /href="(?:\.\.\/|\/)?(?:index|municipios\/index|provincias\/index|servicios\/index)\.html/;

const replacements = [
  ['href="../index.html#', 'href="/#'],
  ['href="../index.html"', 'href="/"'],
  ['href="index.html"', 'href="/municipios/"'],
  ['href="../municipios/index.html"', 'href="/municipios/"'],
  ['href="../provincias/index.html"', 'href="/provincias/"'],
  ['href="../servicios/index.html"', 'href="/servicios/"']
];

const files = fs.readdirSync(MUNICIPIOS_DIR)
  .filter(name => name.endsWith('.html'))
  .sort();

let changedFiles = 0;
let replacementsCount = 0;
const filesWithLegacyLinks = [];

for (const fileName of files) {
  const filePath = path.join(MUNICIPIOS_DIR, fileName);
  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  for (const [from, to] of replacements) {
    const occurrences = updated.split(from).length - 1;
    if (!occurrences) continue;
    updated = updated.split(from).join(to);
    replacementsCount += occurrences;
  }

  if (legacyInternalIndexPattern.test(updated)) {
    filesWithLegacyLinks.push(fileName);
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    changedFiles += 1;
  }
}

if (filesWithLegacyLinks.length) {
  throw new Error(`Quedan enlaces index.html internos en: ${filesWithLegacyLinks.join(', ')}`);
}

console.log(`Enlaces normalizados: ${replacementsCount} en ${changedFiles} archivos de municipios.`);
