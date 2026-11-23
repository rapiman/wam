// COMPRESOR Y LIMITADOR — lo que corre en el hilo de audio (2026-11-23).
//
// Dos funciones que el SDK de WAM manda al hilo de audio COMO TEXTO (`addFunctionModule`):
// por eso cada una se basta sola (nada de imports ni de variables de afuera) y no se
// minifican. La primera deja el cálculo en el ámbito del módulo; la segunda registra el
// procesador. Separadas para poder probar el cálculo con Node, sin navegador
// (`prueba.mjs`).

// EL CÁLCULO. `pzCrearCompresor(frecuenciaDeMuestreo)` devuelve el compresor de una instancia.
export function dspCompresor(moduleId) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const K = Math.LN10 / 20;
  const aDb = (x) => 20 * Math.log10(x + 1e-9);
  const deDb = (d) => Math.exp(d * K);

  ambito.pzCrearCompresor = (fm) => {
    // --- Compresor: detector de pico con las dos orejas unidas, rodilla blanda, y la
    // reducción suavizada en dB («detector desacoplado»: la relajación sostiene el pico y el
    // ataque suaviza la entrada), para que un tono parejo llegue a la reducción que dice la curva.
    let sosten = 0; // cuánto habría que reducir (dB, positivo), sostenido por la relajación
    let red = 0; // la reducción que se aplica (dB, positivo)

    // --- Limitador: mira ATRASO muestras hacia adelante. La ganancia necesaria pasa por un
    // mínimo deslizante de VENTANA muestras y después por un promedio de VENTANA muestras;
    // con el sonido atrasado VENTANA-1 muestras, la ganancia ya bajó lo suficiente justo
    // cuando llega el pico: ninguna muestra pasa del techo y no hay saltos bruscos.
    const ATRASO = Math.max(1, Math.round(0.005 * fm));
    const VENTANA = ATRASO + 1;
    const lineaI = new Float32Array(VENTANA);
    const lineaD = new Float32Array(VENTANA);
    let pos = 0;
    const C = VENTANA + 1; // la cola del mínimo deslizante
    const colaV = new Float64Array(C);
    const colaN = new Float64Array(C);
    let cab = 0;
    let fin = 0;
    let cuantos = 0;
    const cajon = new Float64Array(VENTANA).fill(1);
    let suma = VENTANA;
    let posCajon = 0;
    let env = 1;
    let n = 0;
    let limAntes = false;

    // Lo que miran los medidores (se vacía al leerlo).
    let picoE = 0;
    let picoS = 0;
    let maxRed = 0;
    let minLim = 1;
    let recortes = 0;

    const reiniciarLimitador = () => {
      lineaI.fill(0);
      lineaD.fill(0);
      pos = 0;
      cab = 0;
      fin = 0;
      cuantos = 0;
      cajon.fill(1);
      suma = VENTANA;
      posCajon = 0;
      env = 1;
      n = 0;
    };

    // p: { comp, umbral, razon, ataque, relajacion, rodilla, ganancia, mezcla, lim, techo }
    // (dB, ms y mezcla en 0..100). Lee eI/eD y escribe sI/sD entre `desde` y `hasta`.
    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const cA = Math.exp(-1 / (0.001 * Math.max(0.05, p.ataque) * fm));
      const cR = Math.exp(-1 / (0.001 * Math.max(1, p.relajacion) * fm));
      const T = p.umbral;
      const W = Math.max(0, p.rodilla);
      const pend = 1 - 1 / Math.max(1, p.razon);
      const gan = deDb(p.ganancia);
      const mz = Math.min(1, Math.max(0, p.mezcla / 100));
      const techo = deDb(p.techo);
      const cLib = Math.exp(-1 / (0.1 * fm)); // el limitador suelta en 100 ms
      if (p.lim && !limAntes) reiniciarLimitador();
      limAntes = !!p.lim;

      for (let i = desde; i < hasta; i++) {
        const l = eI[i];
        const r = eD[i];
        const al = l < 0 ? -l : l;
        const ar = r < 0 ? -r : r;
        const pico = al > ar ? al : ar;
        if (pico > picoE) picoE = pico;
        let yl = l;
        let yr = r;

        if (p.comp) {
          const sobre = aDb(pico) - T;
          let obj;
          if (2 * sobre <= -W) obj = 0;
          else if (2 * sobre < W) {
            const t = sobre + W / 2;
            obj = (pend * t * t) / (2 * W);
          } else obj = pend * sobre;
          const baja = cR * sosten + (1 - cR) * obj;
          sosten = obj > baja ? obj : baja;
          red = cA * red + (1 - cA) * sosten;
          if (red < 1e-7) red = 0;
          if (sosten < 1e-7) sosten = 0;
          if (red > maxRed) maxRed = red;
          const g = 1 - mz + mz * deDb(-red) * gan;
          yl = l * g;
          yr = r * g;
        }

        if (p.lim) {
          const bl = yl < 0 ? -yl : yl;
          const br = yr < 0 ? -yr : yr;
          const pico2 = bl > br ? bl : br;
          const nec = pico2 > techo ? techo / pico2 : 1;
          const sube = 1 - (1 - env) * cLib;
          env = nec < sube ? nec : sube;
          // mínimo deslizante de las últimas VENTANA muestras
          while (cuantos > 0 && colaV[(fin - 1 + C) % C] >= env) {
            fin = (fin - 1 + C) % C;
            cuantos--;
          }
          colaV[fin] = env;
          colaN[fin] = n;
          fin = (fin + 1) % C;
          cuantos++;
          while (colaN[cab] <= n - VENTANA) {
            cab = (cab + 1) % C;
            cuantos--;
          }
          const minimo = colaV[cab];
          n++;
          // promedio de las últimas VENTANA muestras del mínimo
          suma += minimo - cajon[posCajon];
          cajon[posCajon] = minimo;
          posCajon = (posCajon + 1) % VENTANA;
          const g2 = suma / VENTANA;
          if (g2 < minLim) minLim = g2;
          // el sonido, atrasado VENTANA-1 muestras
          lineaI[pos] = yl;
          lineaD[pos] = yr;
          pos = (pos + 1) % VENTANA;
          yl = lineaI[pos] * g2;
          yr = lineaD[pos] * g2;
          // por redondeo, nunca por diseño
          const tope = techo * 1.000001;
          if (yl > tope || yl < -tope || yr > tope || yr < -tope) recortes++;
          if (yl > techo) yl = techo;
          else if (yl < -techo) yl = -techo;
          if (yr > techo) yr = techo;
          else if (yr < -techo) yr = -techo;
        }

        const cl = yl < 0 ? -yl : yl;
        const cr = yr < 0 ? -yr : yr;
        if (cl > picoS) picoS = cl;
        if (cr > picoS) picoS = cr;
        sI[i] = yl;
        sD[i] = yr;
      }
    };

    // Entrada y salida en dB (pico), reducción del compresor y del limitador en dB (negativas).
    const medidas = () => {
      const m = { e: aDb(picoE), s: aDb(picoS), r: -maxRed, l: aDb(minLim), recortes };
      picoE = 0;
      picoS = 0;
      maxRed = red;
      minLim = 1;
      recortes = 0;
      return m;
    };

    return { procesar, medidas, atraso: ATRASO };
  };
}

