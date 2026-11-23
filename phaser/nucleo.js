// PHASER: una cadena de filtros «pasa todo» (no cambian el volumen de ninguna frecuencia, solo la
// atrasan distinto) cuya frecuencia sube y baja con un oscilador lento. Sumada con el sonido
// original, unas frecuencias se cancelan y esas muescas se pasean: el barrido del phaser.
// El núcleo se basta solo: va al hilo de audio como texto y lo usan la carátula y la prueba.
export function nucleoPhaser() {
  const ETAPAS = [4, 6, 8, 12];
  const PARAMS = [
    { id: 'frec', nombre: 'Centro', min: 100, max: 5000, defecto: 800, unidad: 'Hz', log: true, paso: 1 },
    { id: 'prof', nombre: 'Vaivén', min: 0, max: 3, defecto: 1.5, unidad: 'oct', paso: 0.05, dec: 2 },
    { id: 'vel', nombre: 'Velocidad', min: 0.02, max: 10, defecto: 0.5, unidad: 'Hz', log: true, paso: 0.01 },
    { id: 'realim', nombre: 'Realimentación', min: -95, max: 95, defecto: 30, unidad: '%', paso: 1 },
    { id: 'etapas', nombre: 'Etapas', tipo: 'choice', opciones: ETAPAS.map(String), defecto: 1, min: 0, max: 3 },
    { id: 'ancho', nombre: 'Ancho', min: 0, max: 100, defecto: 30, unidad: '%', paso: 1 },
    { id: 'mezcla', nombre: 'Mezcla', min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
  ];

  const crear = (fm) => {
    const MAX = 12;
    const x1 = new Float64Array(MAX * 2); // por etapa: izquierda y derecha
    const y1 = new Float64Array(MAX * 2);
    let ultI = 0;
    let ultD = 0;
    let fase = 0;
    let falta = 0;
    let aI = 0;
    let aD = 0;
    const coef = (f) => {
      const t = Math.tan((Math.PI * Math.min(0.45 * fm, Math.max(20, f))) / fm);
      return (t - 1) / (t + 1);
    };

    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const n = ETAPAS[Math.min(3, Math.max(0, Math.round(p.etapas)))];
      const m = Math.min(1, Math.max(0, p.mezcla / 100));
      const fb = Math.min(0.95, Math.max(-0.95, p.realim / 100));
      const paso = (2 * Math.PI * p.vel) / fm;
      const desfase = (Math.min(100, Math.max(0, p.ancho)) / 100) * Math.PI;
      for (let i = desde; i < hasta; i++) {
        if (falta <= 0) {
          aI = coef(p.frec * 2 ** (p.prof * Math.sin(fase)));
          aD = coef(p.frec * 2 ** (p.prof * Math.sin(fase + desfase)));
          falta = 8;
        }
        falta -= 1;
        fase += paso;
        if (fase > 6.283185307179586) fase -= 6.283185307179586;
        let l = eI[i] + fb * ultI;
        let r = eD[i] + fb * ultD;
        for (let k = 0; k < n; k++) {
          const j = k * 2;
          const yl = aI * l + x1[j] - aI * y1[j];
          x1[j] = l;
          y1[j] = yl;
          l = yl;
          const yr = aD * r + x1[j + 1] - aD * y1[j + 1];
          x1[j + 1] = r;
          y1[j + 1] = yr;
          r = yr;
        }
        ultI = l > -1e-20 && l < 1e-20 ? 0 : l;
        ultD = r > -1e-20 && r < 1e-20 ? 0 : r;
        sI[i] = eI[i] * (1 - m) + l * m;
        sD[i] = eD[i] * (1 - m) + r * m;
      }
    };
    return { procesar };
  };

  return { ETAPAS, PARAMS, crear };
}
