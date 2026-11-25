// Vista de la carátula del sampler sin audio: un nodo de mentira con dos muestras inventadas.
import { crearCaratula } from '../caratula.js';
import { energias, golpes } from '../tajadas.js';
import { nucleoSampler } from '../nucleo.js';

const FM = 44100;
const picosDe = (c) => {
  const P = 1500;
  const out = new Float32Array(P * 2);
  for (let k = 0; k < P; k++) {
    let lo = 0;
    let hi = 0;
    const a = Math.floor((k * c.length) / P);
    const z = Math.floor(((k + 1) * c.length) / P);
    for (let i = a; i < z; i++) {
      if (c[i] < lo) lo = c[i];
      if (c[i] > hi) hi = c[i];
    }
    out[2 * k] = lo;
    out[2 * k + 1] = hi;
  }
  return out;
};
// un piano inventado: un La que se apaga
const piano = new Float32Array(FM * 3);
for (let i = 0; i < piano.length; i++) piano[i] = 0.7 * Math.exp(-i / (FM * 0.9)) * (Math.sin((2 * Math.PI * 220 * i) / FM) + 0.3 * Math.sin((2 * Math.PI * 440 * i) / FM));
// un loop de batería inventado: ocho golpes
let s = 7;
const azar = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
const bateria = new Float32Array(FM * 2);
[0, 0.25, 0.5, 0.625, 0.75, 1, 1.25, 1.5, 1.75].forEach((t0, n) => {
  const i0 = Math.round(t0 * FM);
  const largo = n % 2 ? 0.04 : 0.12;
  for (let i = 0; i < 0.3 * FM && i0 + i < bateria.length; i++) bateria[i0 + i] += (n % 2 ? 0.5 * azar() : 0.9 * Math.sin((2 * Math.PI * 60 * i) / FM)) * Math.exp(-i / (largo * FM));
});

const N = nucleoSampler();
const params = {};
for (const p of N.PARAMS) params[p.id] = { id: p.id, value: p.defecto };
const oyentes = new Set();
const nodo = {
  bpm: 120,
  inst: { zonas: [] },
  muestras: {
    piano: { url: 'https://ejemplo.org/piano.wav', nombre: 'piano.wav', estado: 'lista', dur: 3, picos: picosDe(piano), en: energias([piano], FM) },
    bateria: { url: 'https://ejemplo.org/loop.wav', nombre: 'loop de batería.wav', estado: 'lista', dur: 2, picos: picosDe(bateria), en: energias([bateria], FM) },
  },
  alCambiar: (f) => (oyentes.add(f), () => oyentes.delete(f)),
  ponerInstrumento(i) {
    this.inst = i;
    for (const f of oyentes) f();
  },
  detectarGolpes(m, sens) {
    return golpes(this.muestras[m].en, sens);
  },
  tocar() {},
  quitarMuestra() {},
  cargarArchivo: async () => 'piano',
  cargarDireccion: async () => 'piano',
  getParameterValues: async () => params,
  setParameterValues: async (v) => Object.assign(params, v),
  pz: { elegirAudio: async () => null },
};
window.__vista = {
  nodo,
  params,
  mostrar(inst) {
    nodo.inst = inst;
    document.body.innerHTML = '';
    const marco = document.createElement('div');
    marco.style.cssText = 'padding:8px;display:inline-block;';
    marco.append(crearCaratula(nodo));
    document.body.append(marco);
  },
};
