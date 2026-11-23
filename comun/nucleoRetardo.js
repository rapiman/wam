// RETARDO CON VAIVÉN: el corazón del chorus y del flanger. El sonido se suma con una copia suya
// atrasada, y ese atraso sube y baja con un oscilador lento. Con atrasos largos (10–30 ms) suena
// a varias voces (chorus); con atrasos cortos (1–10 ms) y realimentación, a barrido metálico
// (flanger). `cfg` dice los rangos de cada uno: { retardo, prof, vel: [mín, máx, por defecto],
// realim?: por defecto (si no viene, no hay realimentación), ancho: por defecto }.
// El núcleo se basta solo: va al hilo de audio como texto y lo usan la carátula y la prueba.
export function nucleoRetardo(cfg) {
  const PARAMS = [
    { id: 'retardo', nombre: 'Retardo', min: cfg.retardo[0], max: cfg.retardo[1], defecto: cfg.retardo[2], unidad: 'ms', paso: 0.1, dec: 1 },
    { id: 'prof', nombre: 'Vaivén', min: cfg.prof[0], max: cfg.prof[1], defecto: cfg.prof[2], unidad: 'ms', paso: 0.05, dec: 2 },
    { id: 'vel', nombre: 'Velocidad', min: cfg.vel[0], max: cfg.vel[1], defecto: cfg.vel[2], unidad: 'Hz', log: true, paso: 0.01 },
  ];
  if (cfg.realim !== undefined) PARAMS.push({ id: 'realim', nombre: 'Realimentación', min: -95, max: 95, defecto: cfg.realim, unidad: '%', paso: 1 });
  PARAMS.push(
    { id: 'ancho', nombre: 'Ancho', min: 0, max: 100, defecto: cfg.ancho, unidad: '%', paso: 1 },
    { id: 'mezcla', nombre: 'Mezcla', min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
  );

  const crear = (fm) => {
    // una línea de atraso por oreja, con lugar para el atraso más largo y su vaivén
    let largo = 1;
    const hace = Math.ceil(((cfg.retardo[1] + cfg.prof[1]) / 1000) * fm) + 8;
    while (largo < hace) largo *= 2;
    const mascara = largo - 1;
    const lI = new Float32Array(largo);
    const lD = new Float32Array(largo);
    let w = 0;
    let fase = 0;

    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const m = Math.min(1, Math.max(0, p.mezcla / 100));
      const fb = p.realim !== undefined ? Math.min(0.95, Math.max(-0.95, p.realim / 100)) : 0;
      const base = (p.retardo / 1000) * fm;
      const prof = (p.prof / 1000) * fm;
      const paso = (2 * Math.PI * p.vel) / fm;
      // «ancho»: cuánto se desfasa el vaivén entre las orejas (100 % = un cuarto de vuelta)
      const desfase = (Math.min(100, Math.max(0, p.ancho)) / 100) * (Math.PI / 2);
      for (let i = desde; i < hasta; i++) {
        const dI = Math.max(1, base + prof * Math.sin(fase));
        const dD = Math.max(1, base + prof * Math.sin(fase + desfase));
        fase += paso;
        if (fase > 6.283185307179586) fase -= 6.283185307179586;
        // se lee entre dos muestras (el atraso casi nunca cae justo en una)
        let pos = w - dI;
        let k = Math.floor(pos);
        let f = pos - k;
        const aI = lI[k & mascara] * (1 - f) + lI[(k + 1) & mascara] * f;
        pos = w - dD;
        k = Math.floor(pos);
        f = pos - k;
        const aD = lD[k & mascara] * (1 - f) + lD[(k + 1) & mascara] * f;
        const l = eI[i];
        const r = eD[i];
        lI[w] = l + fb * aI;
        lD[w] = r + fb * aD;
        w = (w + 1) & mascara;
        sI[i] = l * (1 - m) + aI * m;
        sD[i] = r * (1 - m) + aD * m;
      }
    };
    return { procesar };
  };

  return { PARAMS, crear };
}

export const CHORUS = { retardo: [5, 30, 15], prof: [0, 10, 3], vel: [0.02, 5, 0.6], ancho: 100 };
export const FLANGER = { retardo: [0.5, 10, 2], prof: [0, 5, 1.5], vel: [0.02, 5, 0.25], realim: 50, ancho: 50 };
