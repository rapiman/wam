// TRÉMOLO — plugin WAM 2.0 propio (2026-11-23). El sonido y los parámetros: `nucleo.js`; lo demás
// lo pone el molde (`comun/molde.js`) y la carátula común. El trémolo no cambia el color del sonido
// sino cuánto suena, así que en vez de los espectros muestra el volumen en el tiempo: cómo está
// al entrar y cómo queda al salir (`comun/niveles.js`). Mientras no hay sonido, dibuja la onda
// que le va a poner al volumen.
import descriptor from './descriptor.json';
import { hacerModulo } from '../comun/molde.js';
import { caratulaSimple } from '../comun/caratulaSimple.js';
import { nucleoTremolo } from './nucleo.js';
import { t } from '../comun/idiomas.js';

const N = nucleoTremolo();

// Dos vueltas del volumen: la oreja izquierda (color de acento) y la derecha (gris).
function dibujar(g, { W, H, V, C, sonando }) {
  if (sonando) return;
  const Y = (x) => H - 8 - x * (H - 16);
  const traza = (desfase, color, ancho) => {
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const y = Y(N.ganancia(V, (px / W) * 2 + desfase));
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    g.strokeStyle = color;
    g.lineWidth = ancho;
    g.stroke();
  };
  g.strokeStyle = C.traza;
  g.lineWidth = 1;
  for (const x of [0, 1]) {
    g.beginPath();
    g.moveTo(1, Math.round(Y(x)) + 0.5);
    g.lineTo(W - 1, Math.round(Y(x)) + 0.5);
    g.stroke();
  }
  if (V.fase > 0.5) traza(Math.min(180, V.fase) / 360, C.tinta2, 1.25);
  traza(0, C.acento, 2);
  g.lineWidth = 1;
  g.font = '11px system-ui, sans-serif';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = C.tinta2;
  g.fillText(t(V.fase > 0.5 ? 'la onda del volumen de cada oreja (sin sonido todavía)' : 'la onda del volumen (sin sonido todavía)'), 6, 14);
}

export default hacerModulo({
  descriptor,
  nucleo: nucleoTremolo,
  caratula: (nodo) => caratulaSimple(nodo, { titulo: 'Trémolo', PARAMS: N.PARAMS, conNiveles: true, conFrecuencias: false, dibujar }),
});
