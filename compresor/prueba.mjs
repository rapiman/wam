// PRUEBA DEL CÁLCULO DEL COMPRESOR, con Node y sin navegador (2026-11-23):
//   node compresor/prueba.mjs   (o npm test)
// Arma el ámbito que en el navegador pone el SDK de WAM y mide lo que sale.
import { dspCompresor } from './procesador.js';

const ambito = {};
globalThis.webAudioModules = { getModuleScope: () => ambito };
dspCompresor('prueba');
const FM = 48000;
const BASE = { comp: true, umbral: -18, razon: 4, ataque: 10, relajacion: 120, rodilla: 0, ganancia: 0, mezcla: 100, lim: false, techo: -1 };
const db = (x) => 20 * Math.log10(x + 1e-12);

// Pasa `ent` (mono, a las dos orejas) por un compresor nuevo, de a 128 muestras.
function pasar(ent, p) {
  const c = ambito.pzCrearCompresor(FM);
  const sal = new Float32Array(ent.length);
  const d = new Float32Array(ent.length);
  for (let i = 0; i < ent.length; i += 128) c.procesar(ent, ent, sal, d, i, Math.min(ent.length, i + 128), p);
  return { sal, c };
}
const tono = (amp, hz, seg) => Float32Array.from({ length: Math.round(seg * FM) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / FM));
const pico = (a, desde = 0) => a.subarray(desde).reduce((m, x) => Math.max(m, Math.abs(x)), 0);

let fallas = 0;
function ver(nombre, valor, esperado, margen) {
  const bien = Math.abs(valor - esperado) <= margen;
  if (!bien) fallas++;
  console.log(`${bien ? 'bien ' : 'MAL  '} ${nombre}: ${valor.toFixed(3)} (se espera ${esperado} ± ${margen})`);
}

// 1. Tono de −6 dB, umbral −18, razón 4, rodilla 0: sale a −18 + 12/4 = −15 dB.
for (const hz of [100, 1000, 5000]) {
  const { sal } = pasar(tono(0.5, hz, 2), BASE);
  ver(`tono de ${hz} Hz a -6 dB sale a (dB)`, db(pico(sal, FM)), -15.02, 0.3);
}
// 2. Bajo el umbral no se toca.
{
  const ent = tono(0.05, 1000, 1);
  const { sal } = pasar(ent, BASE);
  ver('bajo el umbral, diferencia máxima', pico(sal.map((x, i) => x - ent[i])), 0, 1e-6);
}
// 3. Con rodilla de 12 dB, justo en el umbral: reduce (1 − 1/4)·(6²)/(2·12) = 1,125 dB.
{
  const amp = 10 ** (-18 / 20);
  const { sal } = pasar(tono(amp, 1000, 2), { ...BASE, rodilla: 12 });
  ver('rodilla 12 dB en el umbral, reducción (dB)', db(pico(sal, FM)) + 18, -1.125, 0.15);
}
// 4. Mezcla 0 %: pasa seco. Ganancia +6 dB bajo el umbral: sube 6 dB.
{
  const ent = tono(0.5, 1000, 1);
  ver('mezcla 0 %, diferencia máxima', pico(pasar(ent, { ...BASE, mezcla: 0 }).sal.map((x, i) => x - ent[i])), 0, 1e-6);
  const bajo = tono(0.01, 1000, 1);
  ver('ganancia +6 dB bajo el umbral (dB)', db(pico(pasar(bajo, { ...BASE, ganancia: 6 }).sal)) - db(0.01), 6, 0.01);
}
// 5. Limitador solo, techo −1 dB: ráfagas de +6 dB entre silencio y un golpe suelto. Nada pasa del techo.
{
  const ent = new Float32Array(FM * 2);
  for (let i = 0; i < ent.length; i++) {
    const t = i / FM;
    const fuerte = Math.floor(t * 4) % 2 === 0;
    ent[i] = (fuerte ? 2 : 0.1) * Math.sin(2 * Math.PI * 220 * t);
  }
  ent[FM + 777] = 3.5;
  const p = { ...BASE, comp: false, lim: true };
  const { sal, c } = pasar(ent, p);
  const techo = 10 ** (-1 / 20);
  ver('limitador: pico de salida (dB)', db(pico(sal)), -1, 0.05);
  const m = c.medidas();
  ver('limitador: muestras que hubo que recortar', m.recortes, 0, 0);
  console.log(`      (techo ${techo.toFixed(4)}, pico ${pico(sal).toFixed(4)}, reducción máxima ${m.l.toFixed(1)} dB)`);
}
// 6. Limitador con señal baja: sale igual, atrasada `atraso` muestras.
{
  const ent = tono(0.2, 440, 0.5);
  const { sal, c } = pasar(ent, { ...BASE, comp: false, lim: true });
  let dif = 0;
  for (let i = c.atraso; i < ent.length; i++) dif = Math.max(dif, Math.abs(sal[i] - ent[i - c.atraso]));
  ver(`limitador con señal baja: diferencia con la entrada atrasada ${c.atraso} muestras`, dif, 0, 1e-6);
}
// 7. Compresor + limitador, todo fuerte: no pasa del techo.
{
  const { sal } = pasar(tono(1.8, 60, 2), { ...BASE, ganancia: 18, lim: true, techo: -0.3 });
  ver('compresor + limitador: pico de salida (dB)', db(pico(sal)), -0.3, 0.05);
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
