import homeHandler from "./home.js";

const BUSQUEDA_VERSION = "20260817-2";
const AUTOCOMPLETE_VERSION = "20260817-2";

function actualizarVersiones(html) {
  if (typeof html !== "string") return html;

  return html
    .replace(
      /js\/busqueda-url\.js(?:\?[^\"']*)?/g,
      `js/busqueda-url.js?v=${BUSQUEDA_VERSION}`
    )
    .replace(
      /js\/autocomplete-municipios\.js(?:\?[^\"']*)?/g,
      `js/autocomplete-municipios.js?v=${AUTOCOMPLETE_VERSION}`
    );
}

export default async function handler(request, response) {
  const sendOriginal = response.send.bind(response);

  response.send = (body) => sendOriginal(actualizarVersiones(body));

  return homeHandler(request, response);
}
