import fs from "node:fs";
import path from "node:path";
import municipioHandler from "./municipio.js";

function archivoMunicipioValido(fileName) {
    if (!/^[a-z0-9-]+\.html$/i.test(fileName)) return false;

    try {
        return fs.existsSync(path.join(process.cwd(), "municipios", fileName));
    } catch {
        return false;
    }
}

export default async function handler(request, response) {
    const fileName = String(request.query?.archivo || "").trim().toLowerCase();

    if (!archivoMunicipioValido(fileName)) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Robots-Tag", "noindex, nofollow");
        response.status(404).send("Municipio no encontrado.");
        return;
    }

    return municipioHandler(request, response);
}
