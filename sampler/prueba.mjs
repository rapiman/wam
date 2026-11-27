// PRUEBA DEL CORAZÓN DEL SAMPLER (Node): las zonas, la altura, el loop y sus tres partes, el golpe
// de batería, las capas y la envolvente.   node sampler/prueba.mjs
import { nucleoSampler } from './nucleo.js';
import { energias, golpes, parejos } from './tajadas.js';
import { estirarTramos, segundosDe } from './estirar.js';
import { FM, tono, porDefecto, anotador, pico } from '../comun/probar.mjs';
import { FABRICA, estadoDeFabrica, empaquetar, desempaquetar } from './presets.js';

const N = nucleoSampler();
// Los parámetros por capa (2026-11-25): las pruebas de antes hablan de una envolvente y un filtro
// para todo; `PD` los pasa a las tres capas con sus nombres de ahora.
const DE_ANTES = { atq: ['vat'], dec: ['vdt'], sos: ['vbp', 'vsl'], sol: ['vrt'], vel: ['vvs'], ftipo: ['ft'], corte: ['fc'], reso: ['fr'], fenv: ['fi'], fatq: ['fat'], fdec: ['fdt'] };
function PD(o) {
  const r = {};
  for (const [k, x] of Object.entries(o)) {
    if (!DE_ANTES[k]) {
      r[k] = x;
      continue;
    }
    for (const c of [1, 2, 3]) for (const nuevo of DE_ANTES[k]) r[`c${c}${nuevo}`] = x;
    if (k === 'fdec') for (const c of [1, 2, 3]) r[`c${c}fbp`] = 0;
  }
  return porDefecto(N, r);
}
const a = anotador();
const P = PD({ atq: 0, vel: 0 });

// Correr el sampler `seg` segundos, con una lista de [segundo, 'on'|'off', nota].
function correr(s, seg, eventos, p = P) {
  const L = new Float32Array(Math.round(seg * FM));
  const R = new Float32Array(L.length);
  const pend = [...eventos].sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < L.length; i += 128) {
    const t = i / FM;
    while (pend.length && pend[0][0] <= t) {
      const [, que, n, vel] = pend.shift();
      if (que === 'on') s.notaOn(n, vel === undefined ? 127 : vel, p);
      else s.notaOff(n);
    }
    s.procesar(L, R, i, Math.min(L.length, i + 128), p);
  }
  return { L, R };
}
// La frecuencia de un tramo, contando cruces por cero hacia arriba.
function frecuencia(x, desde, hasta) {
  let cruces = 0;
  for (let i = Math.max(1, desde); i < hasta; i++) if (x[i - 1] < 0 && x[i] >= 0) cruces++;
  return (cruces * FM) / (hasta - desde);
}
const tramo = (seg0, seg1) => [Math.round(seg0 * FM), Math.round(seg1 * FM)];
const nuevo = (zonas, muestras) => {
  const s = N.crear(FM);
  for (const [m, c, fm] of muestras) s.ponerMuestra(m, c, fm);
  s.ponerInstrumento({ zonas });
  return s;
};

// Una muestra de 2 s de un La (440 Hz).
const la = [tono(0.5, 440, 2)];

// --- la altura sigue la nota desde la raíz
{
  const s = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L } = correr(s, 1, [[0, 'on', 81]]);
  a.ver('una octava más arriba de la raíz (Hz)', frecuencia(L, ...tramo(0.1, 0.9)), 880, 5);
}
{
  const s = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, 24000]]);
  const { L } = correr(s, 1, [[0, 'on', 69]]);
  a.ver('una muestra grabada a otra frecuencia suena a su altura (Hz)', frecuencia(L, ...tramo(0.1, 0.9)), 220, 3);
}

// --- las zonas: cada tramo del teclado con lo suyo; fuera de las zonas, nada
{
  const mi = [tono(0.5, 330, 2)];
  const s = nuevo(
    [
      { baja: 0, alta: 59, raiz: 69, capas: [{ m: 'la' }] },
      { baja: 60, alta: 72, raiz: 64, capas: [{ m: 'mi' }] },
    ],
    [['la', la, FM], ['mi', mi, FM]],
  );
  const { L } = correr(s, 0.5, [[0, 'on', 64]]);
  a.ver('la nota cae en su zona y suena su muestra (Hz)', frecuencia(L, ...tramo(0.1, 0.45)), 330, 4);
  const s2 = nuevo([{ baja: 60, alta: 72, raiz: 64, capas: [{ m: 'mi' }] }], [['mi', mi, FM]]);
  a.ver('una nota fuera de las zonas no suena', pico(correr(s2, 0.3, [[0, 'on', 90]]).L), 0, 0);
}

