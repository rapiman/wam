// ECUALIZADOR PARAMÉTRICO — lo que corre en el hilo de audio.
//
// Dos funciones que se mandan al hilo de audio como texto, cada una se basta sola. La primera
// recibe el núcleo (`nucleo.js`, la misma cuenta que dibuja la curva) y deja el filtrado en el
// ámbito del módulo; la segunda registra el procesador. Separadas para probar el filtrado con
// Node (`prueba.mjs`).

// EL FILTRADO: hasta `bandas` bandas en serie, en las dos orejas. Cada banda es un filtro de
// segundo orden; un corte más duro son hasta 4 seguidos.
export function dspEq(moduleId, nucleoEq) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { coefs, etapas, qEtapa } = nucleoEq();
  const MAX = 4; // etapas por banda

  ambito.pzCrearEq = (fm, bandas) => {
    const c = [];
    for (let i = 0; i < bandas * MAX; i++) c.push(new Float64Array(5));
    const activa = new Uint8Array(bandas);
    const cuantas = new Uint8Array(bandas).fill(1); // etapas de cada banda
    const puesto = new Float64Array(bandas * 5).fill(NaN); // tipo, frec, gan, q, pend con que se calculó
    const z = new Float64Array(bandas * MAX * 4); // la memoria de cada filtro: dos por oreja

    // Pone una banda. Solo recalcula si cambió algo; al encenderse parte de cero.
    const poner = (b, encendida, tipo, frec, gan, q, pend) => {
      if (!encendida) {
        activa[b] = 0;
        return;
      }
      const n = etapas(tipo, pend);
      if (!activa[b] || n !== cuantas[b]) z.fill(0, b * MAX * 4, (b + 1) * MAX * 4);
      activa[b] = 1;
      const k = b * 5;
      if (puesto[k] === tipo && puesto[k + 1] === frec && puesto[k + 2] === gan && puesto[k + 3] === q && puesto[k + 4] === n) return;
      puesto[k] = tipo;
      puesto[k + 1] = frec;
      puesto[k + 2] = gan;
      puesto[k + 3] = q;
      puesto[k + 4] = n;
      cuantas[b] = n;
      for (let s = 0; s < n; s++) coefs(c[b * MAX + s], tipo, frec, gan, qEtapa(q, s, n), fm);
    };

    // Lee eI/eD y escribe sI/sD entre `desde` y `hasta`; `gan` es la ganancia de salida (lineal).
    const procesar = (eI, eD, sI, sD, desde, hasta, gan) => {
      for (let i = desde; i < hasta; i++) {
        sI[i] = eI[i];
        sD[i] = eD[i];
      }
      for (let e = 0; e < bandas * MAX; e++) {
        const b = (e / MAX) | 0;
        if (!activa[b] || e - b * MAX >= cuantas[b]) continue;
        const cb = c[e];
        const b0 = cb[0];
        const b1 = cb[1];
        const b2 = cb[2];
        const a1 = cb[3];
        const a2 = cb[4];
        const k = e * 4;
        let z1 = z[k];
        let z2 = z[k + 1];
        let y1 = z[k + 2];
        let y2 = z[k + 3];
        for (let i = desde; i < hasta; i++) {
          const x = sI[i];
          const y = b0 * x + z1;
          z1 = b1 * x - a1 * y + z2;
          z2 = b2 * x - a2 * y;
          sI[i] = y;
          const u = sD[i];
          const w = b0 * u + y1;
          y1 = b1 * u - a1 * w + y2;
          y2 = b2 * u - a2 * w;
          sD[i] = w;
        }
        // números diminutos que frenan al procesador cuando queda en silencio
        z[k] = z1 > -1e-20 && z1 < 1e-20 ? 0 : z1;
        z[k + 1] = z2 > -1e-20 && z2 < 1e-20 ? 0 : z2;
        z[k + 2] = y1 > -1e-20 && y1 < 1e-20 ? 0 : y1;
        z[k + 3] = y2 > -1e-20 && y2 < 1e-20 ? 0 : y2;
      }
      if (gan !== 1) {
        for (let i = desde; i < hasta; i++) {
          sI[i] *= gan;
          sD[i] *= gan;
        }
      }
    };

    return { poner, procesar };
  };
}

// EL PROCESADOR: los parámetros de cada banda (`b1on`, `b1tipo`, `b1frec`, `b1gan`, `b1q`,
// `b1pend`… hasta la 8) y `salida`.
export function procesadorEq(moduleId, nucleoEq) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo, pzCrearEq } = ambito;
  const { TIPOS, PENDIENTES } = nucleoEq();
  const BANDAS = 8;
  const FRECUENCIAS = [30, 100, 250, 600, 1500, 3500, 8000, 16000];

  class ProcesadorEq extends WamProcessor {
    constructor(options) {
      super(options);
      this._dsp = pzCrearEq(sampleRate, BANDAS);
      this._cero = new Float32Array(128);
      // los nombres de los parámetros, armados una vez (nada de armar textos en cada bloque)
      this._ids = [];
      for (let b = 1; b <= BANDAS; b++) this._ids.push([`b${b}on`, `b${b}tipo`, `b${b}frec`, `b${b}gan`, `b${b}q`, `b${b}pend`]);
    }

    _generateWamParameterInfo() {
      const info = {};
      const f = (id, label, defaultValue, minValue, maxValue, units) => {
        info[id] = new WamParameterInfo(id, { type: 'float', label, defaultValue, minValue, maxValue, units });
      };
      for (let b = 1; b <= BANDAS; b++) {
        info[`b${b}on`] = new WamParameterInfo(`b${b}on`, { type: 'boolean', label: `Banda ${b}`, defaultValue: 0 });
        info[`b${b}tipo`] = new WamParameterInfo(`b${b}tipo`, { type: 'choice', label: `Banda ${b}: tipo`, defaultValue: 0, choices: TIPOS });
        f(`b${b}frec`, `Banda ${b}: frecuencia`, FRECUENCIAS[b - 1], 20, 20000, 'Hz');
        f(`b${b}gan`, `Banda ${b}: ganancia`, 0, -24, 24, 'dB');
        f(`b${b}q`, `Banda ${b}: Q`, 1, 0.1, 18, '');
        info[`b${b}pend`] = new WamParameterInfo(`b${b}pend`, { type: 'choice', label: `Banda ${b}: pendiente del corte`, defaultValue: 0, choices: PENDIENTES });
      }
      f('salida', 'Salida', 0, -24, 24, 'dB');
      return info;
    }

    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const ent = inputs[0];
      const eI = ent && ent[0] ? ent[0] : this._cero;
      const eD = ent && ent[1] ? ent[1] : eI;
      const I = this._parameterInterpolators;
      for (let b = 0; b < BANDAS; b++) {
        const id = this._ids[b];
        this._dsp.poner(
          b,
          I[id[0]].values[desde] >= 0.5,
          Math.round(I[id[1]].values[desde]),
          I[id[2]].values[desde],
          I[id[3]].values[desde],
          I[id[4]].values[desde],
          Math.round(I[id[5]].values[desde]),
        );
      }
      const db = I.salida.values[desde];
      this._dsp.procesar(eI, eD, sal[0], sal[1] || sal[0], desde, hasta, db === 0 ? 1 : 10 ** (db / 20));
    }
  }

  try {
    registerProcessor(moduleId, ProcesadorEq);
  } catch (e) {
    // ya estaba registrado
  }
}
