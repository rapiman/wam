// EL NÚCLEO DEL ECUALIZADOR: los coeficientes de cada banda y su respuesta en frecuencia.
//
// Lo usan DOS lados con la misma cuenta: el hilo de audio (para filtrar) y la carátula (para
// dibujar la curva). Por eso es una función que se basta sola: al hilo de audio se manda como
// texto (`comun/hilo.js`), y la carátula la llama directo.
export function nucleoEq() {
  const TIPOS = ['Campana', 'Repisa baja', 'Repisa alta', 'Corte bajo', 'Corte alto', 'Muesca'];
  // ¿La ganancia de la banda hace algo en este tipo? (en los cortes y la muesca, no)
  const conGanancia = (tipo) => tipo <= 2;

  // QUÉ TAN DURO ES UN CORTE: cada 12 dB por octava es un filtro de segundo orden más, en serie.
  const PENDIENTES = ['12 dB/oct', '24 dB/oct', '36 dB/oct', '48 dB/oct'];
  const esCorte = (tipo) => tipo === 3 || tipo === 4;
  // Cuántos filtros en serie lleva una banda (solo los cortes llevan más de uno).
  const etapas = (tipo, pend) => (esCorte(tipo) ? Math.min(4, Math.max(1, (pend | 0) + 1)) : 1);
  // El Q de la etapa k (0…n−1) de una banda de n etapas: los de Butterworth, que juntos dan una
  // caída pareja sin joroba; el Q de la banda se aplica a la etapa más resonante (0,71 = plano,
  // más alto = resonancia en el corte). Con una sola etapa es el Q de la banda tal cual.
  const qEtapa = (q, k, n) => {
    if (n <= 1) return q;
    const plano = 1 / (2 * Math.cos((Math.PI * (2 * k + 1)) / (4 * n)));
    return k === n - 1 ? plano * (q / Math.SQRT1_2) : plano;
  };

  // Coeficientes de un filtro de segundo orden (las fórmulas del «Audio EQ Cookbook» de
  // Robert Bristow-Johnson), normalizados: deja en `c` [b0, b1, b2, a1, a2].
  const coefs = (c, tipo, frec, ganDb, q, fm) => {
    const f = Math.min(0.49 * fm, Math.max(10, frec));
    const w = (2 * Math.PI * f) / fm;
    const cs = Math.cos(w);
    const alfa = Math.sin(w) / (2 * Math.max(0.05, q));
    const A = 10 ** (ganDb / 40);
    let b0;
    let b1;
    let b2;
    let a0;
    let a1;
    let a2;
    if (tipo === 0) {
      b0 = 1 + alfa * A;
      b1 = -2 * cs;
      b2 = 1 - alfa * A;
      a0 = 1 + alfa / A;
      a1 = -2 * cs;
      a2 = 1 - alfa / A;
    } else if (tipo === 1 || tipo === 2) {
      const s = tipo === 1 ? 1 : -1; // repisa baja o alta: cambia el signo del coseno
      const r = 2 * Math.sqrt(A) * alfa;
      b0 = A * (A + 1 - s * (A - 1) * cs + r);
      b1 = s * 2 * A * (A - 1 - s * (A + 1) * cs);
      b2 = A * (A + 1 - s * (A - 1) * cs - r);
      a0 = A + 1 + s * (A - 1) * cs + r;
      a1 = -s * 2 * (A - 1 + s * (A + 1) * cs);
      a2 = A + 1 + s * (A - 1) * cs - r;
    } else {
      a0 = 1 + alfa;
      a1 = -2 * cs;
      a2 = 1 - alfa;
      if (tipo === 3) {
        b0 = (1 + cs) / 2;
        b1 = -(1 + cs);
        b2 = b0;
      } else if (tipo === 4) {
        b0 = (1 - cs) / 2;
        b1 = 1 - cs;
        b2 = b0;
      } else {
        b0 = 1;
        b1 = -2 * cs;
        b2 = 1;
      }
    }
    c[0] = b0 / a0;
    c[1] = b1 / a0;
    c[2] = b2 / a0;
    c[3] = a1 / a0;
    c[4] = a2 / a0;
    return c;
  };

  // Cuántos dB sube o baja ese filtro a la frecuencia `frec`.
  const magnitud = (c, frec, fm) => {
    const w = (2 * Math.PI * frec) / fm;
    const c1 = Math.cos(w);
    const c2 = Math.cos(2 * w);
    const num = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] + 2 * (c[0] * c[1] + c[1] * c[2]) * c1 + 2 * c[0] * c[2] * c2;
    const den = 1 + c[3] * c[3] + c[4] * c[4] + 2 * (c[3] + c[3] * c[4]) * c1 + 2 * c[4] * c2;
    return 10 * Math.log10(Math.max(1e-12, num / Math.max(1e-12, den)));
  };

  return { TIPOS, PENDIENTES, conGanancia, esCorte, etapas, qEtapa, coefs, magnitud };
}

// Lo que comparten el procesador y la carátula sobre las bandas.
export const BANDAS = 8;
export const FRECUENCIAS = [30, 100, 250, 600, 1500, 3500, 8000, 16000];