// --- el loop sostiene mientras la tecla está apretada; al soltar, el release y se termina
{
  const zona = { baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la', ini: 0, lIni: 0.2, lFin: 0.4, fin: 0.6, loop: true }] };
  const s = nuevo([zona], [['la', la, FM]]);
  const { L } = correr(s, 3, [[0, 'on', 69], [2, 'off', 69]], PD({ atq: 0, vel: 0, sol: 50 }));
  a.menorQue('con loop, a los 1,5 s todavía suena (pico, al revés)', -pico(L.subarray(...tramo(1.4, 1.6))), -0.3);
  a.ver('después de soltar y del release, silencio', pico(L.subarray(...tramo(2.3, 3))), 0, 0);
  a.ver('la voz se libera', s.cuantasVoces(), 0, 0);
}
{
  const s = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la', ini: 0, fin: 0.3 }] }], [['la', la, FM]]);
  const { L } = correr(s, 1, [[0, 'on', 69]]);
  a.menorQue('sin loop, la muestra se acaba en su fin aunque la tecla siga (pico)', pico(L.subarray(...tramo(0.32, 1))), 1e-6);
}

// --- las tres partes, con o sin la altura de la nota
{
  const zona = { baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la', ini: 0, lIni: 0.5, lFin: 1, fin: 1.5, loop: true, alt: [false, true, true] }] };
  const s = nuevo([zona], [['la', la, FM]]);
  const { L } = correr(s, 1.2, [[0, 'on', 81]]);
  a.ver('la entrada sin la altura de la nota suena a la de la muestra (Hz)', frecuencia(L, ...tramo(0.05, 0.45)), 440, 5);
  a.ver('el loop con la altura de la nota (Hz)', frecuencia(L, ...tramo(0.6, 1.1)), 880, 8);
}

// --- batería: el golpe suena entero aunque se suelte la tecla, y la misma nota ahoga a la anterior
{
  const s = nuevo([{ baja: 36, alta: 36, raiz: 36, golpe: true, capas: [{ m: 'la', ini: 0, fin: 0.5 }] }], [['la', la, FM]]);
  const { L } = correr(s, 1, [[0, 'on', 36], [0.05, 'off', 36]]);
  a.menorQue('golpe: sigue sonando después de soltar (pico, al revés)', -pico(L.subarray(...tramo(0.3, 0.45))), -0.3);
  const s2 = nuevo([{ baja: 36, alta: 36, raiz: 36, golpe: true, capas: [{ m: 'la', ini: 0, fin: 1 }] }], [['la', la, FM]]);
  correr(s2, 0.5, [[0, 'on', 36], [0.2, 'on', 36]]);
  a.ver('golpe: la misma nota ahoga a la anterior (voces)', s2.cuantasVoces(), 1, 0);
}

// --- capas: hasta tres suenan juntas; ganancia y paneo por capa
{
  const s = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la', pan: -1 }, { m: 'la', pan: 1, gan: -6 }, { m: 'la' }, { m: 'la' }] }], [['la', la, FM]]);
  const { L, R } = correr(s, 0.3, [[0, 'on', 69]]);
  const pL = pico(L.subarray(...tramo(0.1, 0.25)));
  const pR = pico(R.subarray(...tramo(0.1, 0.25)));
  a.ver('tres capas (la cuarta no): izquierda = 0,5·(1 + 0,707)', pL, 0.5 * (1 + Math.SQRT1_2), 0.01);
  a.ver('derecha = 0,5·(0,501 + 0,707)', pR, 0.5 * (0.501 + Math.SQRT1_2), 0.01);
}

// --- la envolvente: ataque, sostenido, sensibilidad a la intensidad
{
  const s = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L } = correr(s, 1, [[0, 'on', 69]], PD({ atq: 500, vel: 0 }));
  a.menorQue('a los 0,1 s del ataque de 0,5 s, todavía bajo (pico)', pico(L.subarray(...tramo(0.09, 0.11))), 0.12);
  const s2 = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L: L2 } = correr(s2, 1.5, [[0, 'on', 69]], PD({ atq: 0, dec: 100, sos: 50, vel: 0 }));
  // (al centro, cada oreja lleva 0,707 del sonido: el paneo de igual potencia)
  a.ver('sostenido 50 %: a la mitad (pico)', pico(L2.subarray(...tramo(1, 1.4))), 0.25 * Math.SQRT1_2, 0.01);
  const s3 = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L: L3 } = correr(s3, 0.3, [[0, 'on', 69, 64]], PD({ atq: 0, vel: 100 }));
  a.ver('sensibilidad 100 %: intensidad 64 suena a la mitad (pico)', pico(L3.subarray(...tramo(0.1, 0.25))), ((0.5 * 64) / 127) * Math.SQRT1_2, 0.01);
}

