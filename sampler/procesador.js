// EL PROCESADOR DEL SAMPLER (hilo de audio). Va como texto con `mandarConFunciones` junto con
// `nucleoSampler`: tiene que bastarse solo.
//
// Recibe: las notas por MIDI (`wam-midi`: 0x90 encender, 0x80 apagar, CC 120/123 callar todo) y,
// por el puerto, lo que manda el nodo: { pz: 'muestra', m, canales, fm } (los canales ya
// decodificados), { pz: 'quitar', m }, { pz: 'inst', inst } (las zonas) y { pz: 'callar' }.
export function procesadorSampler(moduleId, nucleo) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo } = ambito;
  const N = nucleo();
  const ids = N.PARAMS.map((p) => p.id);

  class ProcesadorSampler extends WamProcessor {
    constructor(options) {
      super(options);
      this._s = N.crear(sampleRate);
      this._p = {};
      for (const p of N.PARAMS) this._p[p.id] = p.defecto;
      this._tmpR = new Float32Array(128);
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

    async _onMessage(message) {
      const d = message.data;
      if (d && d.pz) {
        if (d.pz === 'muestra') this._s.ponerMuestra(d.m, d.canales, d.fm);
        else if (d.pz === 'quitar') this._s.quitarMuestra(d.m);
        else if (d.pz === 'inst') this._s.ponerInstrumento(d.inst);
        else if (d.pz === 'callar') this._s.callar();
        return;
      }
      return super._onMessage(message);
    }

    // El tempo del anfitrión (`wam-transport`): se le pasa al nodo, que es el que estira.
    _onTransport(datos) {
      const bpm = datos && Number(datos.tempo);
      if (bpm > 0 && bpm !== this._bpm) {
        this._bpm = bpm;
        this.port.postMessage({ pz: 'tempo', bpm });
      }
    }

    _onMidi(midi) {
      const b = midi && midi.bytes;
      if (!b) return;
      const tipo = b[0] & 0xf0;
      if (tipo === 0x90 && b[2] > 0) this._s.notaOn(b[1], b[2], this._p);
      else if (tipo === 0x80 || (tipo === 0x90 && b[2] === 0)) this._s.notaOff(b[1]);
      else if (tipo === 0xb0 && (b[1] === 120 || b[1] === 123)) this._s.callar();
    }

    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const I = this._parameterInterpolators;
      for (let k = 0; k < ids.length; k++) this._p[ids[k]] = I[ids[k]].values[desde];
      const L = sal[0];
      // Con una sola salida, la oreja derecha va a un borrador y se suma a la izquierda.
      const R = sal[1] || this._tmpR;
      if (!sal[1]) this._tmpR.fill(0);
      this._s.procesar(L, R, desde, hasta, this._p);
      if (!sal[1]) for (let i = desde; i < hasta; i++) L[i] = 0.5 * (L[i] + R[i]);
    }
  }

  try {
    registerProcessor(moduleId, ProcesadorSampler);
  } catch (e) {
    // ya estaba registrado
  }
}