// EL PROCESADOR: los parámetros (lo que un anfitrión WAM ve y automatiza) y el paso del
// sonido por el cálculo.
export function procesadorCompresor(moduleId) {
  const ambito = globalThis.webAudioModules.getModuleScope(moduleId);
  const { WamProcessor, WamParameterInfo, pzCrearCompresor } = ambito;

  class ProcesadorCompresor extends WamProcessor {
    constructor(options) {
      super(options);
      this._dsp = pzCrearCompresor(sampleRate);
      this._cero = new Float32Array(128);
      this._medir = false;
      this._cuenta = 0;
      this._p = {};
    }

    _generateWamParameterInfo() {
      const f = (id, label, defaultValue, minValue, maxValue, units) =>
        new WamParameterInfo(id, { type: 'float', label, defaultValue, minValue, maxValue, units });
      const b = (id, label, defaultValue) => new WamParameterInfo(id, { type: 'boolean', label, defaultValue });
      return {
        comp: b('comp', 'Compresor', 1),
        umbral: f('umbral', 'Umbral', -18, -60, 0, 'dB'),
        razon: f('razon', 'Razón', 4, 1, 20, ': 1'),
        ataque: f('ataque', 'Ataque', 10, 0.1, 250, 'ms'),
        relajacion: f('relajacion', 'Relajación', 120, 10, 2000, 'ms'),
        rodilla: f('rodilla', 'Rodilla', 6, 0, 24, 'dB'),
        ganancia: f('ganancia', 'Ganancia', 0, -12, 24, 'dB'),
        mezcla: f('mezcla', 'Mezcla', 100, 0, 100, '%'),
        lim: b('lim', 'Limitador', 0),
        techo: f('techo', 'Techo', -0.3, -12, 0, 'dB'),
      };
    }

    // Además de lo del SDK: la carátula pide (o deja de pedir) las medidas.
    async _onMessage(message) {
      if (message.data && message.data.pz === 'medir') {
        this._medir = !!message.data.si;
        this._dsp.medidas();
        return;
      }
      return super._onMessage(message);
    }

    _process(desde, hasta, inputs, outputs) {
      const sal = outputs[0];
      if (!sal || !sal.length) return;
      const ent = inputs[0];
      const eI = ent && ent[0] ? ent[0] : this._cero;
      const eD = ent && ent[1] ? ent[1] : eI;
      const I = this._parameterInterpolators;
      const p = this._p;
      p.comp = I.comp.values[desde] >= 0.5;
      p.umbral = I.umbral.values[desde];
      p.razon = I.razon.values[desde];
      p.ataque = I.ataque.values[desde];
      p.relajacion = I.relajacion.values[desde];
      p.rodilla = I.rodilla.values[desde];
      p.ganancia = I.ganancia.values[desde];
      p.mezcla = I.mezcla.values[desde];
      p.lim = I.lim.values[desde] >= 0.5;
      p.techo = I.techo.values[desde];
      this._dsp.procesar(eI, eD, sal[0], sal[1] || sal[0], desde, hasta, p);
      this._compensationDelay = p.lim ? this._dsp.atraso / sampleRate : 0;

      this._cuenta += hasta - desde;
      if (this._cuenta >= 1024) {
        this._cuenta = 0;
        if (this._medir) this.port.postMessage({ pz: 'medidor', ...this._dsp.medidas() });
      }
    }
  }

  // Cada instancia nueva vuelve a mandar este módulo: registrar dos veces da error.
  try {
    registerProcessor(moduleId, ProcesadorCompresor);
  } catch (e) {
    // ya estaba registrado
  }
}
