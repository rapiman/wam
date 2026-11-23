// EL JUEGO COMÚN DE CONTROLES DE LOS PLUGINS PROPIOS (2026-11-23): perilla, interruptor,
// casilla de número y lienzo. Planos y simples (JP: «parecida a Ableton Live, así muy simple»).
//
// LOS COLORES SON VARIABLES `--pzw-*` con un valor por defecto: la página que aloja el plugin
// (un tema de Pizarrita, u otro sitio) las cambia desde afuera sin tocar el plugin.
//   --pzw-fondo  --pzw-tinta  --pzw-tinta2  --pzw-borde  --pzw-pantalla
//   --pzw-acento  --pzw-nivel  --pzw-reduccion  --pzw-traza  --pzw-letra
// Sin dependencias: DOM y SVG a mano.

export const POR_DEFECTO = {
  fondo: '#dcdcdc',
  tinta: '#1a1a1a',
  tinta2: '#5c5c5c',
  borde: '#9a9a9a',
  pantalla: '#f4f4f4',
  acento: '#ff8a00',
  nivel: '#4a9a4a',
  reduccion: '#d23c3c',
  traza: '#bdbdbd',
};
export const v = (nombre) => `var(--pzw-${nombre},${POR_DEFECTO[nombre]})`;

// Los colores YA RESUELTOS, para dibujar en un lienzo (que no entiende variables).
export function coloresDe(el) {
  const cs = getComputedStyle(el);
  const c = {};
  for (const k of Object.keys(POR_DEFECTO)) c[k] = cs.getPropertyValue('--pzw-' + k).trim() || POR_DEFECTO[k];
  return c;
}

export const menos = (texto) => String(texto).replace('-', '−');
export const numero = (x, decimales) => menos(x.toFixed(decimales));

export function el(etiqueta, css, texto) {
  const e = document.createElement(etiqueta);
  if (css) e.style.cssText = css;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// Un lienzo de `ancho`×`alto` px de pantalla, nítido en pantallas densas.
export function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  const d = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  c.width = Math.round(ancho * d);
  c.height = Math.round(alto * d);
  c.style.cssText = `width:${ancho}px;height:${alto}px;display:block;flex:none;`;
  const g = c.getContext('2d');
  g.scale(d, d);
  return { c, g, ancho, alto };
}

// El gesto de todos los controles que se arrastran: hacia arriba sube, con Mayús va fino,
// la rueda y las flechas también, doble clic vuelve al valor por defecto. Trabaja con una
// posición 0..1; cada control la traduce a su valor.
function arrastrable(e, { leer, escribir, porDefecto, alAgarrar }) {
  e.tabIndex = 0;
  e.style.touchAction = 'none';
  e.style.cursor = 'ns-resize';
  e.style.outline = 'none';
  let y0 = 0;
  let t0 = 0;
  let agarrado = false;
  const fijar = (t) => escribir(Math.min(1, Math.max(0, t)));
  e.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    agarrado = true;
    alAgarrar(true);
    y0 = ev.clientY;
    t0 = leer();
    try {
      e.setPointerCapture(ev.pointerId);
    } catch (err) {
      // un puntero que no es de verdad (pruebas): se arrastra igual mientras esté encima
    }
    ev.preventDefault();
    e.focus();
  });
  e.addEventListener('pointermove', (ev) => {
    if (!agarrado) return;
    fijar(t0 + (y0 - ev.clientY) / (ev.shiftKey ? 800 : 160));
  });
  const soltar = () => {
    if (!agarrado) return;
    agarrado = false;
    alAgarrar(false);
  };
  e.addEventListener('pointerup', soltar);
  e.addEventListener('pointercancel', soltar);
  e.addEventListener('dblclick', () => fijar(porDefecto()));
  e.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      fijar(leer() + (ev.deltaY < 0 ? 1 : -1) * (ev.shiftKey ? 0.004 : 0.02));
    },
    { passive: false },
  );
  e.addEventListener('keydown', (ev) => {
    const paso = ev.shiftKey ? 0.002 : 0.01;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') fijar(leer() + paso);
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') fijar(leer() - paso);
    else return;
    ev.preventDefault();
  });
}

// La escala de un control: lineal o logarítmica (tiempos, razón), con su paso.
function escala({ min, max, paso, log }) {
  const aT = (x) => (log ? Math.log(x / min) / Math.log(max / min) : (x - min) / (max - min));
  const deT = (t) => {
    const x = log ? min * (max / min) ** t : min + t * (max - min);
    // en escala logarítmica el paso se achica abajo, para no saltarse los valores chicos
    const p = log ? Math.min(paso, 10 ** Math.floor(Math.log10(Math.max(x, min) / 20))) || paso : paso;
    return Math.min(max, Math.max(min, Math.round(x / p) * p));
  };
  return { aT, deT };
}

