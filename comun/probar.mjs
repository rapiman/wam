// Lo común de las pruebas de los núcleos (Node, sin navegador): pasar sonido por un efecto de a
// 128 muestras, como el hilo de audio, y medir lo que sale.
export const FM = 48000;
export const db = (x) => 20 * Math.log10(x + 1e-12);
export const tono = (amp, hz, seg) => Float32Array.from({ length: Math.round(seg * FM) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / FM));

// Los valores por defecto de los parámetros de un núcleo, con lo que se le cambie.
export const porDefecto = (N, cambios = {}) => ({ ...Object.fromEntries(N.PARAMS.map((p) => [p.id, p.defecto])), ...cambios });

// Pasa `entI`/`entD` por un efecto nuevo de ese núcleo. Devuelve las dos orejas.
export function pasar(N, p, entI, entD = entI) {
  const efecto = N.crear(FM);
  const sI = new Float32Array(entI.length);
  const sD = new Float32Array(entI.length);
  for (let i = 0; i < entI.length; i += 128) efecto.procesar(entI, entD, sI, sD, i, Math.min(entI.length, i + 128), p);
  return { sI, sD };
}
// El nivel (como pico de un tono: raíz de dos veces la energía media) de la segunda mitad.
export function nivel(a) {
  let e = 0;
  const desde = Math.floor(a.length / 2);
  for (let i = desde; i < a.length; i++) e += a[i] * a[i];
  return Math.sqrt((2 * e) / (a.length - desde));
}
export const pico = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
export const diferencia = (a, b, corrido = 0) => {
  let d = 0;
  for (let i = corrido; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i - corrido]));
  return d;
};

export function anotador() {
  let fallas = 0;
  const linea = (bien, texto) => {
    if (!bien) fallas++;
    console.log(`${bien ? 'bien ' : 'MAL  '} ${texto}`);
  };
  return {
    ver: (nombre, valor, esperado, margen) => linea(Math.abs(valor - esperado) <= margen, `${nombre}: ${valor.toFixed(3)} (se espera ${esperado} ± ${margen})`),
    menorQue: (nombre, valor, tope) => linea(valor < tope, `${nombre}: ${valor.toFixed(3)} (se espera menos de ${tope})`),
    mayorQue: (nombre, valor, piso) => linea(valor > piso, `${nombre}: ${valor.toFixed(3)} (se espera más de ${piso})`),
    cerrar: () => {
      console.log(fallas ? `\n${fallas} FALLA(S)` : '\ntodo bien');
      process.exit(fallas ? 1 : 0);
    },
  };
}
