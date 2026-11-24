// EL CORAZÓN DEL SAMPLER (2026-11-24, JP: «me gustan las 3», piano con zonas, batería con una nota
// por sonido y tajadas; capas; «dónde parte la nota, loop y release, con o sin cambio de altura»).
//
// Solo cuentas: ni nodos del navegador ni nada de afuera. Así corre en el hilo de audio (va como
// texto con `mandarConFunciones`), se prueba con Node (`prueba.mjs`) y algún día se puede pasar a
// un plugin nativo (JP: «quizá armar todo para hacer un VST»).
//
// EL INSTRUMENTO (lo que el hilo principal manda con `ponerInstrumento`):
//   { zonas: [ZONA…] }
//   ZONA  = { baja, alta, raiz, golpe, capas: [CAPA…] }   notas MIDI; hasta 3 capas
//           `golpe`: la nota dispara el sonido entero y soltarla no hace nada (batería, tajadas)
//   CAPA  = { m, ini, lIni, lFin, fin, loop, alt: [a, l, r], gan, pan, afinar }
//           `m`: qué muestra; `ini…fin` en SEGUNDOS de la muestra: dónde parte la nota (ini), el
//           tramo que se repite mientras se sostiene (lIni…lFin, si `loop`) y hasta dónde suena
//           al soltar (fin). Las tres partes: la de entrada (ini…lIni), la del loop y la del
//           release (lFin…fin). `alt[k]`: si esa parte sigue la altura de la nota (si no, suena a
//           la altura de la muestra). `gan` en dB, `pan` −1…1, `afinar` en semitonos.
// Las muestras llegan aparte (`ponerMuestra`), como canales Float32Array con su frecuencia.

