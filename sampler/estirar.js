// ESTIRAR AL TEMPO SIN CAMBIAR LA ALTURA, POR ESPECTRO (2026-11-25, JP: «por espectro»; cada parte
// «puede ser en ms o en notas»).
//
// Un vocoder de fase con las fases «amarradas» a los picos (Laroche y Dolson): se toma el audio en
// ventanas que se solapan, se pasa cada una a frecuencias (FFT), se vuelve a armar con otro paso
// entre ventanas, y la fase de cada pico avanza según su frecuencia verdadera; las frecuencias
// vecinas a un pico siguen a ese pico (así suena menos «a lata» que el vocoder simple).
//
// Por TRAMOS: un audio de varias partes seguidas (entrada, loop, release), cada una con su propia
// proporción, en una sola pasada, para que no queden costuras entre partes.
//
// Solo cuentas (como `nucleo.js`): se prueba en Node y corre en el hilo principal, una vez por
// tempo y por ajuste; el resultado se le manda al hilo de audio como una muestra más.

const N = 2048; // el largo de cada ventana
const HS = 512; // el paso al rearmar (las ventanas se solapan 4 veces)

// FFT compleja, en el lugar (re, im de largo potencia de 2). `inv`: la inversa (sin dividir por n).
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let largo = 2; largo <= n; largo <<= 1) {
    const ang = ((inv ? 2 : -2) * Math.PI) / largo;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const mitad = largo >> 1;
    for (let i = 0; i < n; i += largo) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < mitad; k++) {
        const a = i + k;
        const b = a + mitad;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const envolver = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));

// `canales`: Float32Array[]; `tramos`: [{ a, b, f }] en muestras, seguidos (b de uno = a del que
// sigue), con `f` la proporción (2 = el doble de largo; entre 0,25 y 4). Devuelve { canales, bordes }: lo estirado
// (empieza en `tramos[0].a`) y dónde cae cada borde entre tramos, en muestras de lo estirado.
export function estirarTramos(canales, tramos) {
  // (un tramo vacío queda, con largo cero, para que los bordes sigan uno por tramo)
  const ts = tramos.map((t) => ({ a: t.a, b: Math.max(t.a, t.b), f: Math.max(0.25, Math.min(4, Number(t.f) || 1)) }));
  const bordes = [0];
  for (const t of ts) bordes.push(bordes[bordes.length - 1] + (t.b - t.a) * t.f);
  const largo = Math.max(1, Math.round(bordes[bordes.length - 1]));
  if (!ts.length) return { canales: canales.map(() => new Float32Array(1)), bordes: [0] };
  // De lo estirado a lo original: en qué muestra del original cae una muestra de lo estirado.
  const original = (s) => {
    for (let i = 0; i < ts.length; i++) if (s < bordes[i + 1] || i === ts.length - 1) return ts[i].a + Math.min(ts[i].b - ts[i].a, (s - bordes[i]) / ts[i].f);
    return ts[ts.length - 1].b;
  };
  const ventana = new Float64Array(N);
  for (let i = 0; i < N; i++) ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const B = N / 2 + 1;
  const omega = new Float64Array(B);
  for (let k = 0; k < B; k++) omega[k] = (2 * Math.PI * k) / N;
  const cuadros = Math.ceil((largo + N) / HS) + 1;
  const sal = canales.map(() => new Float32Array(largo + N));
  const peso = new Float64Array(largo + N);
  for (let q = 0; q < cuadros; q++) {
    const t = q * HS - N / 2;
    for (let i = 0; i < N; i++) {
      const j = t + i;
      if (j >= 0 && j < peso.length) peso[j] += ventana[i] * ventana[i];
    }
  }
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const mag = new Float64Array(B);
  const fase = new Float64Array(B);
  const faseAntes = new Float64Array(B);
  const faseSal = new Float64Array(B);
  const pico = new Int32Array(B);
  for (let c = 0; c < canales.length; c++) {
    const x = canales[c];
    const o = sal[c];
    let posAntes = 0;
    for (let q = 0; q < cuadros; q++) {
      // la ventana de salida empieza en q·HS − N/2; su centro viene de `original(centro)`
      const t = q * HS - N / 2;
      const centro = original(Math.max(0, Math.min(largo, t + N / 2)));
      const pos = Math.round(centro - N / 2);
      for (let i = 0; i < N; i++) {
        const j = pos + i;
        re[i] = (j >= 0 && j < x.length ? x[j] : 0) * ventana[i];
        im[i] = 0;
      }
      fft(re, im, false);
      for (let k = 0; k < B; k++) {
        mag[k] = Math.hypot(re[k], im[k]);
        fase[k] = Math.atan2(im[k], re[k]);
      }
      if (q === 0) {
        for (let k = 0; k < B; k++) faseSal[k] = fase[k];
      } else {
        const ha = pos - posAntes;
        // los picos: más que sus dos vecinos de cada lado
        const esPico = [];
        for (let k = 0; k < B; k++) {
          const m = mag[k];
          if ((k < 1 || m > mag[k - 1]) && (k < 2 || m > mag[k - 2]) && (k + 1 >= B || m >= mag[k + 1]) && (k + 2 >= B || m >= mag[k + 2])) esPico.push(k);
        }
        if (!esPico.length) esPico.push(0);
        // cada frecuencia, con el pico más cercano (la frontera, a mitad de camino)
        let p = 0;
        for (let k = 0; k < B; k++) {
          while (p + 1 < esPico.length && Math.abs(esPico[p + 1] - k) < Math.abs(esPico[p] - k)) p++;
          pico[k] = esPico[p];
        }
        const avance = new Float64Array(B);
        for (const k of esPico) {
          const d = ha > 0 ? envolver(fase[k] - faseAntes[k] - omega[k] * ha) : 0;
          const frec = omega[k] + (ha > 0 ? d / ha : 0);
          avance[k] = faseSal[k] + frec * HS;
        }
        for (let k = 0; k < B; k++) {
          const pk = pico[k];
          faseSal[k] = avance[pk] + (fase[k] - fase[pk]);
        }
      }
      for (let k = 0; k < B; k++) faseAntes[k] = fase[k];
      posAntes = pos;
      for (let k = 0; k < B; k++) {
        re[k] = mag[k] * Math.cos(faseSal[k]);
        im[k] = mag[k] * Math.sin(faseSal[k]);
      }
      for (let k = B; k < N; k++) {
        re[k] = re[N - k];
        im[k] = -im[N - k];
      }
      fft(re, im, true);
      for (let i = 0; i < N; i++) {
        const j = t + i;
        if (j >= 0 && j < o.length) o[j] += (re[i] / N) * ventana[i];
      }
    }
    for (let j = 0; j < o.length; j++) o[j] = peso[j] > 1e-3 ? o[j] / peso[j] : 0;
  }
  return { canales: sal.map((o) => o.slice(0, largo)), bordes: bordes.map((b) => Math.round(b)) };
}

// Cuántos segundos pide un ajuste de estirado: { u: 'ms' | 't', v } (milisegundos o tiempos de
// negra al tempo dado). null o v ≤ 0: no se estira.
export function segundosDe(est, bpm) {
  if (!est || !(Number(est.v) > 0)) return 0;
  if (est.u === 't') return (Number(est.v) * 60) / Math.max(1, Number(bpm) || 120);
  return Number(est.v) / 1000;
}