// --- el loop no hace clic: el salto de muestra a muestra se queda chico
{
  const zona = { baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la', ini: 0, lIni: 0.2013, lFin: 0.4, fin: 1, loop: true }] };
  const s = nuevo([zona], [['la', la, FM]]);
  const { L } = correr(s, 1.5, [[0, 'on', 69]]);
  let salto = 0;
  for (let i = Math.round(0.2 * FM); i < Math.round(1.4 * FM); i++) salto = Math.max(salto, Math.abs(L[i] - L[i - 1]));
  a.menorQue('el mayor salto entre muestras en el loop (una sinusoide de 440 Hz da 0,029)', salto, 0.045);
}

// --- tajadas: cada tecla desde `baja` toca su pedazo, a la altura de la muestra
{
  // tres pedazos de 0,5 s con niveles distintos (0,1, 0,2 y 0,3)
  const m = new Float32Array(FM * 1.5);
  for (let i = 0; i < m.length; i++) m[i] = 0.1 * (1 + Math.floor(i / (FM * 0.5)));
  const zona = { baja: 48, alta: 50, raiz: 48, tajadas: true, capas: [{ m: 'p', cortes: [0, 0.5, 1] }] };
  const s = nuevo([zona], [['p', [m], FM]]);
  const { L } = correr(s, 0.8, [[0, 'on', 49], [0.05, 'off', 49]]);
  a.ver('la segunda tecla toca la segunda tajada (nivel)', L[Math.round(0.25 * FM)], 0.2 * Math.SQRT1_2, 0.001);
  a.menorQue('la tajada se termina en el corte siguiente (pico)', pico(L.subarray(...tramo(0.52, 0.8))), 1e-6);
  a.ver('sin altura: la tajada dura lo mismo en otra tecla (muestras con sonido)', [...correr(nuevo([zona], [['p', [m], FM]]), 0.8, [[0, 'on', 50]]).L].filter((x) => x !== 0).length, 0.5 * FM, 260);
  a.ver('una tecla sin tajada no suena', pico(correr(nuevo([zona], [['p', [m], FM]]), 0.3, [[0, 'on', 52]]).L), 0, 0);
  // los bordes fundidos: el comienzo no salta de golpe al nivel
  a.menorQue('el borde de la tajada parte fundido', Math.abs(L[1]), 0.02);
}

// --- detectar los golpes
{
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  // cinco golpes de ruido que se apagan; el cuarto cae encima de la cola del tercero
  const tiempos = [0.1, 0.45, 0.8, 0.95, 1.4];
  const x = new Float32Array(FM * 2);
  for (const t0 of tiempos) {
    const i0 = Math.round(t0 * FM);
    for (let i = 0; i < 0.4 * FM && i0 + i < x.length; i++) x[i0 + i] += 0.7 * azar() * Math.exp(-i / (0.05 * FM));
  }
  const en = energias([x], FM);
  const g = golpes(en, 50);
  a.ver('encuentra los cinco golpes', g.length, 5, 0);
  let peor = 0;
  tiempos.forEach((t0, k) => (peor = Math.max(peor, Math.abs((g[k] === undefined ? 99 : g[k]) - t0))));
  a.menorQue('cada uno a menos de 12 ms de donde está (s)', peor, 0.012);
  const suaves = new Float32Array(FM);
  for (let i = 0; i < suaves.length; i++) suaves[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / FM) * Math.min(1, i / (0.3 * FM));
  const gs = golpes(energias([suaves], FM), 50);
  a.ver('un sonido que entra despacio: un solo corte, donde empieza (cortes)', gs.length, 1, 0);
  a.menorQue('… y está al comienzo (s)', gs[0], 0.02);
  a.ver('el silencio no tiene golpes', golpes(energias([new Float32Array(FM)], FM), 100).length, 0, 0);
  a.ver('partes iguales: el cuarto de cuatro en 2 s (s)', parejos(2, 4)[3], 1.5, 1e-9);
}

// --- paso 3: filtro, sub, ruido, desafinado, distorsión y vaivenes
const unaZona = (capa = { m: 'la' }) => [{ baja: 0, alta: 127, raiz: 69, capas: [capa] }];
const pico2 = (x, s0, s1) => pico(x.subarray(...tramo(s0, s1)));
{
  const agudo = [tono(0.5, 5000, 2)];
  const sin = correr(nuevo(unaZona({ m: 'g' }), [['g', agudo, FM]]), 0.5, [[0, 'on', 69]]).L;
  const con = correr(nuevo(unaZona({ m: 'g' }), [['g', agudo, FM]]), 0.5, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, ftipo: 1, corte: 500, reso: 0 })).L;
  a.menorQue('pasa bajos en 500 Hz: un tono de 5 kHz baja más de 30 dB (razón)', pico2(con, 0.2, 0.45) / pico2(sin, 0.2, 0.45), 0.032);
  const alto = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, ftipo: 2, corte: 5000, reso: 0 })).L;
  a.menorQue('pasa altos en 5 kHz: el La casi no pasa (pico)', pico2(alto, 0.2, 0.45), 0.02);
  const env = correr(nuevo(unaZona({ m: 'g' }), [['g', agudo, FM]]), 1, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, ftipo: 1, corte: 300, reso: 0, fenv: 5, fatq: 0.5, fdec: 300 })).L;
  a.mayorQue('la envolvente del filtro lo abre al comienzo… (pico)', pico2(env, 0.01, 0.05), 0.08);
  a.menorQue('… y después se cierra (pico)', pico2(env, 0.6, 0.9), 0.02);
}
{
  const callada = [tono(0.0001, 440, 2)];
  const { L } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.6, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, sub: 100 }));
  a.ver('el sub, una octava abajo de la nota (Hz)', frecuencia(L, ...tramo(0.1, 0.5)), 220, 4);
  const { L: L2 } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.6, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, sub: 100, subOct: 1 }));
  a.ver('con −2, dos octavas abajo (Hz)', frecuencia(L2, ...tramo(0.1, 0.5)), 110, 4);
  const { L: L3 } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.3, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, ruido: 100 }));
  a.mayorQue('el ruido suena aunque el audio esté callado (pico)', pico2(L3, 0.1, 0.25), 0.1);
}
{
  const { L, R } = correr(nuevo(unaZona(), [['la', la, FM]]), 1, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, desaf: 100 }));
  a.ver('desafinado 100 ct: la izquierda medio semitono abajo (Hz)', frecuencia(L, ...tramo(0.1, 0.9)), 440 * Math.pow(2, -50 / 1200), 4);
  a.ver('… y la derecha medio semitono arriba (Hz)', frecuencia(R, ...tramo(0.1, 0.9)), 440 * Math.pow(2, 50 / 1200), 4);
}
{
  const { L } = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, dist: 24 }));
  a.ver('distorsión de 24 dB: el pico queda en 1/√g', pico2(L, 0.1, 0.45), 1 / Math.sqrt(dB24()), 0.01);
}
function dB24() {
  return Math.pow(10, 24 / 20);
}
{
  // un vaivén cuadrado de 2 Hz al volumen, al 100 %: un cuarto de segundo suena, el otro no
  const { L } = correr(nuevo(unaZona(), [['la', la, FM]]), 1.2, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, l1f: 2, l1v: 2, l1p: 100, l1d: 1 }));
  const tr = [pico2(L, 0.05, 0.2), pico2(L, 0.3, 0.45), pico2(L, 0.55, 0.7), pico2(L, 0.8, 0.95)];
  a.mayorQue('vaivén al volumen: la mitad arriba suena (pico)', Math.min(tr[0], tr[2]), 0.3);
  a.menorQue('… y la mitad abajo, callada (pico)', Math.max(tr[1], tr[3]), 1e-3);
  const { L: L2 } = correr(nuevo(unaZona(), [['la', la, FM]]), 1, [[0, 'on', 69]], PD({ atq: 0.5, vel: 0, l2f: 2, l2v: 1, l2p: 100, l2d: 0 }));
  a.ver('vaivén cuadrado a la altura, al 100 %: una octava arriba la primera mitad (Hz)', frecuencia(L2, ...tramo(0.05, 0.45)), 880, 8);
}

