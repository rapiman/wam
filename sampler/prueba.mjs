// PRUEBA DEL CORAZÓN DEL SAMPLER (Node): las zonas, la altura, el loop y sus tres partes, el golpe
// de batería, las capas y la envolvente.   node sampler/prueba.mjs
import { nucleoSampler } from './nucleo.js';
import { energias, golpes, parejos } from './tajadas.js';
import { FM, tono, porDefecto, anotador, pico } from '../comun/probar.mjs';

const N = nucleoSampler();
const a = anotador();
const P = porDefecto(N, { atq: 0, vel: 0 });

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
  const { L } = correr(s, 3, [[0, 'on', 69], [2, 'off', 69]], porDefecto(N, { atq: 0, vel: 0, sol: 50 }));
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
  const { L } = correr(s, 1, [[0, 'on', 69]], porDefecto(N, { atq: 500, vel: 0 }));
  a.menorQue('a los 0,1 s del ataque de 0,5 s, todavía bajo (pico)', pico(L.subarray(...tramo(0.09, 0.11))), 0.12);
  const s2 = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L: L2 } = correr(s2, 1.5, [[0, 'on', 69]], porDefecto(N, { atq: 0, dec: 100, sos: 50, vel: 0 }));
  // (al centro, cada oreja lleva 0,707 del sonido: el paneo de igual potencia)
  a.ver('sostenido 50 %: a la mitad (pico)', pico(L2.subarray(...tramo(1, 1.4))), 0.25 * Math.SQRT1_2, 0.01);
  const s3 = nuevo([{ baja: 0, alta: 127, raiz: 69, capas: [{ m: 'la' }] }], [['la', la, FM]]);
  const { L: L3 } = correr(s3, 0.3, [[0, 'on', 69, 64]], porDefecto(N, { atq: 0, vel: 100 }));
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
  const con = correr(nuevo(unaZona({ m: 'g' }), [['g', agudo, FM]]), 0.5, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, ftipo: 1, corte: 500, reso: 0 })).L;
  a.menorQue('pasa bajos en 500 Hz: un tono de 5 kHz baja más de 30 dB (razón)', pico2(con, 0.2, 0.45) / pico2(sin, 0.2, 0.45), 0.032);
  const alto = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, ftipo: 2, corte: 5000, reso: 0 })).L;
  a.menorQue('pasa altos en 5 kHz: el La casi no pasa (pico)', pico2(alto, 0.2, 0.45), 0.02);
  const env = correr(nuevo(unaZona({ m: 'g' }), [['g', agudo, FM]]), 1, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, ftipo: 1, corte: 300, reso: 0, fenv: 5, fatq: 0.5, fdec: 300 })).L;
  a.mayorQue('la envolvente del filtro lo abre al comienzo… (pico)', pico2(env, 0.01, 0.05), 0.08);
  a.menorQue('… y después se cierra (pico)', pico2(env, 0.6, 0.9), 0.02);
}
{
  const callada = [tono(0.0001, 440, 2)];
  const { L } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.6, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, sub: 100 }));
  a.ver('el sub, una octava abajo de la nota (Hz)', frecuencia(L, ...tramo(0.1, 0.5)), 220, 4);
  const { L: L2 } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.6, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, sub: 100, subOct: 1 }));
  a.ver('con −2, dos octavas abajo (Hz)', frecuencia(L2, ...tramo(0.1, 0.5)), 110, 4);
  const { L: L3 } = correr(nuevo(unaZona({ m: 'c' }), [['c', callada, FM]]), 0.3, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, ruido: 100 }));
  a.mayorQue('el ruido suena aunque el audio esté callado (pico)', pico2(L3, 0.1, 0.25), 0.1);
}
{
  const { L, R } = correr(nuevo(unaZona(), [['la', la, FM]]), 1, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, desaf: 100 }));
  a.ver('desafinado 100 ct: la izquierda medio semitono abajo (Hz)', frecuencia(L, ...tramo(0.1, 0.9)), 440 * Math.pow(2, -50 / 1200), 4);
  a.ver('… y la derecha medio semitono arriba (Hz)', frecuencia(R, ...tramo(0.1, 0.9)), 440 * Math.pow(2, 50 / 1200), 4);
}
{
  const { L } = correr(nuevo(unaZona(), [['la', la, FM]]), 0.5, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, dist: 24 }));
  a.ver('distorsión de 24 dB: el pico queda en 1/√g', pico2(L, 0.1, 0.45), 1 / Math.sqrt(dB24()), 0.01);
}
function dB24() {
  return Math.pow(10, 24 / 20);
}
{
  // un vaivén cuadrado de 2 Hz al volumen, al 100 %: un cuarto de segundo suena, el otro no
  const { L } = correr(nuevo(unaZona(), [['la', la, FM]]), 1.2, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, l1f: 2, l1v: 2, l1p: 100, l1d: 1 }));
  const tr = [pico2(L, 0.05, 0.2), pico2(L, 0.3, 0.45), pico2(L, 0.55, 0.7), pico2(L, 0.8, 0.95)];
  a.mayorQue('vaivén al volumen: la mitad arriba suena (pico)', Math.min(tr[0], tr[2]), 0.3);
  a.menorQue('… y la mitad abajo, callada (pico)', Math.max(tr[1], tr[3]), 1e-3);
  const { L: L2 } = correr(nuevo(unaZona(), [['la', la, FM]]), 1, [[0, 'on', 69]], porDefecto(N, { atq: 0.5, vel: 0, l2f: 2, l2v: 1, l2p: 100, l2d: 0 }));
  a.ver('vaivén cuadrado a la altura, al 100 %: una octava arriba la primera mitad (Hz)', frecuencia(L2, ...tramo(0.05, 0.45)), 880, 8);
}

a.cerrar();
