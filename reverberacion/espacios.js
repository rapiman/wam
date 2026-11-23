// LOS ESPACIOS DE LA REVERB, GENERADOS: la respuesta de cada uno (lo que se oiría después de un
// golpe seco) se calcula acá, no viene de una grabación. Es ruido que se apaga: unos primeros
// rebotes sueltos y después una cola pareja que pierde primero los agudos, como en un lugar de
// verdad. Con la misma semilla sale siempre igual. No son espacios medidos: son aproximaciones
// que no pesan nada ni dependen de archivos; los espacios grabados (libres) se suman aparte.
//
// Cada espacio: cuánto tarda en apagarse 60 dB (`segundos`), con qué brillo parte la cola y hasta
// dónde se oscurece (`agudos`, `oscurece`), cuánto pesan los primeros rebotes y cuán separados
// vienen (`rebotes`, `tamano` en ms) y cuán pronto se vuelve densa (`densa` en ms).
export const ESPACIOS = [
  { nombre: 'Cuarto', segundos: 0.4, agudos: 9000, oscurece: 0.5, rebotes: 0.9, tamano: 9, densa: 15 },
  { nombre: 'Sala', segundos: 1.0, agudos: 9000, oscurece: 0.45, rebotes: 0.7, tamano: 19, densa: 35 },
  { nombre: 'Salón', segundos: 2.2, agudos: 8000, oscurece: 0.35, rebotes: 0.5, tamano: 34, densa: 70 },
  { nombre: 'Iglesia', segundos: 4.5, agudos: 6000, oscurece: 0.25, rebotes: 0.35, tamano: 55, densa: 120 },
  { nombre: 'Placa', segundos: 1.8, agudos: 16000, oscurece: 0.7, rebotes: 0, tamano: 0, densa: 3 },
  { nombre: 'Túnel', segundos: 3.0, agudos: 3500, oscurece: 0.3, rebotes: 0.6, tamano: 42, densa: 90 },
];

// Números al azar que salen siempre iguales para la misma semilla.
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// La respuesta del espacio número `cual` a `fm` muestras por segundo, con la cola acortada a
// `largo` por ciento. Devuelve las dos orejas: { izq, der } (Float32Array).
export function generarEspacio(fm, cual, largo = 100) {
  const e = ESPACIOS[Math.min(ESPACIOS.length - 1, Math.max(0, Math.round(cual)))];
  const rt = e.segundos * Math.min(1, Math.max(0.2, largo / 100));
  const n = Math.ceil(fm * (rt * 1.15 + 0.05));
  const orejas = [new Float32Array(n), new Float32Array(n)];
  const cae = Math.log(1000) / (rt * fm); // 60 dB en `rt` segundos
  const densa = Math.max(1, (e.densa / 1000) * fm);
  orejas.forEach((x, oreja) => {
    const r = azar(1234 + Math.round(cual) * 97 + oreja * 7919);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      // la cola: ruido que entra de a poco, se apaga y se va oscureciendo
      const t = i / n;
      const corte = e.agudos * (1 - (1 - e.oscurece) * t);
      const k = 1 - Math.exp((-2 * Math.PI * corte) / fm);
      lp += k * (r() * 2 - 1 - lp);
      const entra = i < densa ? i / densa : 1;
      x[i] = lp * entra * Math.exp(-cae * i);
    }
    // los primeros rebotes: unos golpes sueltos, cada vez más débiles, distintos en cada oreja
    if (e.rebotes > 0) {
      let en = (e.tamano / 1000) * fm * (0.6 + 0.4 * r());
      let fuerza = e.rebotes;
      for (let k = 0; k < 8 && en < n; k++) {
        x[Math.floor(en)] += (r() < 0.5 ? -1 : 1) * fuerza * 0.5;
        en += (e.tamano / 1000) * fm * (0.5 + r());
        fuerza *= 0.72;
      }
    }
    // el final se lleva a cero para que no corte de golpe
    const fin = Math.min(n, Math.round(0.05 * fm));
    for (let i = 0; i < fin; i++) x[n - 1 - i] *= i / fin;
  });
  return { izq: orejas[0], der: orejas[1] };
}