// --- envolventes de tramos por capa, como las del Korg M1
{
  const C1 = (o) => {
    const r = { vvs: 0 };
    Object.assign(r, o);
    const out = {};
    for (const [k, x] of Object.entries(r)) for (const c of [1, 2, 3]) out[`c${c}${k}`] = x;
    return porDefecto(N, out);
  };
  const nivelEn = (L, s) => pico(L.subarray(...tramo(s - 0.01, s + 0.01))) / (0.5 * Math.SQRT1_2);
  // ataque, quiebre en 30 %, pendiente subiendo al 80 %
  const { L } = correr(nuevo(unaZona(), [['la', la, FM]]), 1.6, [[0, 'on', 69]], C1({ vat: 0.5, val: 100, vdt: 100, vbp: 30, vst: 500, vsl: 80 }));
  a.ver('volumen: después del decaimiento, en el quiebre (30 %)', nivelEn(L, 0.11), 0.3, 0.04);
  a.ver('… y después de la pendiente, en el sostenido (80 %)', nivelEn(L, 1.2), 0.8, 0.04);
  // la intensidad alarga el ataque con «+»
  const ataque = (vel) => correr(nuevo(unaZona(), [['la', la, FM]]), 0.3, [[0, 'on', 69, vel]], C1({ vat: 100, vvt: 100, vvpA: 0 })).L;
  a.menorQue('intensidad «+»: un golpe fuerte ataca más lento (nivel a los 50 ms)', nivelEn(ataque(127), 0.05), 0.15);
  a.mayorQue('… y uno suave, más rápido', nivelEn(ataque(1), 0.05), 0.9);
  // la envolvente de altura: parte una octava arriba y baja a la nota
  const { L: P } = correr(nuevo(unaZona(), [['la', la, FM]]), 1, [[0, 'on', 69]], C1({ vat: 0.5, pi: 12, pl0: 100, pat: 0.5, pal: 100, pdt: 300 }));
  a.ver('altura: al comienzo, una octava arriba (Hz)', frecuencia(P, ...tramo(0.0, 0.02)), 880, 60);
  a.ver('… y después, en la nota (Hz)', frecuencia(P, ...tramo(0.5, 0.9)), 440, 5);
  // retardo de entrada de la capa
  const { L: R } = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], C1({ vat: 0.5, ret: 200 }));
  a.menorQue('retardo de 200 ms: callado al comienzo (pico)', pico(R.subarray(...tramo(0, 0.19))), 1e-6);
  a.mayorQue('… y después suena', pico(R.subarray(...tramo(0.25, 0.45))), 0.3);
  // cada capa con su filtro: la 2 filtrada, la 1 no
  const agudo = [tono(0.5, 5000, 2)];
  const dos = [{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'g' }, { m: 'g' }] }];
  const solo2 = (o) => correr(nuevo(dos, [['g', agudo, FM]]), 0.4, [[0, 'on', 69]], porDefecto(N, { c1vvs: 0, c2vvs: 0, c1niv: -40, ...o })).L;
  a.menorQue('capa 2 con pasa bajos en 500 Hz: el agudo casi no pasa', pico2(solo2({ c2ft: 1, c2fc: 500, c2fr: 0 }), 0.2, 0.35), 0.02);
  a.mayorQue('… y con el filtro en la capa 1, la 2 suena entera', pico2(solo2({ c1ft: 1, c1fc: 500, c1fr: 0 }), 0.2, 0.35), 0.3);
  // el soltado general alarga los soltados
  const s = nuevo(unaZona(), [['la', la, FM]]);
  const { L: G } = correr(s, 1.2, [[0, 'on', 69], [0.2, 'off', 69]], porDefecto(N, { c1vvs: 0, c1vrt: 50, grt: 50 }));
  a.mayorQue('soltado general +50: el soltado de 50 ms dura mucho más (pico a los 0,4 s)', pico2(G, 0.38, 0.42), 0.1);
}

