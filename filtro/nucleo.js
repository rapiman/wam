// FILTRO: pasa bajos, pasa altos, pasa banda o muesca, de 12 o 24 dB por octava, con resonancia
// y un vaivén (un oscilador lento que mueve la frecuencia, en octavas hacia arriba y abajo).
// El núcleo se basta solo: va al hilo de audio como texto y lo usan la carátula y la prueba.
export function nucleoFiltro() {
  const TIPOS = ['Pasa bajos', 'Pasa altos', 'Pasa banda', 'Muesca'];
  const PARAMS = [
    { id: 'tipo', nombre: 'Tipo', tipo: 'choice', opciones: TIPOS, defecto: 0, min: 0, max: 3 },
    { id: 'frec', nombre: 'Frecuencia', min: 20, max: 20000, defecto: 1000, unidad: 'Hz', log: true, paso: 1 },
    { id: 'res', nombre: 'Resonancia', min: 0.5, max: 20, defecto: 0.71, log: true, paso: 0.01, dec: 2 },
    { id: 'pend', nombre: 'Pendiente', tipo: 'choice', opciones: ['12 dB/oct', '24 dB/oct'], defecto: 0, min: 0, max: 1 },
    { id: 'vel', nombre: 'Velocidad', min: 0.05, max: 20, defecto: 1, unidad: 'Hz', log: true, paso: 0.01 },
    { id: 'prof', nombre: 'Vaivén', min: 0, max: 4, defecto: 0, unidad: 'oct', paso: 0.05, dec: 2 },
    { id: 'mezcla', nombre: 'Mezcla', min: 0, max: 100, defecto: 100, unidad: '%', paso: 1 },
  ];

  // Coeficientes de un filtro de segundo orden («Audio EQ Cookbook»): deja en c [b0,b1,b2,a1,a2].
  const coefs = (c, tipo, frec, q, fm) => {
    const f = Math.min(0.49 * fm, Math.max(10, frec));
    const w = (2 * Math.PI * f) / fm;
    const cs = Math.cos(w);
    const alfa = Math.sin(w) / (2 * Math.max(0.05, q));
    const a0 = 1 + alfa;
    let b0;
    let b1;
    let b2;
    if (tipo === 0) {
      b0 = (1 - cs) / 2;
      b1 = 1 - cs;
      b2 = b0;
    } else if (tipo === 1) {
      b0 = (1 + cs) / 2;
      b1 = -(1 + cs);
      b2 = b0;
    } else if (tipo === 2) {
      b0 = alfa;
      b1 = 0;
      b2 = -alfa;
    } else {
      b0 = 1;
      b1 = -2 * cs;
      b2 = 1;
    }
    c[0] = b0 / a0;
    c[1] = b1 / a0;
    c[2] = b2 / a0;
    c[3] = (-2 * cs) / a0;
    c[4] = (1 - alfa) / a0;
    return c;
  };
  const magnitud = (c, frec, fm) => {
    const w = (2 * Math.PI * frec) / fm;
    const c1 = Math.cos(w);
    const c2 = Math.cos(2 * w);
    const num = c[0] * c[0] + c[1] * c[1] + c[2] * c[2] + 2 * (c[0] * c[1] + c[1] * c[2]) * c1 + 2 * c[0] * c[2] * c2;
    const den = 1 + c[3] * c[3] + c[4] * c[4] + 2 * (c[3] + c[3] * c[4]) * c1 + 2 * c[4] * c2;
    return 10 * Math.log10(Math.max(1e-12, num / Math.max(1e-12, den)));
  };
  // Con 24 dB/oct son dos filtros en serie. En los pasa bajos y pasa altos se reparten la
  // resonancia como un Butterworth (plano con 0,71); en los otros, los dos llevan la misma.
  const etapas = (pend) => (pend >= 0.5 ? 2 : 1);
  const qEtapa = (tipo, q, k, n) => {
    if (n === 1 || tipo >= 2) return q;
    return k === 0 ? 0.5412 : 1.3066 * (q / Math.SQRT1_2);
  };
  // Cuántos dB deja pasar el filtro (sin mezcla ni vaivén) a la frecuencia `f`.
  const respuesta = (p, f, fm) => {
    const tipo = Math.round(p.tipo);
    const n = etapas(p.pend);
    const c = new Float64Array(5);
    let db = 0;
    for (let k = 0; k < n; k++) db += magnitud(coefs(c, tipo, p.frec, qEtapa(tipo, p.res, k, n), fm), f, fm);
    return db;
  };

  const crear = (fm) => {
    const c = [new Float64Array(5), new Float64Array(5)];
    const z = new Float64Array(8); // por etapa: dos de la izquierda y dos de la derecha
    let fase = 0;
    let falta = 0; // muestras hasta volver a calcular los coeficientes
    let pTipo = -1;
    let pFrec = 0;
    let pRes = 0;
    let pN = 0;

    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const tipo = Math.round(p.tipo);
      const n = etapas(p.pend);
      const m = Math.min(1, Math.max(0, p.mezcla / 100));
      const paso = (2 * Math.PI * p.vel) / fm;
      if (tipo !== pTipo || p.frec !== pFrec || p.res !== pRes || n !== pN) {
        pTipo = tipo;
        pFrec = p.frec;
        pRes = p.res;
        pN = n;
        falta = 0;
      }
      for (let i = desde; i < hasta; i++) {
        if (falta <= 0) {
          // con vaivén se recalcula cada 16 muestras; sin vaivén, solo cuando cambia algo
          const f = p.prof > 0 ? p.frec * 2 ** (p.prof * Math.sin(fase)) : p.frec;
          for (let k = 0; k < n; k++) coefs(c[k], tipo, f, qEtapa(tipo, p.res, k, n), fm);
          falta = p.prof > 0 ? 16 : 1e9;
        }
        falta -= 1;
        fase += paso;
        if (fase > 6.283185307179586) fase -= 6.283185307179586;
        let l = eI[i];
        let r = eD[i];
        for (let k = 0; k < n; k++) {
          const ck = c[k];
          const j = k * 4;
          const yl = ck[0] * l + z[j];
          z[j] = ck[1] * l - ck[3] * yl + z[j + 1];
          z[j + 1] = ck[2] * l - ck[4] * yl;
          l = yl;
          const yr = ck[0] * r + z[j + 2];
          z[j + 2] = ck[1] * r - ck[3] * yr + z[j + 3];
          z[j + 3] = ck[2] * r - ck[4] * yr;
          r = yr;
        }
        sI[i] = eI[i] * (1 - m) + l * m;
        sD[i] = eD[i] * (1 - m) + r * m;
      }
      for (let j = 0; j < 8; j++) if (z[j] > -1e-20 && z[j] < 1e-20) z[j] = 0;
    };
    return { procesar };
  };

  return { TIPOS, PARAMS, crear, respuesta };
}
