// FILTRO — plugin WAM 2.0 propio (2026-11-23). El sonido y los parámetros: `nucleo.js`; lo demás
// lo pone el molde (`comun/molde.js`) y la carátula común, que acá dibuja además la curva del filtro.
import descriptor from './descriptor.json';
import { hacerModulo } from '../comun/molde.js';
import { caratulaSimple } from '../comun/caratulaSimple.js';
import { nucleoFiltro } from './nucleo.js';

const N = nucleoFiltro();
const TECHO = 18; // dB arriba del gráfico
const RANGO = 66; // dB de arriba a abajo

// La curva de lo que deja pasar (sin el vaivén: donde está puesta la frecuencia).
function dibujar(g, { W, H, FX, V, C, fm }) {
  const Y = (db) => ((TECHO - db) / RANGO) * H;
  g.strokeStyle = C.borde;
  g.beginPath();
  g.moveTo(1, Math.round(Y(0)) + 0.5);
  g.lineTo(W - 1, Math.round(Y(0)) + 0.5);
  g.stroke();
  g.beginPath();
  for (let px = 0; px <= W; px += 2) {
    const y = Math.min(H + 4, Math.max(-4, Y(N.respuesta(V, FX(px), fm))));
    if (px === 0) g.moveTo(px, y);
    else g.lineTo(px, y);
  }
  g.strokeStyle = C.acento;
  g.lineWidth = 2;
  g.stroke();
  g.lineWidth = 1;
}

export default hacerModulo({
  descriptor,
  nucleo: nucleoFiltro,
  caratula: (nodo) => caratulaSimple(nodo, { titulo: 'Filtro', PARAMS: N.PARAMS, dibujar }),
});
