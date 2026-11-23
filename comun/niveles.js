// LOS DOS NIVELES DE UN PLUGIN EN EL TIEMPO: cómo está el volumen al entrar (relleno) y cómo queda
// al salir (línea; si las dos orejas salen distintas, una línea por oreja). Para los efectos que
// no cambian el color del sonido sino cuánto suena (el trémolo), donde los espectros no dicen nada.
// Analizadores del navegador colgados de la salida 0 del nodo (por oreja) y de su salida 1 (la
// entrada sin tocar, que ponen los nodos del molde).
import { t } from './idiomas.js';

const COLUMNAS = 536;
const MS = 8; // cada columna es el pico de este rato: la historia entera son unos 4 segundos

export function niveles(nodo) {
  const ctx = nodo.context;
  const fm = ctx.sampleRate;
  const TRAMO = Math.max(32, Math.round((fm * MS) / 1000));
  const analizador = () => new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0 });
  let parte = null;
  let anI = null;
  let anD = null;
  let anE = null;
  try {
    parte = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    anI = analizador();
    anD = analizador();
    nodo.connect(parte, 0);
    parte.connect(anI, 0);
    parte.connect(anD, 1);
    if (nodo.numberOfOutputs > 1) {
      anE = analizador();
      nodo.connect(anE, 1);
    }
  } catch (e) {
    parte = null;
  }
  const hE = new Float32Array(COLUMNAS);
  const hI = new Float32Array(COLUMNAS);
  const hD = new Float32Array(COLUMNAS);
  let pos = 0;
  const mI = new Float32Array(2048);
  const mD = new Float32Array(2048);
  const mE = new Float32Array(2048);
  let antes = ctx.currentTime;

  // Lo que sonó desde el cuadro anterior pasa a la historia, de a tramos.
  const muestrear = () => {
    if (!parte) return;
    const ahora = ctx.currentTime;
    const nuevas = Math.min(2048, Math.round((ahora - antes) * fm));
    if (nuevas < TRAMO) return;
    antes = ahora;
    anI.getFloatTimeDomainData(mI);
    anD.getFloatTimeDomainData(mD);
    if (anE) anE.getFloatTimeDomainData(mE);
    for (let a = 2048 - nuevas; a + TRAMO <= 2048; a += TRAMO) {
      let pI = 0;
      let pD = 0;
      let pE = 0;
      for (let i = a; i < a + TRAMO; i++) {
        const x = mI[i] < 0 ? -mI[i] : mI[i];
        const y = mD[i] < 0 ? -mD[i] : mD[i];
        const z = mE[i] < 0 ? -mE[i] : mE[i];
        if (x > pI) pI = x;
        if (y > pD) pD = y;
        if (z > pE) pE = z;
      }
      hI[pos] = pI;
      hD[pos] = pD;
      hE[pos] = pE;
      pos = (pos + 1) % COLUMNAS;
    }
  };

  return {
    // Dibuja la historia en un gráfico de W×H con los colores ya resueltos `C`. Devuelve si hay
    // sonido (para que el efecto dibuje otra cosa mientras no lo hay).
    dibujar(g, W, H, C) {
      muestrear();
      let tope = 0;
      let distintas = false;
      for (let i = 0; i < COLUMNAS; i++) {
        if (hE[i] > tope) tope = hE[i];
        if (hI[i] > tope) tope = hI[i];
        if (hD[i] > tope) tope = hD[i];
        if (Math.abs(hI[i] - hD[i]) > 0.02 * (hI[i] + hD[i] + 1e-6) + 1e-4) distintas = true;
      }
      if (tope < 1e-4) return false;
      const X = (i) => (i / (COLUMNAS - 1)) * W;
      const Y = (x) => H - 6 - (x / tope) * (H - 26);
      const camino = (h) => {
        g.beginPath();
        for (let i = 0; i < COLUMNAS; i++) {
          const y = Y(h[(pos + i) % COLUMNAS]);
          if (i === 0) g.moveTo(X(i), y);
          else g.lineTo(X(i), y);
        }
      };
      if (anE) {
        camino(hE);
        g.lineTo(W, H);
        g.lineTo(0, H);
        g.closePath();
        g.fillStyle = C.traza;
        g.globalAlpha = 0.6;
        g.fill();
        g.globalAlpha = 1;
      }
      if (distintas) {
        camino(hD);
        g.strokeStyle = C.acento;
        g.lineWidth = 1.25;
        g.stroke();
      }
      camino(hI);
      g.strokeStyle = C.tinta;
      g.lineWidth = 1.25;
      g.stroke();
      g.lineWidth = 1;
      // la leyenda
      g.font = '11px system-ui, sans-serif';
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      let x = 6;
      const marca = (color, relleno, texto) => {
        if (relleno) {
          g.fillStyle = color;
          g.fillRect(x, 6, 11, 9);
        } else {
          g.strokeStyle = color;
          g.lineWidth = 1.25;
          g.beginPath();
          g.moveTo(x, 10.5);
          g.lineTo(x + 13, 10.5);
          g.stroke();
          g.lineWidth = 1;
        }
        g.fillStyle = C.tinta2;
        g.fillText(texto, x + 17, 14);
        x += 17 + g.measureText(texto).width + 12;
      };
      if (anE) marca(C.traza, true, t('cómo está'));
      marca(C.tinta, false, t(distintas ? 'cómo queda (izquierda)' : 'cómo queda'));
      if (distintas) marca(C.acento, false, t('derecha'));
      return true;
    },
    recolgar() {
      if (!parte) return;
      try {
        nodo.connect(parte, 0);
        if (anE) nodo.connect(anE, 1);
      } catch (e) {
        // el nodo ya no existe
      }
    },
    soltar() {
      if (!parte) return;
      for (const d of [parte, anE]) {
        if (!d) continue;
        try {
          nodo.disconnect(d);
        } catch (e) {
          // ya lo habían desconectado
        }
      }
    },
  };
}
