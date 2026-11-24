// DETECTAR LOS GOLPES DE UN AUDIO, para cortarlo en tajadas (2026-11-24, JP: «los cortes se pueden
// mover a distintos lados y se pueden detectar»).
//
// Solo cuentas, como `nucleo.js`. En dos pasos, porque el audio entero se le pasa al hilo de audio
// y no se queda en el hilo principal:
//   1. `energias(canales, fm)` al abrir el audio: la energía de lo agudo (la diferencia entre una
//      muestra y la anterior, que resalta los golpes) en tramos de HOP muestras, en dB.
//   2. `golpes(en, sens)` cada vez que se detecta: dónde la energía SUBE de golpe (más de un umbral
//      en ~10 ms) sobre lo que venía sonando. `sens` 0…100: más alto, más golpes (umbral más bajo).
// Devuelve los segundos donde empieza cada golpe, en orden.

export const HOP = 256;
const SEPARACION_S = 0.05; // dos golpes, al menos a 50 ms
const PISO_DB = 45; // lo que está 45 dB bajo lo más fuerte no cuenta

export function energias(canales, fm) {
  const n = canales.length ? canales[0].length : 0;
  const tramos = Math.ceil(n / HOP);
  const db = new Float32Array(tramos);
  let antes = 0;
  for (let k = 0; k < tramos; k++) {
    let suma = 0;
    const z = Math.min(n, (k + 1) * HOP);
    for (let i = k * HOP; i < z; i++) {
      let x = 0;
      for (const c of canales) x += c[i];
      x /= canales.length;
      const d = x - antes;
      antes = x;
      suma += d * d;
    }
    db[k] = 10 * Math.log10(suma / HOP + 1e-12);
  }
  return { db, seg: HOP / fm };
}

export function golpes(en, sens = 50) {
  const { db, seg } = en;
  const n = db.length;
  if (!n) return [];
  const s = Math.max(0, Math.min(100, Number(sens)));
  const umbral = 4 + (1 - s / 100) * 14; // 18 dB (pocos) … 4 dB (muchos)
  let tope = -Infinity;
  for (const x of db) if (x > tope) tope = x;
  const piso = tope - PISO_DB;
  const L = (k) => (k < 0 ? -120 : db[Math.min(n - 1, k)]);
  // cuánto subió en dos tramos (~12 ms a 44,1 kHz)
  const sube = new Float32Array(n);
  for (let k = 0; k < n; k++) sube[k] = Math.max(0, L(k) - Math.max(L(k - 1), L(k - 2)));
  const sep = Math.max(1, Math.round(SEPARACION_S / seg));
  const out = [];
  let ultimo = -Infinity;
  for (let k = 0; k < n; k++) {
    if (sube[k] < umbral || db[k] < piso) continue;
    if (sube[k] < (k > 0 ? sube[k - 1] : 0) || sube[k] < (k + 1 < n ? sube[k + 1] : 0)) continue;
    if (k - ultimo < sep) continue;
    ultimo = k;
    // el golpe empieza donde arrancó la subida: un tramo antes si ese ya venía subiendo
    const k0 = k > 0 && L(k - 1) > L(k - 2) + 3 ? k - 1 : k;
    out.push(Math.max(0, k0 * seg));
  }
  return out;
}

// Partes iguales: `n` cortes a lo largo de `dur` segundos.
export const parejos = (dur, n) => Array.from({ length: Math.max(1, n) }, (_, i) => (i * dur) / Math.max(1, n));
