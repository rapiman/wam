// EL MOLDE DE UN EFECTO SIMPLE (2026-11-23): con esto un plugin es su NÚCLEO y poco más.
//
// El núcleo es una función que se basta sola (va al hilo de audio como texto, y la carátula y
// las pruebas la llaman directo). Recibe una configuración opcional (datos) y devuelve:
//   PARAMS       la lista de parámetros: { id, nombre, tipo?: 'float'|'choice'|'boolean', min, max,
//                defecto, unidad?, opciones?, y para la perilla: log?, paso?, dec? }
//   crear(fm)    el efecto de una instancia: { procesar(eI, eD, sI, sD, desde, hasta, p) }, donde
//                `p` trae el valor de cada parámetro por su id.
// Un efecto que además necesita nodos del navegador (la reverb: su convolución) pide más salidas
// (`salidas`) y los arma en `componer(nodo)`, que corre al crear cada instancia.
// El molde pone lo demás: el procesador con esos parámetros WAM, el nodo y el módulo. Todos los
// nodos tienen DOS salidas: la 0 es el sonido; la 1, la entrada sin tocar (mono), que la carátula
// usa para dibujar «cómo está» junto a «cómo queda» y no hay que conectar a nada.
import { WebAudioModule, WamNode } from '@webaudiomodules/sdk';
import { mandarConFunciones } from './hilo.js';
import { traducirInfo } from './idiomas.js';

// Lo que corre en el hilo de audio (se manda como texto: no usa nada de afuera).
export function procesadorDeNucleo(moduleId, nucleo, config) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo } = ambito;
  const N = nucleo(config);
  const ids = N.PARAMS.map((p) => p.id);

  class Procesador extends WamProcessor {
    constructor(options) {
      super(options);
      this._dsp = N.crear(sampleRate);
      this._cero = new Float32Array(128);
      this._p = {};
    }

    _generateWamParameterInfo() {
      const info = {};
      for (const p of N.PARAMS) {
        info[p.id] = new WamParameterInfo(p.id, {
          type: p.tipo || 'float',
          label: p.nombre,
          defaultValue: p.defecto,
          minValue: p.min,
          maxValue: p.max,
          units: p.unidad || '',
          choices: p.opciones,
        });
      }
      return info;
    }

    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const ent = inputs[0];
      const eI = ent && ent[0] ? ent[0] : this._cero;
      const eD = ent && ent[1] ? ent[1] : eI;
      const I = this._parameterInterpolators;
      const p = this._p;
      for (let k = 0; k < ids.length; k++) p[ids[k]] = I[ids[k]].values[desde];
      // (el último argumento, todas las salidas, es para el efecto que necesite más de una)
      this._dsp.procesar(eI, eD, sal[0], sal[1] || sal[0], desde, hasta, p, outputs);
      const copia = outputs[1] && outputs[1][0];
      if (copia) for (let i = desde; i < hasta; i++) copia[i] = 0.5 * (eI[i] + eD[i]);
    }
  }

  try {
    registerProcessor(moduleId, Procesador);
  } catch (e) {
    // ya estaba registrado
  }
}

// El módulo WAM de un núcleo: { descriptor, nucleo, config?, caratula(nodo) → elemento,
// salidas?: canales de cada salida (por defecto [2, 1]), componer?(nodo) }.
export function hacerModulo({ descriptor, nucleo, config = null, caratula, salidas = [2, 1], componer = null }) {
  // Los módulos del hilo de audio se mandan una vez por contexto, no una por instancia.
  const mandados = new WeakMap();

  class Nodo extends WamNode {
    // Los nombres de los parámetros y sus opciones en el idioma de la página (el hilo de audio los
    // declara en castellano: no sabe de idiomas). Ver `comun/idiomas.js`.
    async getParameterInfo(...ids) {
      return traducirInfo(await super.getParameterInfo(...ids));
    }

    static addModules(contexto, moduleId) {
      let p = mandados.get(contexto);
      if (!p) {
        p = (async () => {
          await super.addModules(contexto, moduleId);
          await mandarConFunciones(contexto.audioWorklet, procesadorDeNucleo, moduleId, nucleo, config);
        })();
        mandados.set(contexto, p);
        p.catch(() => mandados.delete(contexto));
      }
      return p;
    }

    constructor(modulo) {
      super(modulo, {
        numberOfInputs: 1,
        numberOfOutputs: salidas.length,
        outputChannelCount: salidas,
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
    }
  }

  return class Modulo extends WebAudioModule {
    async initialize(estado) {
      Object.assign(this._descriptor, descriptor);
      if (!this._audioNode) this.audioNode = await this.createAudioNode(estado);
      this.initialized = true;
      return this;
    }

    async createAudioNode(estado) {
      await Nodo.addModules(this.audioContext, this.moduleId);
      const nodo = new Nodo(this);
      await nodo._initialize();
      if (estado) await nodo.setState(estado);
      if (componer) await componer(nodo);
      return nodo;
    }

    async createGui() {
      return caratula(this.audioNode);
    }

    destroyGui(gui) {
      if (gui && gui._pzSoltar) gui._pzSoltar();
    }
  };
}
