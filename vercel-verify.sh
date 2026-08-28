#!/bin/bash
# vercel-verify.sh

set -u

URL="${1:-https://www.tallermap.es}"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

echo "🔍 VERIFICANDO IMÁGENES SIN ALT EN VERCEL"
echo "=========================================="
echo "📌 URL: $URL"
echo ""

echo "📄 Descargando HTML..."
if ! curl -fsSL "$URL" -o "$TMP_FILE"; then
  echo "❌ No se pudo descargar $URL"
  exit 2
fi

IMG_TAGS=$(grep -oi '<img[^>]*>' "$TMP_FILE" || true)
SIN_ALT=$(printf '%s\n' "$IMG_TAGS" | grep -vi 'alt=' | grep -c '<img' || true)
ALT_VACIO=$(printf '%s\n' "$IMG_TAGS" | grep -Ei 'alt=["'"'"'][[:space:]]*["'"'"']' | grep -c '<img' || true)
TOTAL=$((SIN_ALT + ALT_VACIO))

echo "📊 Imágenes sin atributo alt: $SIN_ALT"
echo "📊 Imágenes con alt vacío: $ALT_VACIO"
echo "📊 Total problemas alt: $TOTAL"

echo ""
echo "📦 Cabeceras de caché:"
curl -IsL "$URL" | grep -Ei '^(cache-control|x-vercel-cache|etag|last-modified):' || true

if [ "$TOTAL" -gt 0 ]; then
  echo ""
  echo "❌ IMÁGENES PROBLEMÁTICAS DETECTADAS:"

  if [ "$SIN_ALT" -gt 0 ]; then
    echo ""
    echo "Sin atributo alt:"
    printf '%s\n' "$IMG_TAGS" | grep -vi 'alt=' | head -5
  fi

  if [ "$ALT_VACIO" -gt 0 ]; then
    echo ""
    echo "Con alt vacío:"
    printf '%s\n' "$IMG_TAGS" | grep -Ei 'alt=["'"'"'][[:space:]]*["'"'"']' | head -5
  fi

  echo ""
  echo "🔧 Más detalles: node diagnostico-alt.js $URL"
  exit 1
fi

echo ""
echo "✅ NO SE ENCONTRARON PROBLEMAS DE ALT EN ESTA URL"
exit 0
