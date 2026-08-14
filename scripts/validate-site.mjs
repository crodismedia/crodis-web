import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "templates"]);
const errors = [];

function filesIn(directory) {
    return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) {
            return ignoredDirectories.has(name) ? [] : filesIn(path);
        }
        return [path];
    });
}

function report(message) {
    errors.push(message);
}

const files = filesIn(root);
const javascriptFiles = files.filter((path) => extname(path) === ".js");
const htmlFiles = files.filter((path) => extname(path) === ".html");

let vercelConfig = null;
try {
    vercelConfig = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
} catch (error) {
    report(`vercel.json no es JSON válido: ${error.message}`);
}

function rewritePattern(source) {
    const escaped = String(source || "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\:([A-Za-z0-9_]+)\\\*/g, ".*")
        .replace(/\\:([A-Za-z0-9_]+)/g, "[^/]+");
    return new RegExp(`^${escaped}$`);
}

const rewriteMatchers = (vercelConfig?.rewrites || [])
    .map((rewrite) => rewrite?.source)
    .filter(Boolean)
    .map(rewritePattern);

function isRewrittenPublicPath(referencePath) {
    const normalized = `/${String(referencePath || "").replace(/^\/+/, "")}`;
    return rewriteMatchers.some((pattern) => pattern.test(normalized));
}

for (const path of javascriptFiles) {
    try {
        execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
    } catch (error) {
        report(`JavaScript no válido: ${relative(root, path)}\n${error.stderr || error.message}`);
    }
}

const externalReference = /^(?:[a-z]+:|\/\/|#)/i;
const referencePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
const idPattern = /\bid\s*=\s*(["'])(.*?)\1/gi;
const pinnedSupabase =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0";
const supabaseCdnPattern =
    /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"'\s<]+/g;

for (const path of htmlFiles) {
    const source = readFileSync(path, "utf8");
    const ids = new Set();
    let match;

    while ((match = idPattern.exec(source))) {
        if (ids.has(match[2])) {
            report(`ID duplicado "${match[2]}" en ${relative(root, path)}`);
        }
        ids.add(match[2]);
    }

    while ((match = referencePattern.exec(source))) {
        const rawReference = match[2].trim();
        if (!rawReference || externalReference.test(rawReference)) continue;

        const relativePath = relative(root, path).replaceAll("\\", "/");
        if (relativePath.startsWith("municipios/") && rawReference === "../js/municipio.js") {
            // Las páginas municipales físicas son plantillas SSR. api/municipio elimina
            // este runtime heredado antes de entregar la respuesta pública.
            continue;
        }

        const cleanReference = rawReference.split(/[?#]/, 1)[0];
        if (!cleanReference) continue;

        let decodedReference;
        try {
            decodedReference = decodeURIComponent(cleanReference);
        } catch {
            report(`Referencia con codificación inválida en ${relative(root, path)}: ${rawReference}`);
            continue;
        }

        let target = decodedReference.startsWith("/")
            ? join(root, decodedReference.slice(1))
            : resolve(dirname(path), decodedReference);
        if (decodedReference.endsWith("/")) target = join(target, "index.html");

        if (!existsSync(target)) {
            const publicTarget = relative(root, target).replaceAll("\\", "/");
            if (!isRewrittenPublicPath(publicTarget)) {
                report(`Referencia local rota en ${relative(root, path)}: ${rawReference}`);
            }
        }
    }

    for (const supabaseReference of source.match(supabaseCdnPattern) || []) {
        if (supabaseReference !== pinnedSupabase) {
            report(
                `Supabase sin versión fija en ${relative(root, path)}: ${supabaseReference}`
            );
        }
    }
}

if (!existsSync(join(root, "images", "cartel-tallermap.png"))) {
    report("Falta la imagen social images/cartel-tallermap.png");
}

for (const publicScript of ["js/supabase.js"]) {
    const source = readFileSync(join(root, publicScript), "utf8");
    if (/\.from\(\s*["']talleres["']\s*\)/.test(source)) {
        report(`${publicScript} todavía consulta directamente la tabla talleres`);
    }
}

const adminSource = readFileSync(join(root, "js", "admin.js"), "utf8");
for (const missingFunction of ["sugerir-poblaciones", "buscar-candidatos-osm"]) {
    if (adminSource.includes(missingFunction)) {
        report(`admin.js todavía depende de la función no versionada ${missingFunction}`);
    }
}

if (errors.length) {
    console.error(errors.join("\n\n"));
    process.exit(1);
}

console.log(
    `Validación correcta: ${javascriptFiles.length} JavaScript y ${htmlFiles.length} HTML.`
);
