// PRUEBA DEL FILTRADO DEL ECUALIZADOR, con Node y sin navegador:
//   node ecualizador/prueba.mjs   (o npm test)
// Mide con tonos lo que sale y lo compara con lo que dice la teoría y con la curva que
// dibuja la carátula (`magnitud` del núcleo): tienen que coincidir.
import { nucleoEq } from './nucleo.js';
import { dspEq } from './procesador.js';

const ambito = {};
globalThis.webAudioModules = { getModuleScope: () => ambito };
dspEq('prueba', nucleoEq);
const { coefs, magnitud, etapas, qEtapa } = nucleoEq();
const FM = 48000;
const db = (x) => 20 * Math.log10(x + 1e-12);

// Cuántos dB cambia un tono de `hz` al pasar por un ecualizador con esas bandas
// ([tipo, frec, gan, q, pendiente]…) y esa ganancia de salida.
function medir(hz, bandas, salidaDb = 0) {
  const eq = ambito.pzCrearEq(FM, 8);
  bandas.forEach((b, i) => eq.poner(i, true, ...b));
  const n = FM;
  const ent = Float32Array.from({ length: n }, (_, i) => 0.1 * Math.sin((2 * Math.PI * hz * i) / FM));
  const sI = new Float32Array(n);
  const sD = new Float32Array(n);
  for (let i = 0; i < n; i += 128) eq.procesar(ent, ent, sI, sD, i, Math.min(n, i + 128), 10 ** (salidaDb / 20));
  // se mide la energía (no el pico: en los agudos hay pocas muestras por ciclo y el pico engaña)
  let pI = 0;
  let pD = 0;
  for (let i = n / 2; i < n; i++) {
    pI += sI[i] * sI[i];
    pD += sD[i] * sD[i];
  }
  pI = Math.sqrt((2 * pI) / (n / 2));
  pD = Math.sqrt((2 * pD) / (n / 2));
  if (Math.abs(pI - pD) > 1e-9) throw new Error('las dos orejas no salen iguales');
  return db(pI) - db(0.1);
}
const curva = (hz, bandas) =>
  bandas.reduce((suma, [tipo, frec, gan, q, pend]) => {
    const n = etapas(tipo, pend);
    for (let s = 0; s < n; s++) suma += magnitud(coefs(new Float64Array(5), tipo, frec, gan, qEtapa(q, s, n), FM), hz, FM);
    return suma;
  }, 0);

let fallas = 0;
function ver(nombre, valor, esperado, margen) {
  const bien = Math.abs(valor - esperado) <= margen;
  if (!bien) fallas++;
  console.log(`${bien ? 'bien ' : 'MAL  '} ${nombre}: ${valor.toFixed(3)} (se espera ${esperado} ± ${margen})`);
}
function menorQue(nombre, valor, tope) {
  const bien = valor < tope;
  if (!bien) fallas++;
  console.log(`${bien ? 'bien ' : 'MAL  '} ${nombre}: ${valor.toFixed(2)} (se espera menos de ${tope})`);
}

