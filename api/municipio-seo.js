import fs from "node:fs";
import path from "node:path";

const SEO_OVERRIDES = {
  "valencia-46250.html": {
    originalName: "València",
    originalDescription: "Encuentra talleres mecánicos publicados en València. Consulta servicios, dirección, teléfono y horarios en TallerMap. Código municipal 46250.",
    title: "Talleres mecánicos en Valencia (València) | TallerMap",
    description: "Encuentra talleres mecánicos en Valencia (València). Consulta dirección, teléfono, horarios, servicios, ficha del taller y cómo llegar desde TallerMap.",
    heading: "Talleres mecánicos en Valencia (València)",
    schemaName: "Talleres mecánicos en Valencia (València)",
    intro: `
                            Encuentra <strong>talleres mecánicos en Valencia (València)</strong> para reparación,
                            mantenimiento y servicios de automoción. Compara fichas con dirección, teléfono,
                            horarios, servicios disponibles y acceso a cómo llegar antes de contactar.
                        `,
    searchHeading: "Buscar taller mecánico en Valencia",
    resultsHeading: "Talleres mecánicos publicados en Valencia",
    resultsText: "Consulta talleres de automoción publicados en Valencia capital y accede a la ficha de cada negocio para revisar sus datos disponibles.",
    localSection: `
        <section class="seccion municipio-seo-local" aria-labelledby="seo-valencia-titulo">
            <div class="contenedor">
                <div class="titulo-seccion alineado-izquierda">
                    <span>Directorio de automoción en Valencia</span>
                    <h2 id="seo-valencia-titulo">Encuentra taller mecánico en Valencia por servicio</h2>
                    <p>
                        TallerMap reúne talleres de automoción publicados en Valencia capital. Puedes consultar
                        opciones de <a href="../servicios/mecanica-general.html">mecánica general</a>,
                        <a href="../servicios/neumaticos.html">neumáticos</a>,
                        <a href="../servicios/chapa-pintura.html">chapa y pintura</a>,
                        <a href="../servicios/diagnosis-electronica.html">diagnosis electrónica</a>,
                        <a href="../servicios/aire-acondicionado.html">aire acondicionado</a> y
                        <a href="../servicios/hibridos-electricos.html">híbridos y eléctricos</a>.
                    </p>
                    <p>
                        Cada ficha enlazada desde este directorio muestra los datos disponibles del taller, como
                        dirección, teléfono, horario, servicios y acceso a cómo llegar. Si buscas opciones fuera de
                        la capital, consulta también los <a href="../provincias/valencia.html">talleres de la provincia de Valencia</a>.
                    </p>
                </div>
            </div>
        </section>
`
  },
  "castello-de-la-plana-castellon-de-la-plana-12040.html": {
    originalName: "Castelló de la Plana/Castellón de la Plana",
    originalDescription: "Encuentra talleres mecánicos publicados en Castelló de la Plana/Castellón de la Plana. Consulta servicios, dirección, teléfono y horarios en TallerMap. Código municipal 12040.",
    title: "Talleres mecánicos en Castellón (Castelló de la Plana) | TallerMap",
    description: "Encuentra talleres mecánicos en Castellón (Castelló de la Plana). Consulta dirección, teléfono, horarios, servicios, ficha del taller y cómo llegar.",
    heading: "Talleres mecánicos en Castellón (Castelló de la Plana)",
    schemaName: "Talleres mecánicos en Castellón (Castelló de la Plana)",
    intro: `
                            Encuentra <strong>talleres mecánicos en Castellón (Castelló de la Plana)</strong> para reparación,
                            mantenimiento y servicios de automoción. Consulta fichas con dirección, teléfono,
                            horarios, servicios disponibles y acceso a cómo llegar antes de contactar.
                        `,
    searchHeading: "Buscar taller mecánico en Castellón",
    resultsHeading: "Talleres mecánicos publicados en Castellón",
    resultsText: "Consulta talleres de automoción publicados en Castellón de la Plana y accede a la ficha de cada negocio para revisar sus datos disponibles.",
    localSection: `
        <section class="seccion municipio-seo-local" aria-labelledby="seo-castellon-titulo">
            <div class="contenedor">
                <div class="titulo-seccion alineado-izquierda">
                    <span>Directorio de automoción en Castellón</span>
                    <h2 id="seo-castellon-titulo">Encuentra taller mecánico en Castellón por servicio</h2>
                    <p>
                        TallerMap reúne talleres de automoción publicados en Castellón de la Plana. Puedes consultar
                        opciones de <a href="../servicios/mecanica-general.html">mecánica general</a>,
                        <a href="../servicios/neumaticos.html">neumáticos</a>,
                        <a href="../servicios/chapa-pintura.html">chapa y pintura</a>,
                        <a href="../servicios/diagnosis-electronica.html">diagnosis electrónica</a>,
                        <a href="../servicios/aire-acondicionado.html">aire acondicionado</a> y
                        <a href="../servicios/hibridos-electricos.html">híbridos y eléctricos</a>.
                    </p>
                    <p>
                        Cada ficha enlazada desde este directorio muestra los datos disponibles del taller, como
                        dirección, teléfono, horario, servicios y acceso a cómo llegar. Para ampliar la búsqueda,
                        consulta también los <a href="../provincias/castellon.html">talleres de la provincia de Castellón</a>.
                    </p>
                </div>
            </div>
        </section>
`
  },
  "alacant-alicante-03014.html": {
    originalName: "Alacant/Alicante",
    originalDescription: "Encuentra talleres mecánicos publicados en Alacant/Alicante. Consulta servicios, dirección, teléfono y horarios en TallerMap. Código municipal 03014.",
    title: "Talleres mecánicos en Alicante (Alacant) | TallerMap",
    description: "Encuentra talleres mecánicos en Alicante (Alacant). Consulta dirección, teléfono, horarios, servicios, ficha del taller y cómo llegar desde TallerMap.",
    heading: "Talleres mecánicos en Alicante (Alacant)",
    schemaName: "Talleres mecánicos en Alicante (Alacant)",
    intro: `
                            Encuentra <strong>talleres mecánicos en Alicante (Alacant)</strong> para reparación,
                            mantenimiento y servicios de automoción. Consulta fichas con dirección, teléfono,
                            horarios, servicios disponibles y acceso a cómo llegar antes de contactar.
                        `,
    searchHeading: "Buscar taller mecánico en Alicante",
    resultsHeading: "Talleres mecánicos publicados en Alicante",
    resultsText: "Consulta talleres de automoción publicados en Alicante capital y accede a la ficha de cada negocio para revisar sus datos disponibles.",
    localSection: `
        <section class="seccion municipio-seo-local" aria-labelledby="seo-alicante-titulo">
            <div class="contenedor">
                <div class="titulo-seccion alineado-izquierda">
                    <span>Directorio de automoción en Alicante</span>
                    <h2 id="seo-alicante-titulo">Encuentra taller mecánico en Alicante por servicio</h2>
                    <p>
                        TallerMap reúne talleres de automoción publicados en Alicante capital. Puedes consultar
                        opciones de <a href="../servicios/mecanica-general.html">mecánica general</a>,
                        <a href="../servicios/neumaticos.html">neumáticos</a>,
                        <a href="../servicios/chapa-pintura.html">chapa y pintura</a>,
                        <a href="../servicios/diagnosis-electronica.html">diagnosis electrónica</a>,
                        <a href="../servicios/aire-acondicionado.html">aire acondicionado</a> y
                        <a href="../servicios/hibridos-electricos.html">híbridos y eléctricos</a>.
                    </p>
                    <p>
                        Cada ficha enlazada desde este directorio muestra los datos disponibles del taller, como
                        dirección, teléfono, horario, servicios y acceso a cómo llegar. Si buscas opciones fuera de
                        la capital, consulta también los <a href="../provincias/alicante.html">talleres de la provincia de Alicante</a>.
                    </p>
                </div>
            </div>
        </section>
`
  }
};

