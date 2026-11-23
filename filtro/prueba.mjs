// PRUEBA DEL FILTRO (Node): lo que suena coincide con la curva que dibuja la carátula, cada tipo
// hace lo suyo y la mezcla y el vaivén no rompen nada.   node filtro/prueba.mjs
import { nucleoFiltro } from './nucleo.js';
import { FM, db, tono, porDefecto, pasar, nivel, pico, diferencia, anotador } from '../comun/probar.mjs';

const N = nucleoFiltro();
const a = anotador();
const medir = (hz, cambios) => db(nivel(pasar(N, porDefecto(N, cambios), tono(0.1, hz, 1)).sI)) - db(0.1);

a.ver('pasa bajos en 1 kHz, tono de 1 kHz (dB)', medir(1000, {}), -3.01, 0.05);
a.ver('pasa bajos en 1 kHz, tono de 100 Hz (dB)', medir(100, {}), 0, 0.02);
a.ver('pasa altos en 1 kHz, tono de 250 Hz (dB)', medir(250, { tipo: 1 }), -24.1, 0.3);
a.ver('pasa altos de 24 dB/oct en 1 kHz, tono de 250 Hz (dB)', medir(250, { tipo: 1, pend: 1 }), -48.2, 0.4);
a.ver('pasa altos de 24 dB/oct en 1 kHz, tono de 1 kHz (dB)', medir(1000, { tipo: 1, pend: 1 }), -3.01, 0.05);
a.ver('pasa banda en 1 kHz, tono de 1 kHz (dB)', medir(1000, { tipo: 2, res: 4 }), 0, 0.02);
a.menorQue('pasa banda en 1 kHz (Q 4), tono de 100 Hz (dB)', medir(100, { tipo: 2, res: 4 }), -25);
a.menorQue('muesca en 1 kHz, tono de 1 kHz (dB)', medir(1000, { tipo: 3, res: 4 }), -50);
a.ver('resonancia 4 en el corte del pasa bajos (dB)', medir(1000, { res: 4 }), 12.04, 0.1);
// lo que suena es lo que dibuja la curva
{
  let peor = 0;
  for (const cambios of [{}, { tipo: 1, pend: 1, res: 2 }, { tipo: 2, res: 3, frec: 3000 }, { tipo: 0, pend: 1, frec: 400, res: 5 }]) {
    const p = porDefecto(N, cambios);
    for (const hz of [60, 250, 400, 1000, 3000, 8000]) peor = Math.max(peor, Math.abs(Math.max(-90, medir(hz, cambios)) - Math.max(-90, N.respuesta(p, hz, FM))));
  }
  a.ver('mayor diferencia entre lo que suena y la curva (dB)', peor, 0, 0.05);
}
{
  const ent = tono(0.3, 500, 0.5);
  a.ver('mezcla 0 %: diferencia con la entrada', diferencia(pasar(N, porDefecto(N, { mezcla: 0, frec: 100 }), ent).sI, ent), 0, 1e-7);
  const { sI, sD } = pasar(N, porDefecto(N, { prof: 4, vel: 8, res: 12, pend: 1 }), tono(0.5, 700, 2));
  a.menorQue('con vaivén y resonancia al máximo no se dispara (pico)', pico(sI), 30);
  a.ver('las dos orejas salen iguales con la misma entrada', diferencia(sI, sD), 0, 1e-9);
}
a.cerrar();
