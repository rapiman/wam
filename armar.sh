#!/usr/bin/env bash
# ARMA LOS PLUGINS: cada carpeta con un `index.js` sale a `dist/<carpeta>/`, con su
# `descriptor.json` al lado. Antes corre la prueba del cálculo (`prueba.mjs`, con Node):
# si falla, no arma.
#
#   bash armar.sh                 arma a dist/
#   bash armar.sh /ruta/sitio/wam además copia cada plugin armado a esa carpeta
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
ESBUILD="$AQUI/node_modules/.bin/esbuild"
DESTINO="${1:-}"

node "$AQUI/prueba.mjs"

# Las funciones que van al hilo de audio se pasan como texto (`addFunctionModule`): nada de
# bajar la sintaxis ni minificar.
for dir in "$AQUI"/*/; do
  id="$(basename "$dir")"
  [ -f "$dir/index.js" ] || continue
  [ "$id" = "dist" ] && continue
  echo "== $id"
  mkdir -p "$AQUI/dist/$id"
  "$ESBUILD" "$dir/index.js" --bundle --format=esm --target=esnext --log-level=warning --outfile="$AQUI/dist/$id/index.js"
  cp "$dir/descriptor.json" "$AQUI/dist/$id/"
  if [ -n "$DESTINO" ]; then
    mkdir -p "$DESTINO/$id"
    cp "$AQUI/dist/$id/"* "$DESTINO/$id/"
    echo "   copiado a $DESTINO/$id"
  fi
done
echo "listo"