// --- el soplo: bisel, labios y caña
{
  // la frecuencia por autocorrelación (los tubos tienen muchos armónicos)
  const frecAC = (x, a, b) => {
    const s = x.subarray(...tramo(a, b));
    let mejor = 0;
    let lag = 0;
    for (let L = 20; L < 2400; L++) {
      let c = 0;
      for (let i = 0; i < s.length - L; i += 2) c += s[i] * s[i + L];
      if (c > mejor) {
        mejor = c;
        lag = L;
      }
    }
    return lag ? FM / lag : 0;
  };
  const sop = (o) => {
    const r = { vvs: 0, vat: 20, ...o };
    const out = {};
    for (const [k, x] of Object.entries(r)) out[`c1${k}`] = x;
    return porDefecto(N, out);
  };
  const zs = [{ baja: 0, alta: 127, raiz: 60, capas: [{ mod: {} }] }];
  const tocar = (nota, o, seg = 0.8, ev) => correr(nuevo(zs, []), seg, ev || [[0, 'on', nota]], sop(o)).L;
  const sano = (x) => x.every((y) => Number.isFinite(y) && Math.abs(y) < 4);

  const b = tocar(69, { smt: 0, ssa: 100 });
  a.ver('bisel: suena en su nota (440 Hz, ±3 %)', frecAC(b, 0.4, 0.7), 440, 13);
  a.mayorQue('… y suena (pico)', pico2(b, 0.4, 0.7), 0.1);
  const suave = frecAC(tocar(69, { smt: 0, ssa: 100, sai: 35, ssu: 40 }), 0.4, 0.7);
  const fuerte = frecAC(tocar(69, { smt: 0, ssa: 100, sai: 100, ssu: 40 }), 0.4, 0.7);
  a.mayorQue('bisel: con más aire sube (Hz de más)', fuerte - suave, 3);
  const brinco = frecAC(tocar(69, { smt: 0, ssa: 0, sai: 130 }), 0.4, 0.7);
  a.mayorQue('bisel sin salto y mucho aire: brinca hacia arriba (razón)', brinco / 440, 1.4);
  const pif = tocar(81, { smt: 0, sex: 1, sdf: 40, sde: 30, sai: 90, sas: 30 });
  a.ver('pifilka (cerrado, doble fondo, aspereza): suena y no se dispara', sano(pif) && pico2(pif, 0.4, 0.7) > 0.05 ? 1 : 0, 1, 0);

  const t = tocar(57, { smt: 1, sai: 70 });
  a.ver('labios: suenan en su nota (220 Hz, ±4 %)', frecAC(t, 0.4, 0.7), 220, 9);
  // trutruka: tubo fijo en Do 2 (65,4 Hz); los labios eligen el armónico del tubo
  const ftr = (nota) => frecAC(tocar(nota, { smt: 1, stb: 1, stn: 36, sai: 70 }), 0.4, 0.7) / 65.41;
  a.menorQue('trutruka (tubo fijo): Sol 3 cae en el armónico 3 del tubo', Math.abs(ftr(55) - 3), 0.1);
  a.menorQue('… y Mi 4, en el 5', Math.abs(ftr(64) - 5), 0.15);
  // la trutruka de la grabación (2026-11-25): tubo de 40 Hz (Mi 1 −50 ct), armónicos 5 a 8
  const tk = { smt: 1, stb: 1, stn: 28, stf: -50, sai: 50, sru: 0 };
  const ftk = (nota, o = {}) => frecAC(tocar(nota, { ...tk, ...o }), 0.4, 0.7) / 40.02;
  a.menorQue('trutruka de 40 Hz (afinación del tubo): La#3 en el armónico 6', Math.abs(ftk(58) - 6), 0.06);
  a.menorQue('… Do#4 en el 7', Math.abs(ftk(61) - 7), 0.07);
  a.menorQue('… una tecla entre dos armónicos (Fa#3, 185 Hz) va al más cercano, el 5', Math.abs(ftk(54) - 5), 0.05);
  a.mayorQue('… y suena fuerte, no un hilo (pico)', pico2(tocar(58, tk), 0.4, 0.7), 0.1);
  // el desvío: sube mientras se sostiene y baja al final
  const dv = { ...tk, sds: 60, sdt: 600, sdx: -200, vrt: 300 };
  const Ld = tocar(58, dv, 1.4, [[0, 'on', 58], [0.8, 'off', 58]]);
  const fIni = frecAC(Ld, 0.1, 0.16);
  const fSos = frecAC(Ld, 0.5, 0.75);
  const fFin = frecAC(Ld, 0.95, 1.0);
  a.mayorQue('desvío al sostener +60 ct: sube (ct)', 1200 * Math.log2(fSos / fIni), 35);
  a.mayorQue('desvío al final −200 ct: baja al soltar (ct)', 1200 * Math.log2(fSos / fFin), 60);
  // el tercer parcial (2026-11-25, con el ñolkin): −10 dB por defecto lo deja cerca de lo grabado
  const parcial = (x, f, k) => {
    const q = x.subarray(...tramo(0.4, 0.7));
    let re = 0;
    let im = 0;
    for (let i = 0; i < q.length; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / q.length);
      re += q[i] * w * Math.cos((2 * Math.PI * k * f * i) / FM);
      im += q[i] * w * Math.sin((2 * Math.PI * k * f * i) / FM);
    }
    return Math.hypot(re, im);
  };
  const nk = { smt: 1, stb: 1, stn: 41, stf: -39, sai: 55, sca: 0, sru: 0 };
  const t0 = tocar(64, { ...nk, stc: 0 });
  const t20 = tocar(64, { ...nk, stc: -20 });
  const r0 = parcial(t0, 341.3, 3) / parcial(t0, 341.3, 1);
  const r20 = parcial(t20, 341.3, 3) / parcial(t20, 341.3, 1);
  a.mayorQue('tercer parcial −20 dB: baja el 3.º respecto del fundamental (dB)', 20 * Math.log10(r0 / r20), 15);
  // la inestabilidad: la altura tiembla; sin ella, quieta
  const desvAlt = (o) => {
    const x = tocar(64, { ...nk, ...o }, 2.2);
    const f = [];
    for (let t = 0.4; t < 2.1; t += 0.1) f.push(1200 * Math.log2(frecAC(x, t, t + 0.06)));
    const m = f.reduce((p, q) => p + q, 0) / f.length;
    return Math.sqrt(f.reduce((p, q) => p + (q - m) ** 2, 0) / f.length);
  };
  a.menorQue('sin inestabilidad, la altura quieta (ct)', desvAlt({}), 3);
  a.mayorQue('inestabilidad 20 ct: la altura tiembla (ct)', desvAlt({ sin: 20, siv: 4 }), 6);
  // el tubo con medidas (2026-11-25): tubo recto + cacho, con la nota justa en cada armónico
  const ct = (f, g) => 1200 * Math.log2(f / g);
  const tkm = { smt: 1, stb: 1, stn: 28, stf: -50, sgm: 1, sai: 60, sru: 0 };
  a.menorQue('tubo con medidas (trutruka, cañería de agua y cacho de vaca): La#3 justo (ct)', Math.abs(ct(frecAC(tocar(58, tkm), 0.4, 0.7), 6 * 40.02)), 15);
  a.menorQue('… Do#4 justo (ct)', Math.abs(ct(frecAC(tocar(61, tkm), 0.4, 0.7), 7 * 40.02)), 15);
  a.mayorQue('… y suena (pico)', pico2(tocar(58, tkm), 0.4, 0.7), 0.1);
  const nkm = { smt: 1, stb: 1, stn: 41, stf: -39, sgm: 1, sdc: 10, slh: 18, sdh: 45, sai: 55, sru: 0 };
  a.menorQue('ñolkin (cañería de gas y cacho de cabra): Mi4 en el armónico 4 (ct)', Math.abs(ct(frecAC(tocar(64, nkm), 0.4, 0.7), 4 * 85.36)), 15);
  a.menorQue('… aspirado, también (ct)', Math.abs(ct(frecAC(tocar(64, { ...nkm, ssn: 1 }), 0.4, 0.7), 4 * 85.36)), 25);
  const enr = tocar(58, { ...tkm, sen: 1, svu: 6 });
  a.ver('enrollado en espiral: suena y no se dispara', sano(enr) && pico2(enr, 0.4, 0.7) > 0.05 ? 1 : 0, 1, 0);
  const tp = tocar(64, { smt: 1, sgm: 1, sdc: 11, slh: 50, sdh: 120, sfh: 80, sai: 70, sru: 0 });
  a.menorQue('trompeta con medidas (el tubo sigue la nota): cerca de Mi4 (ct)', Math.abs(ct(frecAC(tp, 0.4, 0.7), 329.63)), 50);
  // la nota del tubo y su largo, como los muestra la carátula
  const gm = {};
  for (const q of N.PARAMS) if (q.id.startsWith('c1')) gm[q.id.slice(2)] = q.defecto;
  Object.assign(gm, { stn: 28, stf: -50 });
  const mn = N.medidaTubo(gm, FM);
  a.ver('largo desde la nota: 40 Hz da un tubo recto de unos 4 m (cm)', mn.cm, 425, 40);
  const ml = N.medidaTubo({ ...gm, slm: 1, slc: mn.cm }, FM);
  a.ver('… y ese largo, puesto a mano, da otra vez ≈ 40 Hz', ml.hz, 40, 1.5);
  // 2026-11-26: ligado, soplo vivo, labio con flujo de aire, boquilla y bramido
  const sl = nuevo(zs, []);
  const lig = correr(sl, 1.3, [[0, 'on', 58], [0.5, 'on', 61], [1.0, 'off', 58]], sop({ ...tkm, slg: 1 })).L;
  a.ver('ligado: la segunda nota no hace otra voz (voces)', sl.cuantasVoces(), 1, 0);
  a.menorQue('… la primera, en La#3 (ct)', Math.abs(ct(frecAC(lig, 0.3, 0.45), 6 * 40.02)), 15);
  a.menorQue('… pasa a Do#4 sin cortar el aire (ct)', Math.abs(ct(frecAC(lig, 0.9, 1.1), 7 * 40.02)), 20);
  a.mayorQue('… y al soltar la de abajo, sigue sonando (pico)', pico2(lig, 1.1, 1.25), 0.05);
  const pila = correr(nuevo(zs, []), 1.4, [[0, 'on', 58], [0.4, 'on', 61], [0.8, 'off', 61]], sop({ ...tkm, slg: 1, slb: 1 })).L;
  a.menorQue('ligado con labio de flujo: al soltar la de arriba vuelve a la que sigue apretada (ct)', Math.abs(ct(frecAC(pila, 1.15, 1.35), 6 * 40.02)), 20);
  const sinL = nuevo(zs, []);
  correr(sinL, 0.8, [[0, 'on', 58], [0.4, 'on', 61]], sop(tkm));
  a.ver('sin ligado: dos voces, como antes (voces)', sinL.cuantasVoces(), 2, 0);
  a.mayorQue('golpe de lengua: el ataque sale más fuerte (razón de picos)', pico2(tocar(58, { ...tkm, sgl: 100 }), 0.02, 0.08) / pico2(tocar(58, tkm), 0.02, 0.08), 1.2);
  const nivelV = (x) => {
    const r = [];
    for (let t0 = 0.4; t0 < 2.9; t0 += 0.1) r.push(pico2(x, t0, t0 + 0.1));
    return (Math.max(...r) - Math.min(...r)) / Math.max(...r);
  };
  a.mayorQue('respiración: el volumen sube y baja en una nota larga (fracción)', nivelV(tocar(58, { ...tkm, srs: 100 }, 3)), 0.1);
  a.menorQue('… sin respiración, parejo (fracción)', nivelV(tocar(58, tkm, 3)), 0.08);
  const fl = { ...tkm, slb: 1 };
  a.menorQue('labio con flujo de aire: La#3 en su nota (ct)', Math.abs(ct(frecAC(tocar(58, fl), 0.4, 0.7), 6 * 40.02)), 20);
  a.menorQue('… el ñolkin, Mi4 (ct)', Math.abs(ct(frecAC(tocar(64, { ...nkm, slb: 1 }), 0.4, 0.7), 4 * 85.36)), 25);
  a.menorQue('… aspirado (ct)', Math.abs(ct(frecAC(tocar(64, { ...nkm, slb: 1, ssn: 1 }), 0.4, 0.7), 4 * 85.36)), 40);
  const agudos = (x) => {
    const lo = parcial(x, 245, 1);
    let hi = 0;
    for (let k = 6; k <= 10; k++) hi += parcial(x, 245, k);
    return hi / lo;
  };
  a.mayorQue('… con bramido, tocado fuerte sale brillante (razón de agudos)', agudos(tocar(58, { ...fl, sbr: 100, sai: 110 })) / agudos(tocar(58, { ...fl, sbr: 100, sai: 40 })), 3);
  a.menorQue('boquilla: la nota sigue justa (ct)', Math.abs(ct(frecAC(tocar(58, { ...tkm, sbq: 1 }), 0.4, 0.7), 6 * 40.02)), 15);
  a.mayorQue('bramido: tocado fuerte, más agudos (razón)', agudos(tocar(58, { ...tkm, sai: 110, sbr: 100 })) / agudos(tocar(58, { ...tkm, sai: 110 })), 2);
  // 2026-11-26: resonancia de la boca y aliento aspirado (con dos grabaciones de ñolkin)
  const banda = (x, f1, f2) => {
    const q = x.subarray(...tramo(0.4, 0.75));
    let e = 0;
    for (let f = f1; f <= f2; f += 20) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < q.length; i++) {
        re += q[i] * Math.cos((2 * Math.PI * f * i) / FM);
        im += q[i] * Math.sin((2 * Math.PI * f * i) / FM);
      }
      e += re * re + im * im;
    }
    return e;
  };
  const ñ2 = { smt: 1, stb: 1, stn: 43, stf: -30, sgm: 1, slb: 1, ssn: 1, sdc: 10, slh: 18, sdh: 45, sai: 55, sru: 0 };
  const sinB = tocar(67, ñ2);
  const conB = tocar(67, { ...ñ2, sbo: 100 });
  a.mayorQue('resonancia de la boca: más fuerza en 600–700 Hz, respecto de la nota (dB)', 10 * Math.log10((banda(conB, 600, 700) / banda(conB, 370, 400)) / (banda(sinB, 600, 700) / banda(sinB, 370, 400))), 3);
  const asp = tocar(67, { ...ñ2, sru: 100 });
  const sop2 = tocar(67, { ...ñ2, ssn: 0, sru: 100 });
  a.mayorQue('aliento aspirado: casi sin siseo arriba de 6 kHz, comparado con soplado (dB)', 10 * Math.log10((banda(sop2, 6000, 7000) / banda(sop2, 370, 400)) / (banda(asp, 6000, 7000) / banda(asp, 370, 400))), 6);
  a.ver('… y suena sano', sano(asp) ? 1 : 0, 1, 0);
  // 2026-11-26: ñolkiñ de tallo hueco con cono de hoja (tercera grabación: ≈ 108 Hz, 1,5–2 m)
  const tallo = { smt: 1, stb: 1, sgm: 1, slm: 1, slc: 145, sdc: 20, slh: 20, sdh: 80, sfh: 0, spa: 30, scb: 50, ssn: 1, slb: 1, sai: 75, sru: 0, sca: 100 };
  a.ver('tallo de 1,45 m + cono de 20 cm: la nota del tubo (Hz, ±3 %)', N.medidaTubo(tallo, FM).hz, 109, 3.3);
  const tal = tocar(69, tallo);
  a.ver('… suena y no se dispara', sano(tal) && pico2(tal, 0.4, 0.7) > 0.05 ? 1 : 0, 1, 0);
  // (la pared: lo que hace en el timbre depende del aire; se prueba que el tubo siga sano)
  a.ver('… con la pared lisa también', sano(tocar(69, { ...tallo, spa: 0, scb: 0 })) ? 1 : 0, 1, 0);
  a.mayorQue('sin zumbido cerca de la mitad de la frecuencia de muestreo (dB bajo la nota)', 10 * Math.log10(banda(tal, 440, 470) / banda(tal, FM * 0.42, FM * 0.45)), 30);

  const c = tocar(57, { smt: 2, sai: 70 });
  a.ver('caña recta: suena en su nota (220 Hz, ±3 %)', frecAC(c, 0.4, 0.7), 220, 7);
  const sx = tocar(57, { smt: 2, sfo: 1, sai: 70 });
  a.ver('caña cónica: suena y no se dispara', sano(sx) && pico2(sx, 0.4, 0.7) > 0.05 ? 1 : 0, 1, 0);

  // al soltar, el tubo se apaga y la voz se libera
  const s = nuevo(zs, []);
  const { L: Ls } = correr(s, 1.5, [[0, 'on', 69], [0.5, 'off', 69]], sop({ smt: 0, vrt: 50 }));
  a.menorQue('soplo: después de soltar, silencio (pico)', pico2(Ls, 1.1, 1.5), 1e-3);
  a.ver('… y la voz se libera', s.cuantasVoces(), 0, 0);
  // el aire desde la rueda de modulación: en cero, callado
  const s2 = nuevo(zs, []);
  s2.controlar('rueda', 0);
  const { L: Lr } = correr(s2, 0.6, [[0, 'on', 69]], sop({ smt: 0, sfa: 1 }));
  a.menorQue('aire desde la rueda: con la rueda abajo, casi nada (pico)', pico2(Lr, 0.3, 0.55), 0.05);
}