export function nucleoSampler() {
  const PARAMS = [
    { id: 'vol', nombre: 'Volumen', min: -60, max: 6, defecto: 0, unidad: 'dB', paso: 0.1, dec: 1 },
    { id: 'atq', nombre: 'Ataque', min: 0, max: 5000, defecto: 2, unidad: 'ms', paso: 1, log: false },
    { id: 'dec', nombre: 'Decaimiento', min: 1, max: 5000, defecto: 300, unidad: 'ms', paso: 1 },
    { id: 'sos', nombre: 'Sostenido', min: 0, max: 100, defecto: 100, unidad: '%', paso: 1 },
    { id: 'sol', nombre: 'Soltado', min: 1, max: 8000, defecto: 200, unidad: 'ms', paso: 1 },
    { id: 'afinar', nombre: 'Afinación', min: -24, max: 24, defecto: 0, unidad: 'st', paso: 0.01, dec: 2 },
    { id: 'vel', nombre: 'Sensibilidad', min: 0, max: 100, defecto: 70, unidad: '%', paso: 1 },
  ];
  const VOCES = 32;
  const CRUCE_S = 0.004; // el loop se junta con un fundido de 4 ms, para que no haga clic
  const AHOGO_S = 0.006; // una voz robada o ahogada se apaga en 6 ms
  const dB = (x) => Math.pow(10, x / 20);

  function crear(fm) {
    const muestras = new Map(); // m → { c: Float32Array[], fm }
    let zonas = [];
    const voces = [];
    let orden = 0;

    // Una capa lista para sonar: sus límites en muestras de la muestra.
    const prepararCapa = (c) => {
      const mu = muestras.get(c.m);
      if (!mu || !mu.c.length || !mu.c[0].length) return null;
      const largo = mu.c[0].length;
      const s = (x) => Math.max(0, Math.min(largo - 1, Math.round((Number(x) || 0) * mu.fm)));
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
      const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
      const ang = ((pan + 1) * Math.PI) / 4;
      return {
        mu,
        ini,
        lIni,
        lFin,
        fin,
        loop,
        alt,
        gL: dB(Number(c.gan) || 0) * Math.cos(ang),
        gR: dB(Number(c.gan) || 0) * Math.sin(ang),
        afinar: Number(c.afinar) || 0,
        cruce: Math.max(1, Math.min(Math.floor((lFin - lIni) / 2), Math.round(CRUCE_S * mu.fm))),
      };
    };

    // Lo que valía un canal en una posición con decimales (entre dos muestras, en línea recta).
    const leer = (canal, pos) => {
      const i = Math.floor(pos);
      const f = pos - i;
      const a = canal[i] || 0;
      const b = canal[i + 1] === undefined ? a : canal[i + 1];
      return a + (b - a) * f;
    };

    const zonaDe = (nota) => {
      for (const z of zonas) if (nota >= z.baja && nota <= z.alta) return z;
      return null;
    };

    function notaOn(nota, vel, p) {
      const z = zonaDe(nota);
      if (!z) return;
      // En batería, la misma nota ahoga a la que sonaba (como un tambor que se vuelve a golpear).
      if (z.golpe) for (const v of voces) if (v.nota === nota && !v.ahogo) v.ahogo = AHOGO_S * fm;
      const capas = [];
      for (const c of (z.capas || []).slice(0, 3)) {
        const pc = prepararCapa(c);
        if (pc) capas.push({ c: pc, pos: pc.ini, viva: true });
      }
      if (!capas.length) return;
      // Sin lugar: se roba la más vieja.
      if (voces.length >= VOCES) {
        let vieja = voces[0];
        for (const v of voces) if (v.orden < vieja.orden) vieja = v;
        vieja.ahogo = vieja.ahogo || AHOGO_S * fm;
        if (voces.length >= VOCES + 8) voces.splice(voces.indexOf(vieja), 1);
      }
      const sens = Math.max(0, Math.min(1, (p.vel === undefined ? 70 : p.vel) / 100));
      voces.push({
        nota,
        raiz: Number(z.raiz) || 60,
        golpe: !!z.golpe,
        capas,
        gan: 1 - sens + (sens * Math.max(0, Math.min(127, vel))) / 127,
        // la envolvente: fase 0 ataque, 1 decaimiento, 2 sostenido, 3 soltado
        fase: 0,
        env: 0,
        soltada: false,
        ahogo: 0,
        orden: orden++,
      });
    }

    function notaOff(nota) {
      for (const v of voces) if (v.nota === nota && !v.golpe && !v.soltada) v.soltada = true;
    }

    function callar() {
      for (const v of voces) v.ahogo = v.ahogo || AHOGO_S * fm;
    }

    // Llenar `sL`, `sR` entre `desde` y `hasta` (los suma: quien llama los deja en cero).
    function procesar(sL, sR, desde, hasta, p) {
      const atq = Math.max(1, ((p.atq === undefined ? 2 : p.atq) / 1000) * fm);
      const dec = Math.max(1, ((p.dec === undefined ? 300 : p.dec) / 1000) * fm);
      const sos = Math.max(0, Math.min(1, (p.sos === undefined ? 100 : p.sos) / 100));
      const sol = Math.max(1, ((p.sol === undefined ? 200 : p.sol) / 1000) * fm);
      const vol = dB(p.vol === undefined ? 0 : p.vol);
      const afinar = p.afinar || 0;
      for (let k = voces.length - 1; k >= 0; k--) {
        const v = voces[k];
        // Cuánto avanza cada capa por muestra de salida, en cada parte (entrada, loop, release).
        const rates = v.capas.map(({ c }) => {
          const base = c.mu.fm / fm;
          const conNota = Math.pow(2, (v.nota - v.raiz + c.afinar + afinar) / 12);
          const sinNota = Math.pow(2, (c.afinar + afinar) / 12);
          return [base * (c.alt[0] ? conNota : sinNota), base * (c.alt[1] ? conNota : sinNota), base * (c.alt[2] ? conNota : sinNota)];
        });
        let terminada = false;
        for (let i = desde; i < hasta; i++) {
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
              v.fase = v.golpe ? 2 : 1;
            }
          } else if (v.fase === 1) {
            v.env -= (1 - sos) / dec;
            if (v.env <= sos) {
              v.env = sos;
              v.fase = 2;
            }
          }
          const g = v.env * v.gan * vol;
          let vivas = 0;
          for (let n = 0; n < v.capas.length; n++) {
            const cap = v.capas[n];
            if (!cap.viva) continue;
            const c = cap.c;
            const enLoop = c.loop && !v.golpe && !v.soltada;
            const parte = cap.pos < c.lIni ? 0 : cap.pos < c.lFin ? 1 : 2;
            const L = c.mu.c[0];
            const R = c.mu.c[1] || L;
            let xL = leer(L, cap.pos);
            let xR = R === L ? xL : leer(R, cap.pos);
            // El fundido del loop: cerca de su final se mezcla con lo que viene después del salto.
            if (enLoop && parte === 1 && cap.pos > c.lFin - c.cruce) {
              const a = (cap.pos - (c.lFin - c.cruce)) / c.cruce;
              const otra = cap.pos - (c.lFin - c.lIni);
              xL = xL * (1 - a) + leer(L, otra) * a;
              xR = R === L ? xL : xR * (1 - a) + leer(R, otra) * a;
            }
            sL[i] += xL * c.gL * g;
            sR[i] += xR * c.gR * g;
            cap.pos += rates[n][parte];
            if (enLoop && cap.pos >= c.lFin) cap.pos -= c.lFin - c.lIni;
            if (cap.pos >= c.fin) cap.viva = false;
            else vivas++;
          }
          if (!vivas) {
            terminada = true;
            break;
          }
        }
        if (terminada) voces.splice(k, 1);
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

  return { PARAMS, crear };
}
