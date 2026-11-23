// PRUEBA DEL TRÉMOLO (Node).   node tremolo/prueba.mjs
import { nucleoTremolo } from './nucleo.js';
import { FM, porDefecto, pasar, diferencia, anotador } from '../comun/probar.mjs';

const N = nucleoTremolo();
const a = anotador();
const uno = new Float32Array(FM * 2).fill(1); // una señal pareja: lo que sale ES el volumen
a.ver('profundidad 0 % deja la entrada igual', diferencia(pasar(N, porDefecto(N, { prof: 0 }), uno).sI, uno), 0, 1e-6);
for (const forma of [0, 1, 2]) {
  const s = pasar(N, porDefecto(N, { prof: 100, vel: 4, forma }), uno).sI.subarray(FM);
  a.ver(`${N.FORMAS[forma]} al 100 %: baja hasta`, s.reduce((m, x) => Math.min(m, x), 9), 0, 0.01);
  a.ver(`${N.FORMAS[forma]} al 100 %: sube hasta`, s.reduce((m, x) => Math.max(m, x), 0), 1, 0.01);
  // cuántas veces sube por encima de la mitad en un segundo = la velocidad
  let cruces = 0;
  for (let i = 1; i < s.length; i++) if (s[i - 1] < 0.5 && s[i] >= 0.5) cruces++;
  a.ver(`${N.FORMAS[forma]} a 4 Hz: vueltas por segundo`, cruces, 4, 0);
}
a.ver('profundidad 30 %: baja hasta', pasar(N, porDefecto(N, { prof: 30, vel: 2 }), uno).sI.subarray(FM).reduce((m, x) => Math.min(m, x), 9), 0.7, 0.01);
{
  const { sI, sD } = pasar(N, porDefecto(N, { prof: 100, vel: 2, fase: 180 }), uno);
  let suma = 0;
  for (let i = FM; i < sI.length; i++) suma = Math.max(suma, Math.abs(sI[i] + sD[i] - 1));
  a.ver('a 180° entre orejas, lo que baja una lo sube la otra (paneo): suma − 1', suma, 0, 0.01);
  a.ver('a 0° las dos orejas van juntas', diferencia(...Object.values(pasar(N, porDefecto(N, { prof: 80 }), uno))), 0, 1e-9);
}
a.cerrar();
