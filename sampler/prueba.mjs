// PRUEBA DEL CORAZÓN DEL SAMPLER (Node): las zonas, la altura, el loop y sus tres partes, el golpe
// de batería, las capas y la envolvente.   node sampler/prueba.mjs
import { nucleoSampler } from './nucleo.js';
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

a.cerrar();
