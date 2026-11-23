// ECUALIZADOR PARAMÉTRICO — plugin WAM 2.0 propio (2026-11-23).
//
// Solo importa el SDK de WAM. Lo arma `armar.sh` (esbuild) a `dist/ecualizador/index.js`.
// El filtrado está en `procesador.js` (hilo de audio) y la cuenta de cada banda en `nucleo.js`,
// que usan por igual el hilo de audio y la carátula.
import { WebAudioModule, WamNode } from '@webaudiomodules/sdk';
import descriptor from './descriptor.json';
import { mandarConFunciones } from '../comun/hilo.js';
import { nucleoEq } from './nucleo.js';
import { dspEq, procesadorEq } from './procesador.js';
import { crearCaratula } from './caratula.js';

// Los módulos del hilo de audio se mandan una vez por contexto, no una por instancia.
const mandados = new WeakMap();

class NodoEq extends WamNode {
  static addModules(contexto, moduleId) {
    let p = mandados.get(contexto);
    if (!p) {
      p = (async () => {
        await super.addModules(contexto, moduleId);
        await mandarConFunciones(contexto.audioWorklet, dspEq, moduleId, nucleoEq);
        await mandarConFunciones(contexto.audioWorklet, procesadorEq, moduleId, nucleoEq);
      })();
      mandados.set(contexto, p);
      p.catch(() => mandados.delete(contexto));
    }
    return p;
  }

  constructor(modulo) {
    super(modulo, {
      numberOfInputs: 1,
      // la salida 0 es el sonido ecualizado; la 1, la entrada sin tocar, para el espectro
      numberOfOutputs: 2,
      outputChannelCount: [2, 1],
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
  }
}

export default class Ecualizador extends WebAudioModule {
  async initialize(estado) {
    Object.assign(this._descriptor, descriptor);
    if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
    this.initialized = true;
    return this;
  }

  async createAudioNode(estado) {
    await NodoEq.addModules(this.audioContext, this.moduleId);
    const nodo = new NodoEq(this);
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
