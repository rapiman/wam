// MOLDEAR UNA CAPA, COMO EN EL KORG M1 (2026-11-25, JP: «copiarle los VDA, VDF, envelope… me
// refiero al gráfico», «todo, que quede bien complejo»). Tres hojas —Volumen, Filtro, Altura, cada
// una en su carpeta de la carátula (`ponerHoja`)— con su envolvente DIBUJADA (los puntos se arrastran: a los lados cambia el tiempo de ese tramo,
// arriba y abajo su nivel) y, debajo, las perillas de lo mismo con los números, lo de la capa, lo
// que hace la intensidad de la nota y lo que hace la tecla (+ alarga, x nada, − acorta cada tiempo).
//
// Todo son parámetros del plugin (`c1…`, `c2…`, `c3…`): se automatizan y se guardan con él.
import { v, numero, el, lienzo, perilla, elegidor } from '../comun/controles.js';
import { t } from '../comun/idiomas.js';

const W = 536;
const H = 130;
const MESETA = 64; // el ancho del sostenido en el dibujo
const X0 = 8;
// El ancho de un tramo en el dibujo según su tiempo (escala logarítmica, de 0,5 ms a 10 s).
const anchoDe = (ms) => 4 + (106 * Math.log10(1 + Math.max(0, ms))) / 4;
const tiempoDe = (ancho) => Math.max(0.5, Math.min(10000, Math.pow(10, ((Math.max(4, ancho) - 4) * 4) / 106) - 1));

// Los puntos de cada envolvente: `t` el parámetro del tiempo del tramo que termina ahí, `l` el del
// nivel (o `fijo`). `meseta`: antes de este punto va el sostenido.
const PUNTOS = {
  vol: [{ fijo: 0 }, { t: 'vat', l: 'val' }, { t: 'vdt', l: 'vbp' }, { t: 'vst', l: 'vsl' }, { t: 'vrt', fijo: 0, meseta: true }],
  fil: [{ l: 'fl0' }, { t: 'fat', l: 'fal' }, { t: 'fdt', l: 'fbp' }, { t: 'fst', l: 'fsl' }, { t: 'frt', l: 'frl', meseta: true }],
  alt: [{ l: 'pl0' }, { t: 'pat', l: 'pal' }, { t: 'pdt', fijo: 0 }, { t: 'prt', l: 'prl', meseta: true }],
};
const BIPOLAR = { vol: false, fil: true, alt: true };
const ROTULOS = { vat: 'A', vdt: 'D', vst: 'S', vrt: 'R', fat: 'A', fdt: 'D', fst: 'S', frt: 'R', pat: 'A', pdt: 'D', prt: 'R' };
const FILAS = [
  ['capa', ''],
  ['env', ''],
  ['vel', 'Intensidad de la nota'],
  ['tec', 'Tecla'],
];

