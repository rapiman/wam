// PRUEBA DE LA REVERB (Node): el reparto del sonido (núcleo) y los espacios generados. La
// convolución es del navegador y se prueba ahí.   node reverberacion/prueba.mjs
import { nucleoReverb } from './nucleo.js';
import { ESPACIOS, generarEspacio } from './espacios.js';
import { FM, tono, porDefecto, diferencia, pico, anotador } from '../comun/probar.mjs';

const N = nucleoReverb();
const a = anotador();
// pasa una entrada por el núcleo y devuelve el seco y lo que va al espacio
function repartir(p, ent) {
  const efecto = N.crear(FM);
  const seco = new Float32Array(ent.length);
  const secoD = new Float32Array(ent.length);
  const envio = [new Float32Array(ent.length), new Float32Array(ent.length)];
  for (let i = 0; i < ent.length; i += 128) {
    const hasta = Math.min(ent.length, i + 128);
    efecto.procesar(ent, ent, seco, secoD, i, hasta, p, [null, null, envio]);
  }
  return { seco, envio: envio[0] };
}
const ent = tono(0.4, 300, 0.5);
{
  const { seco, envio } = repartir(porDefecto(N, { mezcla: 0 }), ent);
  a.ver('mezcla 0 %: el seco es la entrada', diferencia(seco, ent), 0, 1e-7);
  a.ver('mezcla 0 %: al espacio no va nada', pico(envio), 0, 1e-9);
}
{
  const { seco, envio } = repartir(porDefecto(N, { mezcla: 100, antes: 0, brillo: 20000 }), ent);
  a.ver('mezcla 100 %: no queda seco', pico(seco), 0, 1e-9);
  a.ver('mezcla 100 %, sin atraso y con todo el brillo: al espacio va la entrada', diferencia(envio, ent), 0, 1e-6);
}
{
  const golpe = new Float32Array(FM / 2);
  golpe[100] = 1;
  const { envio } = repartir(porDefecto(N, { mezcla: 100, antes: 50, brillo: 20000 }), golpe);
  let donde = 0;
  for (let i = 0; i < envio.length; i++) if (Math.abs(envio[i]) > Math.abs(envio[donde])) donde = i;
  a.ver('«antes» de 50 ms: el golpe llega al espacio 2400 muestras después', donde - 100, 2400, 0);
  const agudo = tono(0.4, 8000, 0.5);
  const conBrillo = pico(repartir(porDefecto(N, { mezcla: 100, brillo: 20000 }), agudo).envio.subarray(FM / 4));
  const sinBrillo = pico(repartir(porDefecto(N, { mezcla: 100, brillo: 1000 }), agudo).envio.subarray(FM / 4));
  a.menorQue('brillo en 1 kHz: un tono de 8 kHz llega al espacio mucho más bajo (veces)', sinBrillo / conBrillo, 0.2);
}
// los espacios
const energia = (x, desde, hasta) => {
  let e = 0;
  for (let i = Math.floor(desde); i < Math.min(x.length, hasta); i++) e += x[i] * x[i];
  return e / Math.max(1, Math.min(x.length, hasta) - Math.floor(desde));
};
ESPACIOS.forEach((e, cual) => {
  const { izq, der } = generarEspacio(FM, cual);
  // la cola cae 60 dB en `segundos`: entre el 30 % y el 80 % de ese tiempo tiene que caer 30 dB
  const v = 0.02 * FM;
  const cae = 10 * Math.log10(energia(izq, 0.3 * e.segundos * FM, 0.3 * e.segundos * FM + v) / energia(izq, 0.8 * e.segundos * FM, 0.8 * e.segundos * FM + v));
  a.ver(`${e.nombre}: la cola cae a su ritmo (dB entre el 30 % y el 80 % de ${e.segundos} s)`, cae, 30, 9);
  a.menorQue(`${e.nombre}: termina en silencio`, Math.abs(izq[izq.length - 1]), 1e-6);
  a.mayorQue(`${e.nombre}: las dos orejas son distintas`, diferencia(izq, der), 0.01);
});
{
  const uno = generarEspacio(FM, 2);
  a.ver('el mismo espacio sale siempre igual', diferencia(uno.izq, generarEspacio(FM, 2).izq), 0, 0);
  a.ver('con largo 50 % dura la mitad (veces)', generarEspacio(FM, 2, 50).izq.length / uno.izq.length, 0.5, 0.03);
  a.mayorQue('la Iglesia dura más que el Cuarto (veces)', generarEspacio(FM, 3).izq.length / generarEspacio(FM, 0).izq.length, 5);
}
a.cerrar();
