import { access, copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const carpetaScript = dirname(fileURLToPath(import.meta.url));

const rutasPosibles = [
    resolve(process.cwd(), "js", "admin.js"),
    resolve(carpetaScript, "js", "admin.js"),
    resolve(carpetaScript, "..", "js", "admin.js")
];

async function existe(ruta) {
    try {
        await access(ruta, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function localizarAdmin() {
    for (const ruta of [...new Set(rutasPosibles)]) {
        if (await existe(ruta)) return ruta;
    }

    throw new Error(
        "No se encontró js/admin.js.\n\n" +
        "Coloca este archivo en la carpeta principal de TallerMap, " +
        "junto a index.html, y vuelve a ejecutarlo."
    );
}

function crearMapaInversoIso88592() {
    const decodificador = new TextDecoder("iso-8859-2");
    const mapa = new Map();

    for (let byte = 0; byte <= 255; byte += 1) {
        const caracter = decodificador.decode(Uint8Array.of(byte));
        if (!mapa.has(caracter)) mapa.set(caracter, byte);
    }

    return mapa;
}

const mapaIso88592 = crearMapaInversoIso88592();
const decodificadorUtf8 = new TextDecoder("utf-8", { fatal: true });

function escaparClaseRegex(texto) {
    return texto.replace(/[\\\]\-^]/g, "\\$&");
}

function caracteresParaBytes(desde, hasta) {
    const decodificador = new TextDecoder("iso-8859-2");
    let resultado = "";

    for (let byte = desde; byte <= hasta; byte += 1) {
        resultado += decodificador.decode(Uint8Array.of(byte));
    }

    return resultado;
}

/*
 * Primeros bytes válidos de secuencias UTF-8:
 * - C2–DF: secuencias de 2 bytes
 * - E0–EF: secuencias de 3 bytes
 * - F0–F4: secuencias de 4 bytes
 *
 * admin.js fue interpretado erróneamente como ISO-8859-2. Este patrón
 * localiza únicamente grupos que podrían corresponder a UTF-8 mal leído.
 */
const iniciosDosBytes = escaparClaseRegex(caracteresParaBytes(0xC2, 0xDF));
const iniciosTresBytes = escaparClaseRegex(caracteresParaBytes(0xE0, 0xEF));
const iniciosCuatroBytes = escaparClaseRegex(caracteresParaBytes(0xF0, 0xF4));

const patronMojibake = new RegExp(
    `(?:[${iniciosCuatroBytes}].{3}|[${iniciosTresBytes}].{2}|[${iniciosDosBytes}].)`,
    "gu"
);

function intentarDecodificar(fragmento) {
    const bytes = [];

    for (const caracter of fragmento) {
        const byte = mapaIso88592.get(caracter);
        if (byte === undefined) return fragmento;
        bytes.push(byte);
    }

    try {
        return decodificadorUtf8.decode(Uint8Array.from(bytes));
    } catch {
        return fragmento;
    }
}

function repararUnaPasada(contenido) {
    let cambios = 0;

    const reparado = contenido.replace(patronMojibake, (fragmento) => {
        const resultado = intentarDecodificar(fragmento);
        if (resultado !== fragmento) cambios += 1;
        return resultado;
    });

    return { reparado, cambios };
}

function repararContenido(contenido) {
    let resultado = contenido;
    let cambiosTotales = 0;

    // Varias pasadas permiten corregir texto que haya sido dañado más de una vez.
    for (let pasada = 0; pasada < 4; pasada += 1) {
        const { reparado, cambios } = repararUnaPasada(resultado);
        resultado = reparado;
        cambiosTotales += cambios;
        if (cambios === 0) break;
    }

    return { resultado, cambiosTotales };
}

function contarSecuenciasReparables(contenido) {
    let cantidad = 0;

    contenido.replace(patronMojibake, (fragmento) => {
        if (intentarDecodificar(fragmento) !== fragmento) cantidad += 1;
        return fragmento;
    });

    return cantidad;
}

function marcaTiempo() {
    const ahora = new Date();
    const dos = (numero) => String(numero).padStart(2, "0");

    return [
        ahora.getFullYear(),
        dos(ahora.getMonth() + 1),
        dos(ahora.getDate()),
        "-",
        dos(ahora.getHours()),
        dos(ahora.getMinutes()),
        dos(ahora.getSeconds())
    ].join("");
}

function validarSintaxis(rutaTemporal) {
    const comprobacion = spawnSync(
        process.execPath,
        ["--check", rutaTemporal],
        { encoding: "utf8" }
    );

    if (comprobacion.status !== 0) {
        const detalle = comprobacion.stderr || comprobacion.stdout || "Error desconocido";
        throw new Error(
            "La reparación fue cancelada porque el JavaScript resultante no es válido.\n\n" +
            detalle.trim()
        );
    }
}

async function ejecutar() {
    console.log("============================================");
    console.log(" Reparación segura de js/admin.js - TallerMap");
    console.log("============================================\n");

    const rutaAdmin = await localizarAdmin();
    const rutaCopia = `${rutaAdmin}.copia-${marcaTiempo()}`;
    const rutaTemporal = `${rutaAdmin}.reparado-temporal.js`;

    console.log(`Archivo localizado: ${rutaAdmin}`);

    const original = await readFile(rutaAdmin, "utf8");
    const secuenciasAntes = contarSecuenciasReparables(original);

    if (secuenciasAntes === 0) {
        console.log("\nNo se encontraron secuencias de codificación reparables.");
        console.log("El archivo original no ha sido modificado.");
        return;
    }

    const { resultado, cambiosTotales } = repararContenido(original);
    const secuenciasDespues = contarSecuenciasReparables(resultado);

    if (resultado === original || cambiosTotales === 0) {
        console.log("\nNo fue necesario modificar el archivo.");
        return;
    }

    await writeFile(rutaTemporal, resultado, "utf8");

    try {
        validarSintaxis(rutaTemporal);

        if (secuenciasDespues > 0) {
            throw new Error(
                `Quedan ${secuenciasDespues} secuencias de codificación reparables. ` +
                "El archivo original no se modificará."
            );
        }

        await copyFile(rutaAdmin, rutaCopia);
        await writeFile(rutaAdmin, resultado, "utf8");

        console.log("\n✅ Reparación terminada correctamente.");
        console.log(`✅ Fragmentos corregidos: ${cambiosTotales}`);
        console.log("✅ Sintaxis JavaScript comprobada con Node.");
        console.log(`✅ Copia de seguridad: ${rutaCopia}`);
        console.log(`✅ Archivo actualizado: ${rutaAdmin}`);
        console.log("\nAhora puedes subir js/admin.js a GitHub.");
    } finally {
        if (await existe(rutaTemporal)) {
            await unlink(rutaTemporal);
        }
    }
}

try {
    await ejecutar();
} catch (error) {
    console.error("\n❌ No se realizó ningún cambio inseguro.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
