// EL CORAZÓN DEL SAMPLER (2026-11-24, JP: «me gustan las 3», piano con zonas, batería con una nota
// por sonido y tajadas; capas; «dónde parte la nota, loop y release, con o sin cambio de altura»).
//
// Solo cuentas: ni nodos del navegador ni nada de afuera. Así corre en el hilo de audio (va como
// texto con `mandarConFunciones`), se prueba con Node (`prueba.mjs`) y algún día se puede pasar a
// un plugin nativo (JP: «quizá armar todo para hacer un VST»).
//
// EL INSTRUMENTO (lo que el hilo principal manda con `ponerInstrumento`):
//   { zonas: [ZONA…] }
//   ZONA  = { baja, alta, raiz, golpe, tajadas, capas: [CAPA…] }   notas MIDI; hasta 3 capas
//           `golpe`: la nota dispara el sonido entero y soltarla no hace nada (batería, tajadas)
//   CAPA  = { m, ini, lIni, lFin, fin, loop, alt: [a, l, r], gan, pan, afinar, cortes }
//           `m`: qué muestra; `ini…fin` en SEGUNDOS de la muestra: dónde parte la nota (ini), el
//           tramo que se repite mientras se sostiene (lIni…lFin, si `loop`) y hasta dónde suena
//           al soltar (fin). Las tres partes: la de entrada (ini…lIni), la del loop y la del
//           release (lFin…fin). `alt[k]`: si esa parte sigue la altura de la nota (si no, suena a
//           la altura de la muestra). `gan` en dB, `pan` −1…1, `afinar` en semitonos.
// Las muestras llegan aparte (`ponerMuestra`), como canales Float32Array con su frecuencia.
//
// TAJADAS (paso 2): una ZONA con `tajadas: true` reparte un audio en las teclas. Cada CAPA lleva
// `cortes` (dónde empieza cada tajada, en segundos, en orden): la nota `baja + i` toca la tajada i,
// desde `cortes[i]` hasta el corte que sigue (la última, hasta `fin`). Suena entera como un golpe,
// a la altura de la muestra (solo la afinación la mueve), con un fundido de 2 ms en cada borde
// para que no haga clic.
//
// FILTRO, COLOR Y VAIVENES (paso 3; JP: «distorsión, efectos sencillos, noise para agregarle
// cuerpo, detune», «osc modulación al pitch, al volumen, al efecto o al filtro», y un sub):
//   - Cada voz pasa por su FILTRO (variable de estado, 12 dB/oct: pasa bajos, altos o banda), con
//     su envolvente propia (sube en «ataque del filtro», cae a cero en «caída del filtro») que
//     mueve el corte hasta ±8 octavas.
//   - Antes del filtro, cada voz suma RUIDO blanco y un SUB (seno o cuadrada una o dos octavas bajo
//     la nota). El DESAFINADO lee cada capa con dos cabezas, una por oreja, separadas en centésimas.
//   - La DISTORSIÓN (tanh) va al final, sobre todo lo que suena, con su mezcla.
//   - Dos VAIVENES (osciladores lentos: seno, triángulo, cuadrada, sierra o azar) que van a la
//     altura, al volumen, al corte del filtro, a la distorsión o al paneo.
//
// OSCILADORES (paso 5; JP: «formas clásicas y samplers»): una CAPA puede ser, en vez de un audio,
// un oscilador: `osc: { forma, ancho }` (forma 0 seno, 1 triángulo, 2 sierra, 3 cuadrada; `ancho`
// del pulso de la cuadrada, 5…95 %). Siempre sigue la altura de la nota; sierra y cuadrada sin
// el zumbido de lo que se dobla (polyBLEP). Suena mientras dure la envolvente; en una zona de golpe
// cae a cero en el «decaimiento» (si no, no se apagaría nunca).

