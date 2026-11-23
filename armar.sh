#!/usr/bin/env bash
# ARMA LOS PLUGINS: cada carpeta con un `index.js` sale a `dist/<carpeta>/`, con su
# `descriptor.json` al lado. Antes corre la prueba del cálculo de cada plugin
# (`<carpeta>/prueba.mjs`, con Node): si alguna falla, no arma.
#
#   bash armar.sh                 arma a dist/
#   bash armar.sh /ruta/sitio/wam además copia cada plugin armado a esa carpeta
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
ESBUILD="$AQUI/node_modules/.bin/esbuild"
DESTINO="${1:-}"

for p in "$AQUI"/*/prueba.mjs; do
  echo "== prueba: $(basename "$(dirname "$p")")"
  node "$p" | tail -1
done

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
  # Un plugin con el archivo `GUARDADO` se arma y se prueba, pero no se copia al sitio.
  if [ -n "$DESTINO" ] && [ -f "$dir/GUARDADO" ]; then
    echo "   guardado: no se copia"
  elif [ -n "$DESTINO" ]; then
    # No pisar un plugin ajeno que se llame igual (2026-11-23: `reverb` ya era el Microverb en
    # Pizarrita): si la carpeta existe y su descriptor no es de los nuestros, se detiene.
    if [ -f "$DESTINO/$id/descriptor.json" ] && ! grep -q '"identifier": *"org\.wedwed\.pizarrita\.' "$DESTINO/$id/descriptor.json"; then
      echo "armar: $DESTINO/$id ya existe y es de otro plugin: no se copia (cambiar el nombre de la carpeta)" >&2
      exit 1
    fi
    mkdir -p "$DESTINO/$id"
    cp "$AQUI/dist/$id/"* "$DESTINO/$id/"
    echo "   copiado a $DESTINO/$id"
  fi
done
echo "listo"
