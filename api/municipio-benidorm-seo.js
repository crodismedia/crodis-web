import fs from "node:fs";
import path from "node:path";

const FILE_NAME = "benidorm-03031.html";
const TITLE = "Talleres mecánicos en Benidorm | TallerMap";
const DESCRIPTION = "Encuentra talleres mecánicos en Benidorm. Consulta dirección, teléfono, horarios, servicios, ficha del taller y cómo llegar desde TallerMap.";

function applySEO(html) {
  const localSection = `
        <section class="seccion municipio-seo-local" aria-labelledby="seo-benidorm-titulo">
            <div class="contenedor">
                <div class="titulo-seccion alineado-izquierda">
                    <span>Directorio de automoción en Benidorm</span>
                    <h2 id="seo-benidorm-titulo">Encuentra taller mecánico en Benidorm por servicio</h2>
                    <p>
                        TallerMap reúne talleres de automoción publicados en Benidorm. Puedes consultar opciones de
                        <a href="../servicios/mecanica-general.html">mecánica general</a>,
                        <a href="../servicios/neumaticos.html">neumáticos</a>,
                        <a href="../servicios/chapa-pintura.html">chapa y pintura</a>,
                        <a href="../servicios/diagnosis-electronica.html">diagnosis electrónica</a>,
                        <a href="../servicios/aire-acondicionado.html">aire acondicionado</a> y
                        <a href="../servicios/hibridos-electricos.html">híbridos y eléctricos</a>.
                    </p>
                    <p>
                        Cada ficha enlazada desde este directorio muestra los datos disponibles del taller, como
                        dirección, teléfono, horario, servicios y acceso a cómo llegar. Para ampliar la búsqueda,
                        consulta también los <a href="../provincias/alicante.html">talleres de la provincia de Alicante</a>.
                    </p>
                </div>
            </div>
        </section>
`;

  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${TITLE}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${DESCRIPTION}">`)
    .replace(/<h1>[\s\S]*?<\/h1>/i, "<h1>Talleres mecánicos en Benidorm</h1>")
    .replace(/<p class="municipio-intro">[\s\S]*?<\/p>/i, `<p class="municipio-intro">
                            Encuentra <strong>talleres mecánicos en Benidorm</strong> para reparación,
                            mantenimiento y servicios de automoción. Consulta fichas con dirección, teléfono,
                            horarios, servicios disponibles y acceso a cómo llegar antes de contactar.
                        </p>`)
    .replace(/<h2>Buscar en Benidorm<\/h2>/i, "<h2>Buscar taller mecánico en Benidorm</h2>")
    .replace(/<h2>Talleres publicados en Benidorm<\/h2>/i, "<h2>Talleres mecánicos publicados en Benidorm</h2>")
    .replace(/<p>\s*Los resultados se obtienen de las fichas activas publicadas en TallerMap\.\s*<\/p>/i, "<p>Consulta talleres de automoción publicados en Benidorm y accede a la ficha de cada negocio para revisar sus datos disponibles.</p>")
    .replace(/"name":\s*"Talleres mecánicos en Benidorm"/i, '"name": "Talleres mecánicos en Benidorm"')
    .replace(/"description":\s*"Encuentra talleres mecánicos publicados en Benidorm\. Consulta servicios, dirección, teléfono y horarios en TallerMap\. Código municipal 03031\."/i, `"description": "${DESCRIPTION}"`);

  if (!output.includes("municipio-seo-local")) {
    output = output.replace(/\n\s*<section id="talleres"/i, `${localSection}\n        <section id="talleres"`);
  }
  return output;
}

export default function handler(_request, response) {
  const filePath = path.join(process.cwd(), "municipios", FILE_NAME);
  let html;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("No se pudo leer la página de Benidorm:", error);
    response.status(404).send("Municipio no encontrado.");
    return;
  }

  html = applySEO(html);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Content-Language", "es");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.setHeader("X-TallerMap-Municipio-SEO", "benidorm-03031");
  response.status(200).send(html);
}
