import { copyFile, readFile, writeFile } from "node:fs/promises";

const archivo = new URL("../js/admin.js", import.meta.url);
const copia = new URL("../js/admin.js.before-utf8-repair", import.meta.url);

const reemplazos = new Map([
  ["Ă¡", "á"], ["Ă©", "é"], ["Ă­", "í"], ["Ăł", "ó"], ["Ăş", "ú"],
  ["Ă", "Á"], ["Ă‰", "É"], ["Ă", "Í"], ["Ă“", "Ó"], ["Ăš", "Ú"],
  ["Ă±", "ñ"], ["Ă‘", "Ñ"], ["ĂĽ", "ü"], ["Ăś", "ö"], ["Ă§", "ç"],
  ["âŚ", "…"], ["â", "—"], ["â", "–"], ["â", "“"], ["â", "”"],
  ["â", "‘"], ["â", "’"], ["â", "✓"], ["â", "✔"],
  ["Âˇ", "·"], ["Â·", "·"], ["Âª", "ª"], ["Âº", "º"],
  ["Â©", "©"], ["Â®", "®"], ["Â«", "«"], ["Â»", "»"],
  ["â¬", "€"], ["â", "←"], ["â", "→"]
]);

function reparar(contenido) {
  let resultado = contenido;
  for (const [incorrecto, correcto] of reemplazos) {
    resultado = resultado.split(incorrecto).join(correcto);
  }
  return resultado.replace(/Â(?=[\s.,:;!?¿¡()[\]{}'"<>·])/g, "");
}

const original = await readFile(archivo, "utf8");
const corregido = reparar(original);

if (original === corregido) {
  console.log("No hay cambios UTF-8 que aplicar.");
  process.exit(0);
}

await copyFile(archivo, copia);
await writeFile(archivo, corregido, "utf8");

const sospechosas = corregido.match(/Ă|Â|â|â|â|â/g) || [];
if (sospechosas.length) {
  console.error(`Quedan ${sospechosas.length} secuencias sospechosas.`);
  process.exit(1);
}

console.log("js/admin.js reparado correctamente.");
