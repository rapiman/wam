// LA CARÁTULA DE UN EFECTO SIMPLE (2026-11-23), armada desde la lista de parámetros de su núcleo:
// el título, un gráfico con los dos espectros («cómo está» y «cómo queda») y, abajo, un control
// por parámetro (perilla para los números, lista para las opciones, interruptor para los sí o no).
// Cada efecto puede dibujar encima lo suyo (`dibujar`: la curva del filtro, la onda del trémolo).
//
// Mismos controles y colores (`--pzw-*`) que el compresor y el ecualizador: `controles.js`.
import { v, coloresDe, numero, el, lienzo, perilla, interruptor, elegidor } from './controles.js';
import { espectros, ejeFrecuencias } from './espectros.js';
import { niveles } from './niveles.js';

// Cómo se escribe el valor de un parámetro.
export function textoDe(p, x) {
  if (p.unidad === 'Hz') return x < 1000 ? `${numero(x, x < 10 ? 2 : x < 100 ? 1 : 0)} Hz` : `${numero(x / 1000, x < 10000 ? 2 : 1)} kHz`;
  const dec = p.dec !== undefined ? p.dec : (p.paso || 1) < 1 ? 1 : 0;
  return `${numero(x, dec)}${p.unidad ? ` ${p.unidad}` : ''}`;
}

// opciones: { titulo, PARAMS, conEspectros?: true, conNiveles?: false, conFrecuencias?: true,
//             alto?: 150, dibujar?(g, cosas) }   cosas = { W, H, X, FX, V, C, fm, sonando }
// `conNiveles` cambia los espectros por la historia del volumen (antes y después en el tiempo);
// `sonando` le dice a `dibujar` si en ese gráfico hay sonido ahora.
export async function caratulaSimple(nodo, { titulo, PARAMS, conEspectros = true, conNiveles = false, conFrecuencias = true, alto = 150, dibujar = null }) {
  const fm = nodo.context.sampleRate;
  const leidos = await nodo.getParameterValues(false);
  const V = {};
  for (const p of PARAMS) V[p.id] = leidos && leidos[p.id] ? Number(leidos[p.id].value) : p.defecto;
  const mandar = (id, value) => {
    V[id] = value;
    void nodo.setParameterValues({ [id]: { id, value, normalized: false } });
  };

  const caja = el(
    'div',
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;` +
      `background:${v('fondo')};color:${v('tinta')};border:1px solid ${v('borde')};` +
      `font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`,
  );
  const cabecera = el('div', `display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid ${v('borde')};`);
  cabecera.append(el('span', 'font-weight:bold;font-size:13px;', titulo));

  const grafico = lienzo(536, alto);
  const marco = el('div', 'padding:10px 10px 6px;');
  marco.append(grafico.c);
  const W = grafico.ancho;
  const H = grafico.alto;
  const { X, FX } = ejeFrecuencias(W);

  // --- un control por parámetro
  const columnas = Math.min(7, Math.max(4, PARAMS.length));
  const fila = el('div', `display:grid;grid-template-columns:repeat(${columnas},minmax(0,1fr));gap:6px 4px;padding:4px 10px 10px;align-items:start;`);
  const controles = {};
  for (const p of PARAMS) {
    if (p.tipo === 'choice') {
      const c = elegidor({ nombre: p.nombre, opciones: p.opciones, alCambiar: (i) => mandar(p.id, i) });
      c.poner(Math.round(V[p.id]));
      const celda = el('div', 'display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;');
      celda.append(el('div', `color:${v('tinta2')};font-size:11px;white-space:nowrap;`, p.nombre), c.el);
      controles[p.id] = { ...c, el: celda, poner: (x) => c.poner(Math.round(x)) };
    } else if (p.tipo === 'boolean') {
      const c = interruptor({ nombre: p.nombre, porDefecto: V[p.id] >= 0.5, alCambiar: (si) => mandar(p.id, si ? 1 : 0) });
      controles[p.id] = { ...c, poner: (x) => c.poner(x >= 0.5) };
    } else {
      const c = perilla({ nombre: p.nombre, min: p.min, max: p.max, paso: p.paso || 1, log: !!p.log, porDefecto: p.defecto, formato: (x) => textoDe(p, x), alCambiar: (x) => mandar(p.id, x) });
      c.poner(V[p.id]);
      controles[p.id] = c;
    }
    fila.append(controles[p.id].el);
  }
  caja.append(cabecera, marco, fila);

  const esp = conNiveles ? niveles(nodo) : conEspectros ? espectros(nodo) : null;
  let C = coloresDe(caja);
  let cuadros = 0;
  const pintarGrafico = () => {
    const g = grafico.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, W, H);
    g.lineWidth = 1;
    if (conFrecuencias) {
      g.font = '11px system-ui, sans-serif';
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        const x = Math.round(X(f)) + 0.5;
        g.strokeStyle = C.traza;
        g.globalAlpha = f === 100 || f === 1000 || f === 10000 ? 0.9 : 0.45;
        g.beginPath();
        g.moveTo(x, 1);
        g.lineTo(x, H - 1);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = C.tinta2;
      for (const [f, t] of [[100, '100'], [1000, '1 k'], [10000, '10 k']]) g.fillText(t, X(f) + 3, H - 4);
    }
    const sonando = esp ? !!esp.dibujar(g, W, H, C, FX) : false;
    if (dibujar) dibujar(g, { W, H, X, FX, V, C, fm, sonando });
    g.strokeStyle = C.borde;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  };

  let cuadro = 0;
  let reloj = 0;
  let visto = false;
  const soltar = () => {
    if (!cuadro && !reloj) return;
    cancelAnimationFrame(cuadro);
    clearInterval(reloj);
    cuadro = 0;
    reloj = 0;
    if (esp) esp.soltar();
  };
  const pintar = () => {
    // si sacaron la carátula de la página sin avisar, se deja de dibujar
    if (caja.isConnected) visto = true;
    else if (visto) return soltar();
    if (cuadros++ % 60 === 0) C = coloresDe(caja);
    pintarGrafico();
    cuadro = requestAnimationFrame(pintar);
  };
  // Si los parámetros cambian por otro lado (el anfitrión pone un estado, una automatización),
  // los controles se ponen al día, salvo el que se está moviendo.
  reloj = setInterval(() => {
    if (esp) esp.recolgar();
    nodo.getParameterValues(false).then((vals) => {
      if (!vals || !reloj) return;
      for (const p of PARAMS) {
        if (!vals[p.id] || controles[p.id].agarrada()) continue;
        const x = Number(vals[p.id].value);
        if (Math.abs(x - V[p.id]) < 1e-4) continue;
        V[p.id] = x;
        controles[p.id].poner(x);
      }
    });
  }, 500);

  cuadro = requestAnimationFrame(pintar);
  caja._pzSoltar = soltar;
  return caja;
}
