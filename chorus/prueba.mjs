// PRUEBA DEL RETARDO CON VAIVÉN, el núcleo del chorus y del flanger (Node).   node chorus/prueba.mjs
import { nucleoRetardo, CHORUS, FLANGER } from '../comun/nucleoRetardo.js';
import { FM, tono, porDefecto, pasar, pico, diferencia, anotador } from '../comun/probar.mjs';

const a = anotador();
for (const [nombre, cfg] of [['chorus', CHORUS], ['flanger', FLANGER]]) {
  const N = nucleoRetardo(cfg);
  const ent = tono(0.4, 330, 1);
  a.ver(`${nombre}: mezcla 0 % deja la entrada igual`, diferencia(pasar(N, porDefecto(N, { mezcla: 0 }), ent).sI, ent), 0, 1e-7);
  // sin vaivén y con mezcla 100 % es un atraso puro de «retardo» ms
  const ms = nombre === 'chorus' ? 10 : 2;
  const corrido = (ms / 1000) * FM;
  const seco = porDefecto(N, { mezcla: 100, prof: 0, retardo: ms, ...(cfg.realim !== undefined ? { realim: 0 } : {}) });
  a.ver(`${nombre}: sin vaivén, mezcla 100 % es la entrada atrasada ${ms} ms`, diferencia(pasar(N, seco, ent).sI, ent, corrido), 0, 1e-6);
  // con vaivén la salida cambia en el tiempo y las dos orejas no son iguales (ancho)
  const { sI, sD } = pasar(N, porDefecto(N, { mezcla: 50 }), ent);
  a.mayorQue(`${nombre}: con ancho, las dos orejas salen distintas`, diferencia(sI, sD), 0.01);
  a.menorQue(`${nombre}: no se dispara (pico)`, pico(sI), 2);
  a.ver(`${nombre}: sin ancho las dos orejas salen iguales`, diferencia(...Object.values(pasar(N, porDefecto(N, { ancho: 0 }), ent))), 0, 1e-9);
}
{
  // el flanger con la realimentación al tope sigue acotado
  const N = nucleoRetardo(FLANGER);
  for (const realim of [95, -95]) a.menorQue(`flanger: realimentación ${realim} % no se dispara (pico)`, pico(pasar(N, porDefecto(N, { realim, prof: 5, vel: 5, mezcla: 100 }), tono(0.5, 440, 3)).sI), 12);
  a.ver('el chorus no tiene realimentación y el flanger sí', Number(nucleoRetardo(CHORUS).PARAMS.some((p) => p.id === 'realim')) + 2 * Number(N.PARAMS.some((p) => p.id === 'realim')), 2, 0);
}
a.cerrar();
