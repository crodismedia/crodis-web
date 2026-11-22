#!/bin/bash
# Comprobar atributos alt con contexto accesible y mostrar cabeceras de Vercel.
set -euo pipefail

URL="${1:-https://www.tallermap.es}"

echo "VERIFICANDO IMAGENES Y TEXTOS ALTERNATIVOS EN VERCEL"
echo "URL: $URL"

# Reutiliza el mismo diagnostico: alt="" es valido en imagenes decorativas.
node diagnostico-alt.js "$URL" --single

echo "Cabeceras de cache:"
curl -IsL "$URL" | grep -Ei '^(cache-control|x-vercel-cache|etag|last-modified):' || true

echo "Comprobacion de ALT finalizada correctamente"
