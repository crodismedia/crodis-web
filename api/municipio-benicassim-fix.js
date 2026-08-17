import fs from "node:fs";
import path from "node:path";

const FILE_NAME = "benicassim-benicasim-12028.html";

const REPLACEMENTS = [
  ["Benicàssim/Benicasim", "Benicàssim / Benicasim"],
  ["ReparacióN De VehíCulos", "Reparación de vehículos"],
  ["Cambio De Aceite", "Cambio de aceite"],
  ["VehíCulos CláSicos", "Vehículos clásicos"],
  ["Mantenimiento Programado", "Mantenimiento programado"],
  ["Turbo Compresores", "Turbo compresores"],
  ["Mecanica General", "Mecánica general"],
  ["NeumáTicos", "Neumáticos"],
  ["MecáNica", "Mecánica"],
  ["CarroceríA", "Carrocería"],
  ["AutomocióN", "Automoción"],
  ["ReparacióN", "Reparación"],
  [">Reparacion<", ">Reparación<"]
];

function corregirTexto(html) {
  let output = html;
  for (const [incorrecto, correcto] of REPLACEMENTS) {
    output = output.split(incorrecto).join(correcto);
  }
  return output;
}

export default function handler(_request, response) {
  const filePath = path.join(process.cwd(), "municipios", FILE_NAME);
  let html;

  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("No se pudo leer la página de Benicàssim:", error);
    response.status(404).send("Municipio no encontrado.");
    return;
  }

  html = corregirTexto(html);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Content-Language", "es");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.setHeader("X-TallerMap-Municipio-Fix", "benicassim-benicasim-12028");
  response.status(200).send(html);
}