// --- los modificadores de la capa
{
  const mod = (o) => {
    const out = { c1vvs: 0, c1vat: 0.5 };
    for (const [k, x] of Object.entries(o)) out[`c1${k}`] = x;
    return porDefecto(N, out);
  };
  const base = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], mod({})).L;
  const conRealce = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], mod({ mhm: 100, mhi: 80, mhz: 3 })).L;
  let dif = 0;
  for (let i = tramo(0.2, 0)[0]; i < tramo(0.45, 0)[0]; i++) dif = Math.max(dif, Math.abs(conRealce[i] - base[i]));
  a.mayorQue('realce de armónicos: cambia el sonido', dif, 0.05);
  const res = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], mod({ mrm: 100, mrf: 90 })).L;
  const cue = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], mod({ mcm: 100, mcy: 1 })).L;
  a.ver('resonador y cuerpo: suenan sin dispararse', [res, cue].every((x) => x.every((y) => Number.isFinite(y) && Math.abs(y) < 4)) && pico2(res, 0.2, 0.45) > 0.05 && pico2(cue, 0.2, 0.45) > 0.01 ? 1 : 0, 1, 0);
}

// --- paso 4: estirar por espectro, por tramos
{
  const x = tono(0.5, 440, 1);
  const { canales, bordes } = estirarTramos([x], [{ a: 0, b: FM, f: 2 }]);
  const y = canales[0];
  a.ver('al doble: dura el doble (s)', y.length / FM, 2, 0.001);
  a.ver('… sin cambiar la altura (Hz)', frecuencia(y, ...tramo(0.2, 1.8)), 440, 3);
  a.ver('… y con el mismo volumen (pico)', pico(y.subarray(...tramo(0.2, 1.8))), 0.5, 0.06);
  a.ver('el borde final cae al final (muestras)', bordes[1], 2 * FM, 1);
  const { canales: c2 } = estirarTramos([x], [{ a: 0, b: FM, f: 0.5 }]);
  a.ver('a la mitad: la mitad de largo (s)', c2[0].length / FM, 0.5, 0.001);
  a.ver('… sin cambiar la altura (Hz)', frecuencia(c2[0], ...tramo(0.1, 0.4)), 440, 4);
  // tres tramos con proporciones distintas, en una pasada
  const t3 = estirarTramos([x], [{ a: 0, b: FM * 0.2, f: 1 }, { a: FM * 0.2, b: FM * 0.6, f: 1.5 }, { a: FM * 0.6, b: FM, f: 0.5 }]);
  a.ver('por tramos: cada borde donde va (s)', t3.bordes[2] / FM, 0.2 + 0.6, 0.001);
  a.ver('por tramos: el largo total (s)', t3.canales[0].length / FM, 0.2 + 0.6 + 0.2, 0.001);
  let salto = 0;
  const z = t3.canales[0];
  for (let i = Math.round(0.1 * FM); i < Math.round(0.9 * FM); i++) salto = Math.max(salto, Math.abs(z[i] - z[i - 1]));
  a.menorQue('por tramos: sin costuras (el mayor salto; la sinusoide da 0,031)', salto, 0.05);
  a.ver('en tiempos: 2 tiempos a 120 bpm son 1 s', segundosDe({ u: 't', v: 2 }, 120), 1, 1e-9);
  a.ver('en milisegundos', segundosDe({ u: 'ms', v: 250 }, 90), 0.25, 1e-9);
}

