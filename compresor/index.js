// COMPRESOR Y LIMITADOR — plugin WAM 2.0 propio (2026-11-23).
//
// No importa nada de Pizarrita: solo el SDK de WAM. Lo arma `armar.sh`
// (esbuild) a `dist/compresor/index.js`. El sonido se calcula en `procesador.js` (hilo de
// audio); acá está el nodo, que es lo que el anfitrión conecta, y el módulo, que es lo que
// el anfitrión carga.
import { WebAudioModule, WamNode, addFunctionModule } from '@webaudiomodules/sdk';
import descriptor from './descriptor.json';
import { dspCompresor, procesadorCompresor } from './procesador.js';
import { crearCaratula } from './caratula.js';

// Los módulos del hilo de audio se mandan una vez por contexto, no una por instancia.
const mandados = new WeakMap();

class NodoCompresor extends WamNode {
  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await addFunctionModule(contexto.audioWorklet, dspCompresor, moduleId);
        await addFunctionModule(contexto.audioWorklet, procesadorCompresor, moduleId);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }

  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    // Lo último que midió el hilo de audio (dB): entrada, salida, reducción del compresor
    // y del limitador. Solo se actualiza mientras alguna carátula lo pida con `medir(true)`.
    this.medidor = { e: -180, s: -180, r: 0, l: 0 };
    this._pidenMedir = 0;
  }

  _onMessage(message) {
    const d = message.data;
    if (d && d.pz === 'medidor') {
      this.medidor = d;
      return;
    }
    super._onMessage(message);
  }

  medir(si) {
    this._pidenMedir = Math.max(0, this._pidenMedir + (si ? 1 : -1));
    if (this._destroyed) return;
    this.port.postMessage({ pz: 'medir', si: this._pidenMedir > 0 });
  }
}

export default class Compresor extends WebAudioModule {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }

  async createAudioNode(estado) {
    await NodoCompresor.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoCompresor(this);
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
