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
import { estirador, estirarTramos, segundosDe } from './estirar.js';
import { traducirInfo } from '../comun/idiomas.js';

const mandados = new WeakMap();
const PICOS = 1500; // el resumen de la forma de onda, para dibujarla
let cuenta = 0;
const nuevoId = () => `m${Date.now().toString(36)}${(cuenta++).toString(36)}`;

export class NodoSampler extends WamNode {
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
    // Para estirar al tempo: el audio de cada muestra (también queda acá), el tempo que avisa el
    // anfitrión y lo ya estirado (llave → id de la muestra estirada que tiene el hilo de audio).
    this._audios = {};
    this.bpm = 120;
    this._estirados = new Map();
    this._necesarias = new Set();
    this._cola = [];
    this._enCurso = null;
    this._reloj = 0;
  }

  // Lo que manda el hilo de audio: el tempo del anfitrión.
  _onMessage(message) {
    const d = message && message.data;
    if (d && d.pz === 'tempo') {
      this.bpm = Number(d.bpm) || 120;
      this._mandarInst();
      this._avisar();
      return;
    }
    return super._onMessage(message);
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
    this._mandarInst();
    this._avisar();
  }

  // EL INSTRUMENTO QUE SUENA: el mismo, pero con cada capa que se estira al tempo cambiada por su
  // muestra estirada (y sus marcas, a lo estirado), y, si además sigue la altura de la nota, con
  // una versión estirada por cada nota (`var`), para que el largo no cambie con la altura (JP:
  // «mantener el pitch y el largo»). Estirar pesa: se hace en un Worker (o, si la página no lo
  // deja, aquí mismo, de a uno), y mientras tanto suena lo que ya está.
  _mandarInst() {
    this._enviarInst(this._resolver());
  }
  _enviarInst(inst) {
    if (this._destroyed) return;
    this.port.postMessage({ pz: 'inst', inst });
    // lo estirado que ya no se usa, fuera
    for (const [llave, x] of this._estirados) {
      if (this._necesarias.has(llave)) continue;
      this._estirados.delete(llave);
      this.port.postMessage({ pz: 'quitar', m: x.id });
    }
  }
  _resolver() {
    const necesarias = new Set();
    const pedidos = [];
    const zonas = this.inst.zonas.map((z) => ({ ...z, capas: (z.capas || []).map((c) => this._estirarCapa(z, c, necesarias, pedidos)) }));
    this._necesarias = necesarias;
    // primero lo de la raíz, después las notas más cercanas a ella
    pedidos.sort((a, b) => a.orden - b.orden);
    this._cola = pedidos.filter((x) => !this._estirados.has(x.llave));
    this._seguir();
    return { zonas };
  }
  // Las partes de una capa como tramos del audio: [desde, hasta, ajuste, sigue la nota].
  _partes(z, c, dur) {
    const num = (x, d) => (x === undefined || x === null ? d : Math.max(0, Math.min(dur, Number(x) || 0)));
    const fin = num(c.fin, dur);
    const alt = Array.isArray(c.alt) ? c.alt : [];
    if (z.tajadas) {
      const cs = Array.isArray(c.cortes) && c.cortes.length ? c.cortes : [0];
      return [[cs[0], fin, c.est[0], false]];
    }
    const ini = num(c.ini, 0);
    if (!c.loop) return [[ini, fin, c.est[0], alt[1] !== false]];
    const lIni = Math.max(ini, num(c.lIni, ini));
    const lFin = Math.min(fin, Math.max(lIni, num(c.lFin, fin)));
    return [
      [ini, lIni, c.est[0], alt[0] !== false],
      [lIni, lFin, c.est[1], alt[1] !== false],
      [lFin, fin, c.est[2], alt[2] !== false],
    ];
  }
  // Las marcas de una capa sobre lo estirado.
  _marcas(z, c, partes, x, fm, f0) {
    const s = (k) => x.bordes[k] / fm;
    if (z.tajadas) return { m: x.id, cortes: (c.cortes && c.cortes.length ? c.cortes : [0]).map((k) => Math.max(0, (k - partes[0][0]) * f0)), fin: s(1) };
    if (c.loop) return { m: x.id, ini: 0, lIni: s(1), lFin: s(2), fin: s(3) };
    return { m: x.id, ini: 0, lIni: undefined, lFin: undefined, fin: s(1) };
  }
  _estirarCapa(z, c, necesarias, pedidos) {
    const au = c && !c.osc && this._audios[c.m];
    if (!au || !Array.isArray(c.est)) return c;
    const fm = au.fm;
    const partes = this._partes(z, c, au.canales[0].length / fm);
    const base = partes.map(([a, b, e]) => {
      const s = segundosDe(e, this.bpm);
      return { a: Math.round(a * fm), b: Math.round(b * fm), f: s > 0 && b > a ? Math.round((s / (b - a)) * 1e4) / 1e4 : 1 };
    });
    if (base.every((t) => t.f === 1)) return c;
    const pedir = (tramos, orden) => {
      const llave = `${c.m}|${tramos.map((t) => `${t.a},${t.b},${t.f}`).join('|')}`;
      necesarias.add(llave);
      const x = this._estirados.get(llave);
      if (!x) pedidos.push({ llave, m: c.m, au, tramos, orden });
      return x || null;
    };
    const xb = pedir(base, 0);
    const sale = xb ? { ...c, ...this._marcas(z, c, partes, xb, fm, base[0].f) } : { ...c };
    // Una versión por nota para las partes estiradas que siguen la altura.
    const conNota = !z.tajadas && partes.some(([, , e, sigue], k) => sigue && base[k].f !== 1);
    if (conNota) {
      const raiz = Number(z.raiz) || 60;
      const vars = {};
      for (let n = Math.max(z.baja, raiz - 24); n <= Math.min(z.alta, raiz + 24); n++) {
        const r = Math.pow(2, (n - raiz + (Number(c.afinar) || 0)) / 12);
        if (Math.abs(r - 1) < 1e-3) continue;
        const tramos = base.map((t, k) => (partes[k][3] && t.f !== 1 ? { ...t, f: Math.round(t.f * r * 1e4) / 1e4 } : t));
        const x = pedir(tramos, 1 + Math.abs(n - raiz));
        if (x) vars[n] = this._marcas(z, c, partes, x, fm, tramos[0].f);
      }
      sale.var = vars;
    }
    return sale;
  }
  // El Worker que estira (una vez por nodo); null si la página no deja crearlo.
  _trabajador() {
    if (this._worker !== undefined) return this._worker;
    try {
      const src = `const E = (${estirador.toString()})();\nonmessage = (ev) => { const r = E.estirarTramos(ev.data.canales, ev.data.tramos); postMessage({ canales: r.canales, bordes: r.bordes }, r.canales.map((k) => k.buffer)); };`;
      this._worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) {
      this._worker = null;
    }
    return this._worker;
  }
  // Estirar lo que sigue en la cola, de a uno.
  _seguir() {
    if (this._enCurso || this._destroyed) return;
    let p = this._cola.shift();
    while (p && (!this._necesarias.has(p.llave) || this._estirados.has(p.llave))) p = this._cola.shift();
    if (!p) return;
    this._enCurso = p.llave;
    // solo el pedazo del audio que se estira
    const a = p.tramos[0].a;
    const b = p.tramos[p.tramos.length - 1].b;
    const canales = p.au.canales.map((k) => k.slice(a, b));
    const tramos = p.tramos.map((t) => ({ a: t.a - a, b: t.b - a, f: t.f }));
    const listo = (r) => {
      this._enCurso = null;
      if (this._destroyed) return;
      const x = { id: `${p.m}~${(cuenta++).toString(36)}`, bordes: r.bordes };
      this._estirados.set(p.llave, x);
      this.port.postMessage({ pz: 'muestra', m: x.id, canales: r.canales, fm: p.au.fm }, r.canales.map((k) => k.buffer));
      clearTimeout(this._reloj);
      this._reloj = setTimeout(() => this._enviarInst(this._resolver()), 60);
      this._seguir();
    };
    const aqui = () => setTimeout(() => listo(estirarTramos(canales, tramos)), 0);
    const w = this._trabajador();
    if (!w) {
      aqui();
      return;
    }
    w.onmessage = (ev) => listo(ev.data);
    w.onerror = () => {
      this._worker = null;
      aqui();
    };
    try {
      w.postMessage({ canales, tramos });
    } catch (e) {
      this._worker = null;
      aqui();
    }
  }
  destroy() {
    if (this._worker) this._worker.terminate();
    super.destroy();
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
    this._audios[m] = { canales, fm: b.sampleRate };
    const copia = canales.map((c) => c.slice());
    if (!this._destroyed) this.port.postMessage({ pz: 'muestra', m, canales: copia, fm: b.sampleRate }, copia.map((c) => c.buffer));
    // si alguna capa de esta muestra se estira, ahora se puede
    this._mandarInst();
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
    delete this._audios[m];
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
