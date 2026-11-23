// REVERB DE ESPACIOS — plugin WAM 2.0 propio (2026-11-23). Se llama `reverberacion` y no `reverb`
// porque en Pizarrita `reverb` ya es otro plugin (el Microverb de burns-audio).
// Reverberación por convolución: el sonido se pasa
// por la respuesta de un espacio. La convolución la hace el navegador (`ConvolverNode`), así que
// este plugin es un nodo COMPUESTO: el del molde reparte el sonido (seco por su salida 0, lo que
// va al espacio por la 2; `nucleo.js`) y acá se arma lo demás:
//
//     entrada → [nodo] ─ salida 0 (seco) ───────────────┐
//                  ├──── salida 2 → convolución ────────┴→ suma → lo que sigue en la cadena
//                  └──── salida 1 (la entrada sin tocar, para el espectro)
//
// Para quien lo conecta sigue siendo un nodo solo: `connect` y `disconnect` de su salida 0 van a
// la suma. Los espacios de hoy son generados (`espacios.js`); el espacio y el largo se miran cada
// rato y, si cambiaron, se calcula la respuesta nueva.
import descriptor from './descriptor.json';
import { hacerModulo } from '../comun/molde.js';
import { caratulaSimple } from '../comun/caratulaSimple.js';
import { nucleoReverb } from './nucleo.js';
import { generarEspacio } from './espacios.js';

const N = nucleoReverb();

async function componer(nodo) {
  const ctx = nodo.context;
  const conectar = AudioNode.prototype.connect;
  const desconectar = AudioNode.prototype.disconnect;
  const espacio = new ConvolverNode(ctx);
  const suma = new GainNode(ctx);
  conectar.call(nodo, suma, 0);
  conectar.call(nodo, espacio, 2);
  espacio.connect(suma);

  // Para afuera, la salida 0 del plugin es la suma.
  nodo.connect = (destino, salida = 0, entrada) => {
    const desde = salida === 0 ? suma : nodo;
    const args = salida === 0 ? [destino, 0] : [destino, salida];
    if (entrada !== undefined) args.push(entrada);
    return conectar.apply(desde, args);
  };
  nodo.disconnect = (destino) => {
    if (destino === undefined) {
      // todo lo de afuera; lo de adentro (seco y espacio hacia la suma) se queda
      suma.disconnect();
      try {
        desconectar.call(nodo, 1);
      } catch (e) {
        // nada colgado de la salida 1
      }
      return;
    }
    for (const desde of [suma, nodo]) {
      try {
        desconectar.call(desde, destino);
      } catch (e) {
        // no estaba conectado desde acá
      }
    }
  };

  // La respuesta del espacio elegido, con su largo.
  let puesto = '';
  const poner = async () => {
    const v = await nodo.getParameterValues(false, 'espacio', 'largo');
    if (!v || !v.espacio || !v.largo) return;
    const cual = Math.round(v.espacio.value);
    const largo = Math.round(v.largo.value);
    const llave = `${cual}|${largo}`;
    if (llave === puesto) return;
    puesto = llave;
    const { izq, der } = generarEspacio(ctx.sampleRate, cual, largo);
    const buf = ctx.createBuffer(2, izq.length, ctx.sampleRate);
    buf.getChannelData(0).set(izq);
    buf.getChannelData(1).set(der);
    espacio.buffer = buf;
  };
  await poner();
  const reloj = setInterval(() => void poner().catch(() => {}), 200);

  const destruir = nodo.destroy.bind(nodo);
  nodo.destroy = () => {
    clearInterval(reloj);
    destruir();
    try {
      espacio.disconnect();
      desconectar.call(nodo);
    } catch (e) {
      // ya estaba suelto
    }
  };
}

export default hacerModulo({
  descriptor,
  nucleo: nucleoReverb,
  salidas: [2, 1, 2],
  componer,
  caratula: (nodo) => caratulaSimple(nodo, { titulo: 'Reverb de espacios', PARAMS: N.PARAMS }),
});
