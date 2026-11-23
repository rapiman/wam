// REVERB — lo que corre en el hilo de audio. La reverberación misma (la convolución con la
// respuesta de un espacio) la hace el navegador, fuera de acá: este núcleo reparte el sonido en
// dos caminos. Por la salida 0 va el sonido seco, bajado según la mezcla; por la salida 2, lo que
// se manda al espacio: el mismo sonido, atrasado («antes»: el rato que tarda en llegar el primer
// rebote), con los agudos quitados según el brillo y subido según la mezcla.
// El núcleo se basta solo: va al hilo de audio como texto y lo usan la carátula y la prueba.
export function nucleoReverb() {
  const ESPACIOS = ['Cuarto', 'Sala', 'Salón', 'Iglesia', 'Placa', 'Túnel'];
  const PARAMS = [
    { id: 'espacio', nombre: 'Espacio', tipo: 'choice', opciones: ESPACIOS, defecto: 1, min: 0, max: ESPACIOS.length - 1 },
    { id: 'largo', nombre: 'Largo', min: 20, max: 100, defecto: 100, unidad: '%', paso: 1 },
    { id: 'antes', nombre: 'Antes', min: 0, max: 200, defecto: 10, unidad: 'ms', paso: 1 },
    { id: 'brillo', nombre: 'Brillo', min: 500, max: 20000, defecto: 12000, unidad: 'Hz', log: true, paso: 1 },
    { id: 'mezcla', nombre: 'Mezcla', min: 0, max: 100, defecto: 30, unidad: '%', paso: 1 },
  ];

  const crear = (fm) => {
    let largo = 1;
    while (largo < 0.21 * fm) largo *= 2;
    const mascara = largo - 1;
    const lI = new Float32Array(largo);
    const lD = new Float32Array(largo);
    let w = 0;
    let fI = 0; // el filtro de los agudos, por oreja
    let fD = 0;

    const procesar = (eI, eD, sI, sD, desde, hasta, p, salidas) => {
      const m = Math.min(1, Math.max(0, p.mezcla / 100));
      const d = Math.min(largo - 2, Math.max(0, Math.round((p.antes / 1000) * fm)));
      // sobre 18 kHz el brillo no quita nada
      const k = p.brillo >= 18000 ? 1 : 1 - Math.exp((-2 * Math.PI * Math.max(100, p.brillo)) / fm);
      const envio = salidas && salidas[2];
      const vI = envio && envio[0];
      const vD = envio && (envio[1] || envio[0]);
      for (let i = desde; i < hasta; i++) {
        const l = eI[i];
        const r = eD[i];
        lI[w] = l;
        lD[w] = r;
        const j = (w - d) & mascara;
        fI += k * (lI[j] - fI);
        fD += k * (lD[j] - fD);
        w = (w + 1) & mascara;
        sI[i] = l * (1 - m);
        sD[i] = r * (1 - m);
        if (vI) {
          vI[i] = fI * m;
          vD[i] = fD * m;
        }
      }
      if (fI > -1e-20 && fI < 1e-20) fI = 0;
      if (fD > -1e-20 && fD < 1e-20) fD = 0;
    };
    return { procesar };
  };

  return { ESPACIOS, PARAMS, crear };
}
