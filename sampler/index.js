// SAMPLER — plugin WAM 2.0 propio (2026-11-24). Diseño: `DISENO.md`.
//
// No importa nada de Pizarrita: solo el SDK de WAM. El sonido se calcula en el hilo de audio
// (`procesador.js` con `nucleo.js`); acá están el nodo (guarda el instrumento, baja y decodifica
// los audios y se los manda al hilo de audio) y el módulo.
//
// EL ESTADO (`getState`/`setState`): los parámetros, el instrumento (zonas y capas) y, por cada
// muestra, su dirección y su nombre. Los audios no van en el estado: se vuelven a bajar de su
// dirección. Una muestra abierta desde un archivo del computador no tiene dirección y no queda.
import { WebAudioModule, WamNode } from '@webaudiomodules/sdk';
import descriptor from './descriptor.json';
import { mandarConFunciones } from '../comun/hilo.js';
import { nucleoSampler } from './nucleo.js';
import { procesadorSampler } from './procesador.js';
import { crearCaratula } from './caratula.js';
import { energias, golpes } from './tajadas.js';
import { traducirInfo } from '../comun/idiomas.js';

const mandados = new WeakMap();
const PICOS = 1500; // el resumen de la forma de onda, para dibujarla
let cuenta = 0;
const nuevoId = () => `m${Date.now().toString(36)}${(cuenta++).toString(36)}`;

class NodoSampler extends WamNode {
  async getParameterInfo(...ids) {
    return traducirInfo(await super.getParameterInfo(...ids));
  }

  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await mandarConFunciones(contexto.audioWorklet, procesadorSampler, moduleId, nucleoSampler);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }

  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.inst = { zonas: [] };
    // m → { url, nombre, estado: 'bajando' | 'lista' | 'error', dur, picos }
    this.muestras = {};
    this._oyentes = new Set();
  }

  // Quien dibuja se entera de los cambios (el instrumento, una muestra que terminó de bajar).
  alCambiar(f) {
    this._oyentes.add(f);
    return () => this._oyentes.delete(f);
  }
  _avisar() {
    for (const f of this._oyentes) {
      try {
        f();
      } catch (e) {
        // quien escuchaba ya no está
      }
    }
  }

  ponerInstrumento(inst) {
    this.inst = inst && Array.isArray(inst.zonas) ? inst : { zonas: [] };
    if (!this._destroyed) this.port.postMessage({ pz: 'inst', inst: this.inst });
    this._avisar();
  }

  // Una muestra desde una dirección web (queda en el estado) o desde un archivo (no queda).
  async cargarDireccion(url, nombre, m = nuevoId()) {
    this.muestras[m] = { url, nombre: nombre || decodeURIComponent(String(url).split('/').pop() || 'audio'), estado: 'bajando' };
    this._avisar();
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      await this._decodificar(m, await r.arrayBuffer());
    } catch (e) {
      this.muestras[m].estado = 'error';
      this._avisar();
    }
    return m;
  }
  async cargarArchivo(archivo, m = nuevoId()) {
    this.muestras[m] = { url: null, nombre: archivo.name, estado: 'bajando' };
    this._avisar();
    try {
      await this._decodificar(m, await archivo.arrayBuffer());
    } catch (e) {
      this.muestras[m].estado = 'error';
      this._avisar();
    }
    return m;
  }
  async _decodificar(m, datos) {
    const b = await this.context.decodeAudioData(datos);
    const canales = [];
    for (let c = 0; c < Math.min(2, b.numberOfChannels); c++) canales.push(b.getChannelData(c).slice());
    // El resumen para dibujar: el mínimo y el máximo de cada tramo.
    const picos = new Float32Array(PICOS * 2);
    const n = canales[0].length;
    for (let k = 0; k < PICOS; k++) {
      let lo = 0;
      let hi = 0;
      const a = Math.floor((k * n) / PICOS);
      const z = Math.max(a + 1, Math.floor(((k + 1) * n) / PICOS));
      for (let i = a; i < z && i < n; i++) {
        for (const ch of canales) {
          const x = ch[i];
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
      }
      picos[2 * k] = lo;
      picos[2 * k + 1] = hi;
    }
    // La energía de lo agudo, para detectar los golpes (las tajadas) sin guardar el audio acá.
    const en = energias(canales, b.sampleRate);
    Object.assign(this.muestras[m], { estado: 'lista', dur: b.duration, picos, en });
    if (!this._destroyed) this.port.postMessage({ pz: 'muestra', m, canales, fm: b.sampleRate }, canales.map((c) => c.buffer));
    this._avisar();
  }
  // Dónde empiezan los golpes de una muestra (segundos); `sens` 0…100.
  detectarGolpes(m, sens) {
    const mu = this.muestras[m];
    return mu && mu.en ? golpes(mu.en, sens) : [];
  }
  // Tocar una nota desde la carátula (para oír una tajada).
  tocar(nota) {
    const t0 = this.context.currentTime;
    this.scheduleEvents({ type: 'wam-midi', time: t0, data: { bytes: [0x90, nota, 100] } }, { type: 'wam-midi', time: t0 + 0.05, data: { bytes: [0x80, nota, 0] } });
  }
  quitarMuestra(m) {
    delete this.muestras[m];
    if (!this._destroyed) this.port.postMessage({ pz: 'quitar', m });
    this._avisar();
  }

  async getState() {
    const s = (await super.getState()) || {};
    const muestras = {};
    for (const [m, x] of Object.entries(this.muestras)) if (x.url) muestras[m] = { url: x.url, nombre: x.nombre };
    return { ...s, inst: this.inst, muestras };
  }
  async setState(estado) {
    await super.setState(estado);
    if (!estado || typeof estado !== 'object') return;
    if (estado.inst) this.ponerInstrumento(estado.inst);
    const pedidas = estado.muestras && typeof estado.muestras === 'object' ? estado.muestras : {};
    for (const [m, x] of Object.entries(pedidas)) {
      if (!x || typeof x.url !== 'string') continue;
      const ya = this.muestras[m];
      if (ya && ya.url === x.url && ya.estado !== 'error') continue;
      void this.cargarDireccion(x.url, x.nombre, m);
    }
  }
}

export default class Sampler extends WebAudioModule {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }

  async createAudioNode(estado) {
    await NodoSampler.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoSampler(this);
    await nodo._initialize();
    if (estado) await nodo.setState(estado);
    return nodo;
  }

  async createGui() {
    return crearCaratula(this.audioNode);
  }

  destroyGui(gui) {
    if (gui && gui._pzSoltar) gui._pzSoltar();
  }
}