// --- paso 5: capas que son osciladores
{
  const oz = (forma, golpe = false) => [{ baja: 0, alta: 127, raiz: 60, golpe, capas: [{ osc: { forma, ancho: 50 } }] }];
  const { L } = correr(nuevo(oz(0), []), 0.5, [[0, 'on', 57]], PD({ atq: 0.5, vel: 0 }));
  a.ver('un oscilador seno toca la nota (La 3 = 220 Hz)', frecuencia(L, ...tramo(0.1, 0.45)), 220, 3);
  a.ver('… con su volumen (0,5 al centro: 0,354)', pico2(L, 0.1, 0.45), 0.5 * Math.SQRT1_2, 0.01);
  const { L: S } = correr(nuevo(oz(2), []), 0.5, [[0, 'on', 81]], PD({ atq: 0.5, vel: 0 }));
  a.ver('la sierra, a la nota (Hz)', frecuencia(S, ...tramo(0.1, 0.45)), 880, 8);
  a.menorQue('… sin pasarse de 1 (pico)', pico2(S, 0.1, 0.45), 0.5);
  const s = nuevo(oz(3), []);
  const { L: Q } = correr(s, 1, [[0, 'on', 60], [0.4, 'off', 60]], PD({ atq: 0.5, vel: 0, sol: 50 }));
  a.menorQue('al soltar, el oscilador se apaga con el release (pico)', pico2(Q, 0.6, 1), 1e-6);
  a.ver('… y la voz se libera', s.cuantasVoces(), 0, 0);
  const g = nuevo(oz(0, true), []);
  correr(g, 1, [[0, 'on', 60]], PD({ atq: 0.5, vel: 0, dec: 200 }));
  a.ver('en un golpe, el oscilador cae a cero en el decaimiento y la voz se libera', g.cuantasVoces(), 0, 0);
}