// 1. Sin bandas no cambia nada.
ver('sin bandas, 1 kHz (dB)', medir(1000, []), 0, 1e-6);
// 2. Campana de +6 dB en 1 kHz: +6 en el centro, casi nada lejos.
ver('campana +6 dB en 1 kHz, tono de 1 kHz (dB)', medir(1000, [[0, 1000, 6, 1]]), 6, 0.02);
ver('campana +6 dB en 1 kHz, tono de 60 Hz (dB)', medir(60, [[0, 1000, 6, 1]]), 0, 0.1);
ver('campana −12 dB en 300 Hz, tono de 300 Hz (dB)', medir(300, [[0, 300, -12, 4]]), -12, 0.02);
// 3. Repisas: llegan a su ganancia en su lado y no tocan el otro.
ver('repisa alta +6 dB en 2 kHz, tono de 12 kHz (dB)', medir(12000, [[2, 2000, 6, 0.71]]), 6, 0.2);
ver('repisa alta +6 dB en 2 kHz, tono de 100 Hz (dB)', medir(100, [[2, 2000, 6, 0.71]]), 0, 0.1);
ver('repisa baja −9 dB en 200 Hz, tono de 30 Hz (dB)', medir(30, [[1, 200, -9, 0.71]]), -9, 0.3);
ver('repisa baja −9 dB en 200 Hz, tono de 5 kHz (dB)', medir(5000, [[1, 200, -9, 0.71]]), 0, 0.1);
// 4. Cortes: −3 dB en su frecuencia (Q 0,707) y 12 dB por octava.
ver('corte bajo en 200 Hz, tono de 200 Hz (dB)', medir(200, [[3, 200, 0, Math.SQRT1_2]]), -3.01, 0.05);
ver('corte bajo en 200 Hz, tono de 50 Hz (dB)', medir(50, [[3, 200, 0, Math.SQRT1_2]]), -24.1, 0.3);
// (en digital el corte alto cae un poco más que en la teoría analógica, que daría −24,1)
ver('corte alto en 2 kHz, tono de 8 kHz (dB)', medir(8000, [[4, 2000, 0, Math.SQRT1_2]]), -25.7, 0.1);
ver('corte alto en 2 kHz, tono de 100 Hz (dB)', medir(100, [[4, 2000, 0, Math.SQRT1_2]]), 0, 0.05);
// 4b. Cortes más duros: siguen en −3 dB en su frecuencia, caen 24, 36 o 48 dB por octava
// y no tocan lo que dejan pasar.
ver('corte bajo de 24 dB/oct en 200 Hz, tono de 200 Hz (dB)', medir(200, [[3, 200, 0, Math.SQRT1_2, 1]]), -3.01, 0.05);
ver('corte bajo de 24 dB/oct en 200 Hz, tono de 100 Hz (dB)', medir(100, [[3, 200, 0, Math.SQRT1_2, 1]]), -24.1, 0.3);
ver('corte bajo de 36 dB/oct en 200 Hz, tono de 100 Hz (dB)', medir(100, [[3, 200, 0, Math.SQRT1_2, 2]]), -36.1, 0.3);
ver('corte bajo de 48 dB/oct en 200 Hz, tono de 100 Hz (dB)', medir(100, [[3, 200, 0, Math.SQRT1_2, 3]]), -48.2, 0.3);
ver('corte bajo de 48 dB/oct en 200 Hz, tono de 200 Hz (dB)', medir(200, [[3, 200, 0, Math.SQRT1_2, 3]]), -3.01, 0.05);
ver('corte bajo de 48 dB/oct en 200 Hz, tono de 1 kHz (dB)', medir(1000, [[3, 200, 0, Math.SQRT1_2, 3]]), 0, 0.01);
ver('corte alto de 48 dB/oct en 4 kHz, tono de 1 kHz (dB)', medir(1000, [[4, 4000, 0, Math.SQRT1_2, 3]]), 0, 0.01);
menorQue('corte alto de 48 dB/oct en 4 kHz, tono de 8 kHz (dB)', medir(8000, [[4, 4000, 0, Math.SQRT1_2, 3]]), -48);
// en una campana la pendiente no hace nada
ver('campana +6 dB con pendiente puesta, tono de 1 kHz (dB)', medir(1000, [[0, 1000, 6, 1, 3]]), 6, 0.02);
// 5. Muesca: borra su frecuencia.
menorQue('muesca en 1 kHz, tono de 1 kHz (dB)', medir(1000, [[5, 1000, 0, 4]]), -50);
// 6. Salida.
ver('salida −6 dB (dB)', medir(1000, [], -6), -6, 1e-4);
// 7. Varias bandas a la vez: lo que suena es lo que dibuja la curva.
{
  const bandas = [
    [3, 40, 0, 0.71, 2],
    [0, 250, -4, 1.4],
    [0, 3000, 5, 2],
    [2, 9000, 3, 0.71],
    [4, 15000, 0, 1.2, 3],
  ];
  let peor = 0;
  for (const hz of [30, 60, 125, 250, 500, 1000, 2000, 3000, 6000, 12000, 18000]) {
    peor = Math.max(peor, Math.abs(medir(hz, bandas) - curva(hz, bandas)));
  }
  ver('cinco bandas (con cortes duros): mayor diferencia entre lo que suena y la curva (dB)', peor, 0, 0.05);
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