export function crearMoldeado(nodo, N, colores) {
  let capa = 1;
  let hoja = 'vol';
  const valores = {};
  for (const p of N.PARAMS) valores[p.id] = p.defecto;
  const controles = {}; // id corto → control de la hoja de ahora
  let tomado = -1;

  const caja = el('div', 'padding:6px 10px 8px;');
  const dibujo = lienzo(W, H);
  dibujo.c.style.cursor = 'grab';
  const cuerpo = el('div', '');
  caja.append(dibujo.c, cuerpo);
  // grupos de controles de la capa puestos en otras carpetas (Fácil, Fuente): `crearGrupo`
  const extras = [];

  const id = (corto) => `c${capa}${corto}`;
  const leer = (corto) => Number(valores[id(corto)]);
  const mandar = (corto, x) => {
    valores[id(corto)] = x;
    void nodo.setParameterValues({ [id(corto)]: { id: id(corto), value: x, normalized: false } });
  };
  const paramDe = (corto) => N.PARAMS.find((p) => p.id === `c1${corto}`);
  const textoDe = (p, x) => `${numero(x, p.dec !== undefined ? p.dec : 0)}${p.unidad ? ` ${p.unidad}` : ''}`;

  // Un control para un parámetro de la capa (el corto, sin `cN`), anotado en `mapa`.
  const control = (p, mapa) => {
    const corto = p.id.slice(2);
    const nombre = t(p.corto || p.nombre.replace(/^Capa \d+: /, ''));
    if (p.tipo === 'choice') {
      const c = elegidor({ nombre, opciones: p.opciones.map((x) => t(x)), alCambiar: (i) => mandar(corto, i) });
      const celda = el('div', `display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;${p.angosto ? '' : 'grid-column:span 2;'}`);
      celda.append(el('div', `color:${v('tinta2')};font-size:11px;white-space:nowrap;`, nombre), c.el);
      mapa[corto] = { ...c, poner: (x) => c.poner(Math.round(x)) };
      return celda;
    }
    const c = perilla({
      nombre,
      min: p.min,
      max: p.max,
      paso: p.paso || 1,
      log: !!p.log,
      porDefecto: p.defecto,
      formato: (x) => textoDe(p, x),
      alCambiar: (x) => {
        mandar(corto, x);
        pintar();
      },
    });
    mapa[corto] = c;
    return c.el;
  };

  // --- los controles de la hoja: por filas (lo de la capa, la envolvente, la intensidad, la tecla).
  // En Volumen, lo de la capa (nivel, afinación, retardo) va en la carpeta Fuente.
  const armar = () => {
    cuerpo.textContent = '';
    for (const k of Object.keys(controles)) delete controles[k];
    const ps = N.PARAMS.filter((p) => p.grupo === `c1${hoja}`);
    for (const [sub, rotulo] of FILAS) {
      const deFila = ps.filter((p) => p.sub === sub && !(hoja === 'vol' && sub === 'capa'));
      if (!deFila.length) continue;
      const fila = el('div', 'display:flex;align-items:flex-start;gap:6px;margin-top:6px;');
      if (rotulo) fila.append(el('div', `width:70px;flex:none;color:${v('tinta2')};font-size:11px;padding-top:14px;`, t(rotulo)));
      const lugares = deFila.reduce((n, p) => n + (p.tipo === 'choice' && !p.angosto ? 2 : 1), 0);
      const grilla = el('div', `flex:1;display:grid;grid-template-columns:repeat(${Math.max(lugares, rotulo ? 6 : 7)},minmax(0,1fr));gap:4px;align-items:start;`);
      for (const p of deFila) grilla.append(control(p, controles));
      fila.append(grilla);
      cuerpo.append(fila);
    }
    refrescar();
  };
  const refrescar = () => {
    for (const mapa of [controles, ...extras]) for (const [corto, c] of Object.entries(mapa)) if (!c.agarrada()) c.poner(leer(corto));
    pintar();
  };

  // --- el dibujo
  const yDe = (nivel) => {
    const bip = BIPOLAR[hoja];
    const arriba = 10;
    const abajo = H - 14;
    return bip ? arriba + ((1 - nivel) / 2) * (abajo - arriba) : abajo - nivel * (abajo - arriba);
  };
  const nivelDe = (y) => {
    const bip = BIPOLAR[hoja];
    const arriba = 10;
    const abajo = H - 14;
    const r = (y - arriba) / (abajo - arriba);
    return Math.max(bip ? -1 : 0, Math.min(1, bip ? 1 - 2 * r : 1 - r));
  };
  // dónde cae cada punto
  const posiciones = () => {
    const out = [];
    let x = X0;
    for (const pt of PUNTOS[hoja]) {
      if (pt.meseta) x += MESETA;
      if (pt.t) x += anchoDe(leer(pt.t));
      const nivel = pt.l ? leer(pt.l) / 100 : pt.fijo;
      out.push({ x, y: yDe(nivel), pt });
    }
    return out;
  };
  const pintar = () => {
    const C = colores();
    const g = dibujo.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = C.borde;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    // la línea del cero
    g.strokeStyle = C.borde;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(0, Math.round(yDe(0)) + 0.5);
    g.lineTo(W, Math.round(yDe(0)) + 0.5);
    g.stroke();
    g.setLineDash([]);
    const ps = posiciones();
    // el sostenido, sombreado
    const im = PUNTOS[hoja].findIndex((p) => p.meseta);
    if (im > 0) {
      g.fillStyle = C.acento;
      g.globalAlpha = 0.12;
      g.fillRect(ps[im - 1].x, 1, MESETA, H - 2);
      g.globalAlpha = 1;
    }
    // la curva
    g.strokeStyle = C.acento;
    g.lineWidth = 2;
    g.beginPath();
    ps.forEach((q, i) => {
      if (i === 0) g.moveTo(q.x, q.y);
      else {
        if (q.pt.meseta) g.lineTo(ps[i - 1].x + MESETA, ps[i - 1].y);
        g.lineTo(q.x, q.y);
      }
    });
    g.stroke();
    g.lineWidth = 1;
    // los puntos y los rótulos de los tramos
    g.font = '10px system-ui, sans-serif';
    g.textAlign = 'center';
    ps.forEach((q, i) => {
      const movible = !!(q.pt.t || q.pt.l);
      g.fillStyle = i === tomado ? C.tinta : movible ? C.fondo : C.borde;
      g.strokeStyle = C.tinta;
      g.beginPath();
      g.arc(q.x, q.y, movible ? 5 : 3, 0, 2 * Math.PI);
      g.fill();
      g.stroke();
      if (q.pt.t) {
        const xa = q.pt.meseta ? ps[i - 1].x + MESETA : ps[i - 1].x;
        g.fillStyle = C.tinta2;
        g.fillText(ROTULOS[q.pt.t] || '', (xa + q.x) / 2, H - 3);
      }
    });
    if (im > 0) {
      g.fillStyle = C.tinta2;
      g.fillText(t('Sostenido'), ps[im - 1].x + MESETA / 2, 12);
    }
  };

  // --- arrastrar los puntos
  const local = (ev) => {
    const r = dibujo.c.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
  };
  dibujo.c.addEventListener('pointerdown', (ev) => {
    const { x, y } = local(ev);
    const ps = posiciones();
    let mejor = -1;
    let dist = 12;
    ps.forEach((q, i) => {
      if (!q.pt.t && !q.pt.l) return;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < dist) {
        dist = d;
        mejor = i;
      }
    });
    if (mejor < 0) return;
    tomado = mejor;
    dibujo.c.style.cursor = 'grabbing';
    try {
      dibujo.c.setPointerCapture(ev.pointerId);
    } catch (e) {
      // puntero de prueba
    }
    pintar();
  });
  dibujo.c.addEventListener('pointermove', (ev) => {
    if (tomado < 0) return;
    const { x, y } = local(ev);
    const ps = posiciones();
    const q = ps[tomado];
    if (q.pt.t) {
      const antes = tomado > 0 ? ps[tomado - 1].x + (q.pt.meseta ? MESETA : 0) : X0;
      const ms = tiempoDe(x - antes);
      const p = paramDe(q.pt.t);
      mandar(q.pt.t, Math.max(p.min, Math.min(p.max, Math.round(ms * 10) / 10)));
    }
    if (q.pt.l) mandar(q.pt.l, Math.round(nivelDe(y) * 100));
    refrescar();
  });
  const soltarPunto = () => {
    if (tomado < 0) return;
    tomado = -1;
    dibujo.c.style.cursor = 'grab';
    pintar();
  };
  dibujo.c.addEventListener('pointerup', soltarPunto);
  dibujo.c.addEventListener('pointercancel', soltarPunto);

  const ponerHoja = (h) => {
    hoja = h;
    armar();
  };
  ponerHoja('vol');

  return {
    el: caja,
    // La capa elegida arriba (1…3).
    ponerCapa(k) {
      if (k === capa) return;
      capa = k;
      refrescar();
    },
    // 'vol' | 'fil' | 'alt'
    ponerHoja,
    // Lo que vale ahora un parámetro (el id entero), según lo último que dijo el plugin.
    valor: (id) => valores[id],
    // Controles de la capa elegida para otra carpeta: una fila con estos parámetros (cortos).
    crearGrupo(cortos) {
      const mapa = {};
      const ps = cortos.map(paramDe).filter(Boolean);
      const lugares = ps.reduce((n, p) => n + (p.tipo === 'choice' && !p.angosto ? 2 : 1), 0);
      const grilla = el('div', `display:grid;grid-template-columns:repeat(${Math.max(lugares, 7)},minmax(0,1fr));gap:4px;align-items:start;`);
      for (const p of ps) grilla.append(control(p, mapa));
      extras.push(mapa);
      for (const [corto, c] of Object.entries(mapa)) c.poner(leer(corto));
      return grilla;
    },
    // Lo que el plugin dice ahora (cada medio segundo): no pisa lo que se está tocando.
    ponerValores(vals) {
      for (const p of N.PARAMS) if (vals[p.id] && vals[p.id].value !== undefined && !(tomado >= 0 && p.id.startsWith(`c${capa}`))) valores[p.id] = Number(vals[p.id].value);
      if (tomado < 0) refrescar();
    },
    pintar,
    iniciar() {
      refrescar();
    },
  };
}
