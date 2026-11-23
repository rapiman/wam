// TRÉMOLO: el volumen sube y baja con un oscilador lento. Con las dos orejas desfasadas, el
// sonido se pasea de un lado al otro (paneo automático).
// El núcleo se basta solo: va al hilo de audio como texto y lo usan la carátula y la prueba.
export function nucleoTremolo() {
  const FORMAS = ['Seno', 'Triángulo', 'Cuadrada'];
  const PARAMS = [
    { id: 'prof', nombre: 'Profundidad', min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
    { id: 'vel', nombre: 'Velocidad', min: 0.1, max: 20, defecto: 5, unidad: 'Hz', log: true, paso: 0.01 },
    { id: 'forma', nombre: 'Forma', tipo: 'choice', opciones: FORMAS, defecto: 0, min: 0, max: 2 },
    { id: 'fase', nombre: 'Entre orejas', min: 0, max: 180, defecto: 0, unidad: '°', paso: 1 },
  ];
  // La onda del oscilador, entre 0 y 1, en un punto `x` de su vuelta (0…1).
  const onda = (forma, x) => {
    const u = x - Math.floor(x);
    if (forma === 1) return u < 0.5 ? u * 2 : 2 - u * 2;
    if (forma === 2) return u < 0.5 ? 1 : 0;
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
  };
  // Cuánto deja pasar (0…1) con esa profundidad en ese punto de la vuelta.
  const ganancia = (p, x) => 1 - (Math.min(100, Math.max(0, p.prof)) / 100) * (1 - onda(Math.round(p.forma), x));

  const crear = (fm) => {
    let vuelta = 0;
    let gI = 1;
    let gD = 1;
    // la cuadrada salta: se suaviza en 2 ms para que no haga clic
    const suave = Math.exp(-1 / (0.002 * fm));
    const procesar = (eI, eD, sI, sD, desde, hasta, p) => {
      const paso = p.vel / fm;
      const desfase = Math.min(180, Math.max(0, p.fase)) / 360;
      const s = Math.round(p.forma) === 2 ? suave : 0; // el seno y el triángulo no saltan
      for (let i = desde; i < hasta; i++) {
        gI = s * gI + (1 - s) * ganancia(p, vuelta);
        gD = s * gD + (1 - s) * ganancia(p, vuelta + desfase);
        vuelta += paso;
        if (vuelta >= 1) vuelta -= 1;
        sI[i] = eI[i] * gI;
        sD[i] = eD[i] * gD;
      }
    };
    return { procesar };
  };

  return { FORMAS, PARAMS, crear, onda, ganancia };
}