// UNA PERILLA: nombre arriba, arco de 270° y valor abajo.
//   { nombre, min, max, paso, log?, porDefecto, formato(valor) → texto, alCambiar(valor) }
// Devuelve { el, poner(valor), agarrada() }.
export function perilla(o) {
  const { aT, deT } = escala(o);
  let valor = o.porDefecto;
  let agarrada = false;
  const NS = 'http://www.w3.org/2000/svg';
  const caja = el('div', 'display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;');
  const nombre = el('div', `color:${v('tinta2')};font-size:11px;white-space:nowrap;`, o.nombre);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '40');
  svg.setAttribute('role', 'slider');
  svg.setAttribute('aria-label', o.nombre);
  const trazo = (css) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-width', '3');
    p.style.cssText = css;
    svg.append(p);
    return p;
  };
  const R = 15;
  const punto = (grados) => {
    const a = (grados * Math.PI) / 180;
    return [20 + R * Math.cos(a), 20 + R * Math.sin(a)];
  };
  const arco = (t) => {
    const [x0, y0] = punto(135);
    const [x1, y1] = punto(135 + 270 * t);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${270 * t > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  trazo(`stroke:${v('traza')}`).setAttribute('d', arco(1));
  const lleno = trazo(`stroke:${v('acento')}`);
  const aguja = document.createElementNS(NS, 'line');
  aguja.setAttribute('x1', '20');
  aguja.setAttribute('y1', '20');
  aguja.setAttribute('stroke-width', '2');
  aguja.style.cssText = `stroke:${v('tinta')}`;
  svg.append(aguja);
  const texto = el('div', 'font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums;');
  const pintar = () => {
    const t = Math.min(1, Math.max(0, aT(valor)));
    lleno.setAttribute('d', t > 0.001 ? arco(t) : '');
    const [x, y] = punto(135 + 270 * t);
    aguja.setAttribute('x2', x.toFixed(2));
    aguja.setAttribute('y2', y.toFixed(2));
    texto.textContent = o.formato(valor);
    svg.setAttribute('aria-valuetext', texto.textContent);
  };
  arrastrable(svg, {
    leer: () => aT(valor),
    escribir: (t) => {
      const nuevo = deT(t);
      if (nuevo === valor) return;
      valor = nuevo;
      pintar();
      o.alCambiar(valor);
    },
    porDefecto: () => aT(o.porDefecto),
    alAgarrar: (si) => {
      agarrada = si;
    },
  });
  svg.addEventListener('focus', () => (svg.style.filter = 'brightness(0.85)'));
  svg.addEventListener('blur', () => (svg.style.filter = ''));
  caja.append(nombre, svg, texto);
  pintar();
  return {
    el: caja,
    poner: (x) => {
      valor = x;
      pintar();
    },
    agarrada: () => agarrada,
  };
}

// UNA CASILLA DE NÚMERO que se arrastra hacia arriba y abajo (mismos gestos que la perilla).
export function casilla(o) {
  const { aT, deT } = escala(o);
  let valor = o.porDefecto;
  let agarrada = false;
  const caja = el(
    'span',
    `display:inline-block;min-width:54px;text-align:center;padding:1px 6px;box-sizing:border-box;` +
      `background:${v('pantalla')};border:1px solid ${v('borde')};font-variant-numeric:tabular-nums;user-select:none;`,
  );
  caja.setAttribute('role', 'slider');
  caja.setAttribute('aria-label', o.nombre);
  const pintar = () => {
    caja.textContent = o.formato(valor);
  };
  arrastrable(caja, {
    leer: () => aT(valor),
    escribir: (t) => {
      const nuevo = deT(t);
      if (nuevo === valor) return;
      valor = nuevo;
      pintar();
      o.alCambiar(valor);
    },
    porDefecto: () => aT(o.porDefecto),
    alAgarrar: (si) => {
      agarrada = si;
    },
  });
  pintar();
  return {
    el: caja,
    poner: (x) => {
      valor = x;
      pintar();
    },
    agarrada: () => agarrada,
  };
}

// UN INTERRUPTOR: el cuadrito de encendido con su nombre al lado.
export function interruptor(o) {
  let puesto = !!o.porDefecto;
  const b = el(
    'button',
    `display:inline-flex;align-items:center;gap:7px;padding:0;border:0;background:none;color:inherit;` +
      `font:inherit;font-weight:bold;font-size:13px;cursor:pointer;`,
  );
  b.type = 'button';
  b.setAttribute('role', 'switch');
  const luz = el('span', `width:12px;height:12px;box-sizing:border-box;border:1px solid ${v('borde')};flex:none;`);
  b.append(luz, o.nombre);
  const pintar = () => {
    luz.style.background = puesto ? v('acento') : v('pantalla');
    b.setAttribute('aria-checked', String(puesto));
  };
  b.addEventListener('click', () => {
    puesto = !puesto;
    pintar();
    o.alCambiar(puesto);
  });
  pintar();
  return {
    el: b,
    poner: (x) => {
      puesto = !!x;
      pintar();
    },
    agarrada: () => false,
    puesto: () => puesto,
  };
}