// LOS PRESETS (2026-11-26): los de fábrica traen todos los parámetros, suenan, y un paquete va y
// vuelve igual.
{
  for (const P of FABRICA) {
    const e = estadoDeFabrica(P, N.PARAMS);
    a.ver(`preset «${P.nombre}»: trae todos los parámetros`, Object.keys(e.parameterValues).length, N.PARAMS.length, 0);
    a.ver('… y todos sus ajustes son parámetros de verdad', Object.keys(P.capa1).every((k) => `c1${k}` in e.parameterValues) ? 1 : 0, 1, 0);
    const p = {};
    for (const [id, x] of Object.entries(e.parameterValues)) p[id] = x.value;
    const nota = P.nombre.startsWith('Trutruka') ? 58 : 69;
    const x = correr(nuevo(e.inst.zonas, []), 0.8, [[0, 'on', nota, 110]], p).L;
    a.ver('… suena y no se dispara', x.every((y) => Number.isFinite(y) && Math.abs(y) < 4) && pico(x.subarray(Math.round(0.4 * FM), Math.round(0.75 * FM))) > 0.05 ? 1 : 0, 1, 0);
  }
  const e = estadoDeFabrica(FABRICA[0], N.PARAMS);
  const d = desempaquetar(JSON.parse(JSON.stringify(empaquetar('mío', e))));
  a.ver('un preset en un archivo: va y vuelve igual', d && d.nombre === 'mío' && JSON.stringify(d.estado) === JSON.stringify(e) ? 1 : 0, 1, 0);
  a.ver('… y lo que no es un preset no se toma', desempaquetar({ formato: 'otro', estado: {} }) === null && desempaquetar(null) === null ? 1 : 0, 1, 0);
}

a.cerrar();
