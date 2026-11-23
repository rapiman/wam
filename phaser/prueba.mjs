// PRUEBA DEL PHASER (Node).   node phaser/prueba.mjs
import { nucleoPhaser } from './nucleo.js';
import { FM, db, tono, porDefecto, pasar, nivel, pico, diferencia, anotador } from '../comun/probar.mjs';

const N = nucleoPhaser();
const a = anotador();
const ent = tono(0.3, 600, 1);
a.ver('mezcla 0 % deja la entrada igual', diferencia(pasar(N, porDefecto(N, { mezcla: 0 }), ent).sI, ent), 0, 1e-7);
// la cadena sola (mezcla 100 %, sin realimentación ni vaivén) no cambia el volumen de ningún tono
for (const hz of [100, 800, 5000]) a.ver(`pasa todo: un tono de ${hz} Hz sale con el mismo volumen (dB)`, db(nivel(pasar(N, porDefecto(N, { mezcla: 100, realim: 0, prof: 0 }), tono(0.2, hz, 1)).sI)) - db(0.2), 0, 0.02);
// a medias con el original aparecen las muescas, donde la cadena da vuelta la onda. Con 4 etapas
// cada una tiene que atrasar un octavo de vuelta: eso pasa (bajo el centro) en esta frecuencia.
{
  const centro = 800;
  const muesca = (Math.atan(Math.tan((Math.PI * centro) / FM) * Math.tan(Math.PI / 8)) * FM) / Math.PI;
  const p = porDefecto(N, { mezcla: 50, realim: 0, prof: 0, etapas: 0, frec: centro });
  a.menorQue(`mezcla 50 %, 4 etapas: el tono de la muesca (${muesca.toFixed(0)} Hz) casi desaparece (dB)`, db(nivel(pasar(N, p, tono(0.2, muesca, 2)).sI)) - db(0.2), -40);
  a.ver('mezcla 50 %, 4 etapas: el tono del centro pasa entero (dB)', db(nivel(pasar(N, p, tono(0.2, centro, 1)).sI)) - db(0.2), 0, 0.05);
}
a.ver('mezcla 50 %: un tono muy grave pasa entero (dB)', db(nivel(pasar(N, porDefecto(N, { mezcla: 50, realim: 0, prof: 0, etapas: 0, frec: 800 }), tono(0.2, 25, 2)).sI)) - db(0.2), 0, 0.3);
for (const realim of [95, -95]) a.menorQue(`realimentación ${realim} % con 12 etapas no se dispara (pico)`, pico(pasar(N, porDefecto(N, { realim, etapas: 3, prof: 3, vel: 10, mezcla: 100 }), tono(0.3, 500, 3)).sI), 20);
{
  const { sI, sD } = pasar(N, porDefecto(N, {}), ent);
  a.mayorQue('con ancho, las dos orejas salen distintas', diferencia(sI, sD), 0.005);
}
a.cerrar();