export function nucleoSampler() {
  const TIPOS_FILTRO = ['Apagado', 'Pasa bajos', 'Pasa altos', 'Pasa banda'];
  const FORMAS = ['Seno', 'Triángulo', 'Cuadrada', 'Sierra', 'Azar'];
  const DESTINOS = ['Altura', 'Volumen', 'Filtro', 'Distorsión', 'Paneo'];
  // `grupo` y `corto`: cómo los ordena y los nombra la carátula.
  const vaiven = (k) => [
    { id: `l${k}f`, nombre: `Forma del vaivén ${k}`, corto: 'Forma', grupo: `v${k}`, tipo: 'choice', opciones: FORMAS, defecto: 0, min: 0, max: FORMAS.length - 1 },
    { id: `l${k}v`, nombre: `Velocidad del vaivén ${k}`, corto: 'Velocidad', grupo: `v${k}`, min: 0.05, max: 30, defecto: 2, unidad: 'Hz', paso: 0.01, dec: 2, log: true },
    { id: `l${k}p`, nombre: `Profundidad del vaivén ${k}`, corto: 'Profundidad', grupo: `v${k}`, min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: `l${k}d`, nombre: `Destino del vaivén ${k}`, corto: 'Destino', grupo: `v${k}`, tipo: 'choice', opciones: DESTINOS, defecto: k === 1 ? 0 : 2, min: 0, max: DESTINOS.length - 1 },
  ];
  const PARAMS = [
    { id: 'vol', nombre: 'Volumen', grupo: 'general', min: -60, max: 6, defecto: 0, unidad: 'dB', paso: 0.1, dec: 1 },
    { id: 'atq', nombre: 'Ataque', grupo: 'general', min: 0.5, max: 5000, defecto: 2, unidad: 'ms', paso: 0.1, dec: 1, log: true },
    { id: 'dec', nombre: 'Decaimiento', grupo: 'general', min: 1, max: 5000, defecto: 300, unidad: 'ms', paso: 1, log: true },
    { id: 'sos', nombre: 'Sostenido', grupo: 'general', min: 0, max: 100, defecto: 100, unidad: '%', paso: 1 },
    { id: 'sol', nombre: 'Soltado', grupo: 'general', min: 1, max: 8000, defecto: 200, unidad: 'ms', paso: 1, log: true },
    { id: 'afinar', nombre: 'Afinación', grupo: 'general', min: -24, max: 24, defecto: 0, unidad: 'st', paso: 0.01, dec: 2 },
    { id: 'vel', nombre: 'Sensibilidad', grupo: 'general', min: 0, max: 100, defecto: 70, unidad: '%', paso: 1 },
    { id: 'ftipo', nombre: 'Filtro', corto: 'Tipo', grupo: 'filtro', tipo: 'choice', opciones: TIPOS_FILTRO, defecto: 0, min: 0, max: 3 },
    { id: 'corte', nombre: 'Corte', grupo: 'filtro', min: 20, max: 20000, defecto: 2000, unidad: 'Hz', paso: 1, log: true },
    { id: 'reso', nombre: 'Resonancia', grupo: 'filtro', min: 0, max: 100, defecto: 10, unidad: '%', paso: 1 },
    { id: 'fenv', nombre: 'Envolvente del filtro', corto: 'Envolvente', grupo: 'filtro', min: -8, max: 8, defecto: 0, unidad: 'oct', paso: 0.05, dec: 2 },
    { id: 'fatq', nombre: 'Ataque del filtro', corto: 'Ataque', grupo: 'filtro', min: 0.5, max: 5000, defecto: 2, unidad: 'ms', paso: 0.1, dec: 1, log: true },
    { id: 'fdec', nombre: 'Caída del filtro', corto: 'Caída', grupo: 'filtro', min: 1, max: 5000, defecto: 400, unidad: 'ms', paso: 1, log: true },
    { id: 'dist', nombre: 'Distorsión', grupo: 'color', min: 0, max: 36, defecto: 0, unidad: 'dB', paso: 0.5, dec: 1 },
    { id: 'dmez', nombre: 'Mezcla de la distorsión', corto: 'Mezcla', grupo: 'color', min: 0, max: 100, defecto: 100, unidad: '%', paso: 1 },
    { id: 'ruido', nombre: 'Ruido', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: 'desaf', nombre: 'Desafinado', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: 'ct', paso: 1 },
    { id: 'sub', nombre: 'Sub', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: 'subOct', nombre: 'Octava del sub', corto: 'Octava', grupo: 'color', tipo: 'choice', opciones: ['−1', '−2'], defecto: 0, min: 0, max: 1 },
    { id: 'subForma', nombre: 'Forma del sub', corto: 'Forma', grupo: 'color', tipo: 'choice', opciones: ['Seno', 'Cuadrada'], defecto: 0, min: 0, max: 1 },
    ...vaiven(1),
    ...vaiven(2),
  ];
  const VOCES = 32;
  const CRUCE_S = 0.004; // el loop se junta con un fundido de 4 ms, para que no haga clic
  const AHOGO_S = 0.006; // una voz robada o ahogada se apaga en 6 ms
  const BORDE_S = 0.002; // los bordes de una tajada se funden en 2 ms
  const CADA_FILTRO = 16; // cada cuántas muestras se recalcula el filtro de una voz
  const dB = (x) => Math.pow(10, x / 20);
  const val = (p, id, def) => (p[id] === undefined ? def : p[id]);

  function crear(fm) {
    const muestras = new Map(); // m → { c: Float32Array[], fm }
    let zonas = [];
    const voces = [];
    let orden = 0;
    // los vaivenes: su fase y, en «azar», el valor que sostienen
    const lfo = [
      { fase: 0, azar: 0 },
      { fase: 0, azar: 0 },
    ];
    let semilla = 22222;
    const azar = () => {
      semilla = (semilla * 1664525 + 1013904223) >>> 0;
      return semilla / 2147483648 - 1;
    };
    // lo que dicen los vaivenes en cada muestra del bloque
    let mVol = new Float32Array(128);
    let mFil = new Float32Array(128);
    let mDis = new Float32Array(128);
    let mPan = new Float32Array(128);

    // `tajada`: el número de tajada que toca (en una zona de tajadas), o −1.
    const prepararCapa = (c, tajada = -1) => {
      if (c.osc && typeof c.osc === 'object') {
        const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
        const ang = ((pan + 1) * Math.PI) / 4;
        return {
          osc: true,
          forma: Math.max(0, Math.min(3, Math.round(Number(c.osc.forma) || 0))),
          ancho: Math.max(0.05, Math.min(0.95, (Number(c.osc.ancho) || 50) / 100)),
          gL: 0.5 * dB(Number(c.gan) || 0) * Math.cos(ang),
          gR: 0.5 * dB(Number(c.gan) || 0) * Math.sin(ang),
          afinar: Number(c.afinar) || 0,
        };
      }
      const mu = muestras.get(c.m);
      if (!mu || !mu.c.length || !mu.c[0].length) return null;
      const largo = mu.c[0].length;
      const s = (x) => Math.max(0, Math.min(largo - 1, Math.round((Number(x) || 0) * mu.fm)));
      const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
      const ang = ((pan + 1) * Math.PI) / 4;
      const comun = {
        mu,
        gL: dB(Number(c.gan) || 0) * Math.cos(ang),
        gR: dB(Number(c.gan) || 0) * Math.sin(ang),
        afinar: Number(c.afinar) || 0,
      };
      if (tajada >= 0) {
        const cortes = Array.isArray(c.cortes) ? c.cortes : [];
        if (tajada >= cortes.length) return null;
        const ini = s(cortes[tajada]);
        const finTodo = c.fin === undefined || c.fin === null ? largo - 1 : s(c.fin);
        const fin = tajada + 1 < cortes.length ? Math.min(finTodo, s(cortes[tajada + 1])) : finTodo;
        if (fin - ini < 2) return null;
        return {
          ...comun,
          ini,
          lIni: fin,
          lFin: fin,
          fin,
          loop: false,
          alt: [false, false, false],
          cruce: 1,
          borde: Math.max(1, Math.min(Math.floor((fin - ini) / 2), Math.round(BORDE_S * mu.fm))),
        };
      }
      const fin = c.fin === undefined || c.fin === null ? largo - 1 : s(c.fin);
      const ini = Math.min(s(c.ini), fin);
      let lIni = c.lIni === undefined || c.lIni === null ? ini : Math.max(ini, s(c.lIni));
      let lFin = c.lFin === undefined || c.lFin === null ? fin : Math.min(fin, s(c.lFin));
      if (lFin < lIni) lFin = lIni;
      const loop = !!c.loop && lFin - lIni > 2;
      if (!loop) {
        lIni = Math.min(lIni, fin);
        lFin = Math.min(lFin, fin);
      }
      const alt = Array.isArray(c.alt) ? [c.alt[0] !== false, c.alt[1] !== false, c.alt[2] !== false] : [true, true, true];
      return {
        ...comun,
        ini,
        lIni,
        lFin,
        fin,
        loop,
        alt,
        cruce: Math.max(1, Math.min(Math.floor((lFin - lIni) / 2), Math.round(CRUCE_S * mu.fm))),
        borde: 0,
      };
    };

    // Lo que valía un canal en una posición con decimales (entre dos muestras, en línea recta).
    const leer = (canal, pos) => {
      const i = pos | 0;
      const f = pos - i;
      const a = canal[i];
      const b = i + 1 < canal.length ? canal[i + 1] : a;
      return a + (b - a) * f;
    };
    // Lo que da una cabeza de lectura: con el fundido del loop cerca de su final, y los bordes
    // fundidos de una tajada.
    const cabeza = (c, canal, pos, enLoop) => {
      if (!enLoop && !c.borde) return leer(canal, pos);
      let x = leer(canal, pos);
      if (enLoop && pos >= c.lIni && pos < c.lFin && pos > c.lFin - c.cruce) {
        const a = (pos - (c.lFin - c.cruce)) / c.cruce;
        x = x * (1 - a) + leer(canal, pos - (c.lFin - c.lIni)) * a;
      }
      if (c.borde) {
        const d = Math.min(pos - c.ini, c.fin - pos);
        if (d < c.borde) x *= Math.max(0, d) / c.borde;
      }
      return x;
    };
    const parteDe = (c, pos) => (pos < c.lIni ? 0 : pos < c.lFin ? 1 : 2);

    const zonaDe = (nota) => {
      for (const z of zonas) if (nota >= z.baja && nota <= z.alta) return z;
      return null;
    };

    function notaOn(nota, vel, p) {
      const z = zonaDe(nota);
      if (!z) return;
      const tajadas = !!z.tajadas;
      const golpe = !!z.golpe || tajadas;
      // En batería, la misma nota ahoga a la que sonaba (como un tambor que se vuelve a golpear).
      if (golpe) for (const v of voces) if (v.nota === nota && !v.ahogo) v.ahogo = AHOGO_S * fm;
      const capas = [];
      for (const c of (z.capas || []).slice(0, 3)) {
        const pc = prepararCapa(c, tajadas ? nota - z.baja : -1);
        if (pc) capas.push({ c: pc, pos: pc.osc ? 0 : pc.ini, pos2: pc.osc ? 0 : pc.ini, viva: true, viva2: true });
      }
      if (!capas.length) return;
      // Sin lugar: se roba la más vieja.
      if (voces.length >= VOCES) {
        let vieja = voces[0];
        for (const v of voces) if (v.orden < vieja.orden) vieja = v;
        vieja.ahogo = vieja.ahogo || AHOGO_S * fm;
        if (voces.length >= VOCES + 8) voces.splice(voces.indexOf(vieja), 1);
      }
      const sens = Math.max(0, Math.min(1, val(p, 'vel', 70) / 100));
      voces.push({
        nota,
        raiz: tajadas ? nota : Number(z.raiz) || 60,
        golpe,
        capas,
        // con un oscilador, un golpe cae a cero (si no, sonaría para siempre)
        conOsc: capas.some((x) => x.c.osc),
        gan: 1 - sens + (sens * Math.max(0, Math.min(127, vel))) / 127,
        // la envolvente: fase 0 ataque, 1 decaimiento, 2 sostenido, 3 soltado
        fase: 0,
        env: 0,
        soltada: false,
        ahogo: 0,
        orden: orden++,
        // la envolvente del filtro (sube y cae a cero) y su estado, una pareja por oreja
        fEnv: 0,
        fSube: true,
        f: [0, 0, 0, 0],
        fG: 0,
        fK: 1,
        fCuenta: 0,
        subFase: 0,
      });
    }

    function notaOff(nota) {
      for (const v of voces) if (v.nota === nota && !v.golpe && !v.soltada) v.soltada = true;
    }

    function callar() {
      for (const v of voces) v.ahogo = v.ahogo || AHOGO_S * fm;
    }

    // El escalón suavizado de polyBLEP: lo que se resta cerca de cada salto de la sierra y la
    // cuadrada para que no aparezcan las frecuencias dobladas.
    const blep = (t, dt) => {
      if (t < dt) {
        const x = t / dt;
        return x + x - x * x - 1;
      }
      if (t > 1 - dt) {
        const x = (t - 1) / dt;
        return x * x + x + x + 1;
      }
      return 0;
    };
    const onda = (c, t, dt) => {
      if (c.forma === 0) return Math.sin(2 * Math.PI * t);
      if (c.forma === 1) return 1 - 4 * Math.abs(t - 0.5);
      if (c.forma === 2) return 2 * t - 1 - blep(t, dt);
      const w = c.ancho;
      let t2 = t + 1 - w;
      if (t2 >= 1) t2 -= 1;
      return (t < w ? 1 : -1) + blep(t, dt) - blep(t2, dt);
    };

    // Un vaivén en su fase (0…1): de −1 a 1.
    const forma = (k, ph, l) => {
      if (k === 0) return Math.sin(2 * Math.PI * ph);
      if (k === 1) return 1 - 4 * Math.abs(ph - 0.5);
      if (k === 2) return ph < 0.5 ? 1 : -1;
      if (k === 3) return 2 * ph - 1;
      return l.azar;
    };

    // Llenar `sL`, `sR` entre `desde` y `hasta`. Quien llama los deja en cero: el sampler suma sus
    // voces y después les pasa la distorsión ahí mismo.
    function procesar(sL, sR, desde, hasta, p) {
      const n = hasta - desde;
      if (n <= 0) return;
      if (mVol.length < n) {
        mVol = new Float32Array(n);
        mFil = new Float32Array(n);
        mDis = new Float32Array(n);
        mPan = new Float32Array(n);
      }
      const atq = Math.max(1, (val(p, 'atq', 2) / 1000) * fm);
      const dec = Math.max(1, (val(p, 'dec', 300) / 1000) * fm);
      const sos = Math.max(0, Math.min(1, val(p, 'sos', 100) / 100));
      const sol = Math.max(1, (val(p, 'sol', 200) / 1000) * fm);
      const vol = dB(val(p, 'vol', 0));
      const afinar = val(p, 'afinar', 0);
      const ftipo = Math.round(val(p, 'ftipo', 0));
      const corte = val(p, 'corte', 2000);
      const fK = 1 / (0.5 * Math.pow(40, Math.max(0, Math.min(100, val(p, 'reso', 10))) / 100));
      const fenv = val(p, 'fenv', 0);
      const fatq = Math.max(1, (val(p, 'fatq', 2) / 1000) * fm);
      const fdec = Math.max(1, (val(p, 'fdec', 400) / 1000) * fm);
      const ruido = Math.pow(Math.max(0, val(p, 'ruido', 0)) / 100, 2) * 0.5;
      const desaf = Math.max(0, val(p, 'desaf', 0));
      const sub = (Math.max(0, val(p, 'sub', 0)) / 100) * 0.6;
      const subOct = Math.round(val(p, 'subOct', 0)) === 1 ? 2 : 1;
      const subCuadrada = Math.round(val(p, 'subForma', 0)) === 1;

      // --- los vaivenes: la altura vale para todo el bloque; lo demás, muestra por muestra
      let altSt = 0;
      mVol.fill(1, 0, n);
      mFil.fill(0, 0, n);
      mDis.fill(0, 0, n);
      mPan.fill(0, 0, n);
      let hayPan = false;
      for (let k = 0; k < 2; k++) {
        const pre = `l${k + 1}`;
        const prof = Math.max(0, Math.min(100, val(p, `${pre}p`, 0))) / 100;
        const l = lfo[k];
        const paso = Math.max(0, val(p, `${pre}v`, 2)) / fm;
        if (prof <= 0) {
          l.fase = (l.fase + paso * n) % 1;
          continue;
        }
        const fo = Math.round(val(p, `${pre}f`, 0));
        const de = Math.round(val(p, `${pre}d`, 0));
        if (de === 0) altSt += forma(fo, l.fase, l) * 12 * prof * prof;
        if (de === 4) hayPan = true;
        for (let i = 0; i < n; i++) {
          const x = forma(fo, l.fase, l);
          if (de === 1) mVol[i] *= 1 - (prof * (1 - x)) / 2;
          else if (de === 2) mFil[i] += x * prof * 4;
          else if (de === 3) mDis[i] += x * prof * 24;
          else if (de === 4) mPan[i] += x * prof;
          l.fase += paso;
          if (l.fase >= 1) {
            l.fase -= 1;
            l.azar = azar();
          }
        }
      }

      for (let k = voces.length - 1; k >= 0; k--) {
        const v = voces[k];
        // Cuánto avanza cada capa por muestra de salida, en cada parte (entrada, loop, release);
        // con el desafinado, la cabeza izquierda va un poco abajo y la derecha un poco arriba.
        const dA = Math.pow(2, -desaf / 2400);
        const dB2 = Math.pow(2, desaf / 2400);
        const rates = v.capas.map(({ c }) => {
          if (c.osc) {
            // un oscilador: cuántas vueltas por muestra
            const f = (440 * Math.pow(2, (v.nota - 69 + c.afinar + afinar + altSt) / 12)) / fm;
            return [f, f, f];
          }
          const base = c.mu.fm / fm;
          const conNota = Math.pow(2, (v.nota - v.raiz + c.afinar + afinar + altSt) / 12);
          const sinNota = Math.pow(2, (c.afinar + afinar + altSt) / 12);
          return [base * (c.alt[0] ? conNota : sinNota), base * (c.alt[1] ? conNota : sinNota), base * (c.alt[2] ? conNota : sinNota)];
        });
        const subPaso = (440 * Math.pow(2, (v.nota - 69 - 12 * subOct + afinar + altSt) / 12)) / fm;
        let terminada = false;
        for (let j = 0; j < n; j++) {
          const i = desde + j;
          // la envolvente
          if (v.ahogo) {
            v.env -= 1 / Math.max(1, v.ahogo);
            if (v.env <= 0) {
              terminada = true;
              break;
            }
          } else if (v.soltada && !v.golpe) {
            if (v.fase !== 3) {
              v.fase = 3;
              v.desdeEnv = v.env;
            }
            v.env -= v.desdeEnv / sol;
            if (v.env <= 0) {
              terminada = true;
              break;
            }
          } else if (v.fase === 0) {
            v.env += 1 / atq;
            if (v.env >= 1) {
              v.env = 1;
              v.fase = v.golpe && !v.conOsc ? 2 : 1;
            }
          } else if (v.fase === 1) {
            const piso = v.golpe ? 0 : sos;
            v.env -= (1 - piso) / dec;
            if (v.env <= piso) {
              v.env = piso;
              v.fase = 2;
              if (v.golpe) {
                terminada = true;
                break;
              }
            }
          }
          // las capas, con dos cabezas: la izquierda lee la oreja izquierda y la derecha, la derecha
          let xL = 0;
          let xR = 0;
          let vivas = 0;
          for (let q = 0; q < v.capas.length; q++) {
            const cap = v.capas[q];
            const c = cap.c;
            if (c.osc) {
              const pa = rates[q][0] * dA;
              const pb = rates[q][0] * dB2;
              xL += onda(c, cap.pos, pa) * c.gL;
              xR += onda(c, cap.pos2, pb) * c.gR;
              cap.pos += pa;
              if (cap.pos >= 1) cap.pos -= 1;
              cap.pos2 += pb;
              if (cap.pos2 >= 1) cap.pos2 -= 1;
              vivas++;
              continue;
            }
            const enLoop = c.loop && !v.golpe && !v.soltada;
            const L = c.mu.c[0];
            const R = c.mu.c[1] || L;
            if (cap.viva) {
              xL += cabeza(c, L, cap.pos, enLoop) * c.gL;
              cap.pos += rates[q][parteDe(c, cap.pos)] * dA;
              if (enLoop && cap.pos >= c.lFin) cap.pos -= c.lFin - c.lIni;
              if (cap.pos >= c.fin) cap.viva = false;
            }
            if (cap.viva2) {
              xR += cabeza(c, R, cap.pos2, enLoop) * c.gR;
              cap.pos2 += rates[q][parteDe(c, cap.pos2)] * dB2;
              if (enLoop && cap.pos2 >= c.lFin) cap.pos2 -= c.lFin - c.lIni;
              if (cap.pos2 >= c.fin) cap.viva2 = false;
            }
            if (cap.viva || cap.viva2) vivas++;
          }
          if (!vivas) {
            terminada = true;
            break;
          }
          // el ruido y el sub
          if (ruido > 0) {
            const r = azar() * ruido;
            xL += r;
            xR += r;
          }
          if (sub > 0) {
            const s = (subCuadrada ? (v.subFase < 0.5 ? 0.7 : -0.7) : Math.sin(2 * Math.PI * v.subFase)) * sub;
            xL += s;
            xR += s;
            v.subFase += subPaso;
            if (v.subFase >= 1) v.subFase -= 1;
          }
          // el filtro, con su envolvente
          if (v.fSube) {
            v.fEnv += 1 / fatq;
            if (v.fEnv >= 1) {
              v.fEnv = 1;
              v.fSube = false;
            }
          } else if (v.fEnv > 0) v.fEnv = Math.max(0, v.fEnv - 1 / fdec);
          if (ftipo > 0) {
            if (v.fCuenta-- <= 0) {
              v.fCuenta = CADA_FILTRO - 1;
              const f = Math.min(0.45 * fm, Math.max(20, corte * Math.pow(2, fenv * v.fEnv + mFil[j])));
              v.fG = Math.tan((Math.PI * f) / fm);
              v.fK = fK;
            }
            const g = v.fG;
            const kk = v.fK;
            const a1 = 1 / (1 + g * (g + kk));
            const a2 = g * a1;
            const a3 = g * a2;
            const st = v.f;
            for (let o = 0; o < 2; o++) {
              const x = o === 0 ? xL : xR;
              const v3 = x - st[2 * o + 1];
              const v1 = a1 * st[2 * o] + a2 * v3;
              const v2 = st[2 * o + 1] + a2 * st[2 * o] + a3 * v3;
              st[2 * o] = 2 * v1 - st[2 * o];
              st[2 * o + 1] = 2 * v2 - st[2 * o + 1];
              const y = ftipo === 1 ? v2 : ftipo === 2 ? x - kk * v1 - v2 : v1;
              if (o === 0) xL = y;
              else xR = y;
            }
          }
          let g = v.env * v.gan * vol * mVol[j];
          let gL = g;
          let gR = g;
          if (hayPan) {
            const a = ((Math.max(-1, Math.min(1, mPan[j])) + 1) * Math.PI) / 4;
            gL *= Math.cos(a) * Math.SQRT2;
            gR *= Math.sin(a) * Math.SQRT2;
          }
          sL[i] += xL * gL;
          sR[i] += xR * gR;
        }
        if (terminada) voces.splice(k, 1);
      }

      // --- la distorsión, sobre todo lo que suena
      const dist = val(p, 'dist', 0);
      const mez = Math.max(0, Math.min(100, val(p, 'dmez', 100))) / 100;
      if (mez > 0 && (dist > 0 || mDis.some((x, j) => j < n && x !== 0))) {
        for (let j = 0; j < n; j++) {
          const d = dist + mDis[j];
          if (d <= 0) continue;
          const g = dB(d);
          const comp = 1 / Math.sqrt(g);
          const i = desde + j;
          sL[i] = sL[i] * (1 - mez) + Math.tanh(g * sL[i]) * comp * mez;
          sR[i] = sR[i] * (1 - mez) + Math.tanh(g * sR[i]) * comp * mez;
        }
      }
    }

    return {
      ponerMuestra(m, canales, fmMuestra) {
        muestras.set(m, { c: canales, fm: fmMuestra || fm });
      },
      quitarMuestra(m) {
        muestras.delete(m);
      },
      ponerInstrumento(def) {
        zonas = Array.isArray(def && def.zonas) ? def.zonas.filter((z) => z && Array.isArray(z.capas)) : [];
      },
      notaOn,
      notaOff,
      callar,
      procesar,
      cuantasVoces: () => voces.length,
    };
  }

  return { PARAMS, TIPOS_FILTRO, FORMAS, DESTINOS, crear };
}