function safeFileName(value) {
  const fileName = String(value || "").trim().toLowerCase();
  return Object.hasOwn(SEO_OVERRIDES, fileName) ? fileName : "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMetaDescription(html, description) {
  const replacement = `<meta name="description" content="${description}">`;
  if (/<meta\s+name="description"[^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name="description"[^>]*>/i, replacement);
  }
  return html.replace("</title>", `</title>\n    ${replacement}`);
}

function applySEO(html, config) {
  const originalName = escapeRegExp(config.originalName);
  const originalSchemaName = escapeRegExp(`Talleres mecánicos en ${config.originalName}`);
  const originalDescription = escapeRegExp(config.originalDescription);

  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${config.title}</title>`)
    .replace(/<h1>[\s\S]*?<\/h1>/i, `<h1>${config.heading}</h1>`)
    .replace(/<p class="municipio-intro">[\s\S]*?<\/p>/i, `<p class="municipio-intro">${config.intro}</p>`)
    .replace(new RegExp(`<h2>Buscar en ${originalName}<\\/h2>`, "i"), `<h2>${config.searchHeading}</h2>`)
    .replace(new RegExp(`<h2>Talleres publicados en ${originalName}<\\/h2>`, "i"), `<h2>${config.resultsHeading}</h2>`)
    .replace(/<p>\s*Los resultados se obtienen de las fichas activas publicadas en TallerMap\.\s*<\/p>/i, `<p>${config.resultsText}</p>`)
    .replace(new RegExp(`"name":\\s*"${originalSchemaName}"`, "i"), `"name": "${config.schemaName}"`)
    .replace(new RegExp(`"description":\\s*"${originalDescription}"`, "i"), `"description": "${config.description}"`);

  output = replaceMetaDescription(output, config.description);

  if (!output.includes("municipio-seo-local")) {
    output = output.replace(/\n\s*<section id="talleres"/i, `${config.localSection}\n        <section id="talleres"`);
  }

  return output;
}

export default function handler(request, response) {
  const fileName = safeFileName(request.query?.archivo);
  if (!fileName) {
    response.status(404).send("Municipio no encontrado.");
    return;
  }

  const filePath = path.join(process.cwd(), "municipios", fileName);
  let html;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("No se pudo leer la página municipal:", error);
    response.status(404).send("Municipio no encontrado.");
    return;
  }

  html = applySEO(html, SEO_OVERRIDES[fileName]);

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Content-Language", "es");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.setHeader("X-TallerMap-Municipio-SEO", fileName.replace(/\.html$/, ""));
  response.status(200).send(html);
}
