// CARÁTULA DEL ECUALIZADOR PARAMÉTRICO (2026-11-23). El gráfico manda: doble clic crea una
// banda, se arrastra para moverla (a lo ancho la frecuencia, a lo alto la ganancia), la rueda
// le cambia el Q y doble clic sobre ella la apaga. Detrás se ven los dos espectros: cómo está
// el sonido al entrar (relleno) y cómo queda al salir (línea).
// Abajo, la banda elegida con sus controles (en los cortes, además, qué tan duro es: 12 a
// 48 dB por octava) y la ganancia de salida.
//
// Los controles y los colores (`--pzw-*`) son los comunes: `../comun/controles.js`. La curva se
// dibuja con la misma cuenta que filtra en el hilo de audio (`nucleo.js`).
import { v, coloresDe, numero, el, lienzo, perilla, interruptor, elegidor } from '../comun/controles.js';
import { nucleoEq, BANDAS, FRECUENCIAS } from './nucleo.js';
import { espectros } from '../comun/espectros.js';
import { t } from '../comun/idiomas.js';

const { TIPOS, PENDIENTES, conGanancia, esCorte, etapas, qEtapa, coefs, magnitud } = nucleoEq();
const F_MIN = 20;
const F_MAX = 20000;
const RANGO = 24; // dB hacia arriba y hacia abajo que caben en el gráfico
const hz = (f) => (f < 1000 ? `${Math.round(f)} Hz` : `${numero(f / 1000, f < 10000 ? 2 : 1)} kHz`);
const dB = (x) => `${x > 0 ? '+' : ''}${numero(x, 1)} dB`;
const entre = (x, a, b) => Math.min(b, Math.max(a, x));

export async function crearCaratula(nodo) {
  const fm = nodo.context.sampleRate;
  const leidos = await nodo.getParameterValues(false);
  const lee = (id, porDefecto) => (leidos && leidos[id] ? Number(leidos[id].value) : porDefecto);
  const B = [];
  for (let i = 0; i < BANDAS; i++) {
    const n = i + 1;
    B.push({
      on: lee(`b${n}on`, 0) >= 0.5,
      tipo: Math.round(lee(`b${n}tipo`, 0)),
      frec: lee(`b${n}frec`, FRECUENCIAS[i]),
      gan: lee(`b${n}gan`, 0),
      q: lee(`b${n}q`, 1),
      pend: Math.round(lee(`b${n}pend`, 0)),
      c: [new Float64Array(5), new Float64Array(5), new Float64Array(5), new Float64Array(5)],
    });
  }
  let salida = lee('salida', 0);
  let sel = B.findIndex((b) => b.on); // la banda elegida (−1: ninguna)
  let sucio = true; // hay que recalcular la curva

  // Cambia campos de una banda acá y en el plugin (todos en un solo mensaje).
  const ponerBanda = (i, campos) => {
    const cambios = {};
    for (const campo of Object.keys(campos)) {
      B[i][campo] = campos[campo];
      const id = `b${i + 1}${campo}`;
      cambios[id] = { id, value: campo === 'on' ? (campos[campo] ? 1 : 0) : campos[campo], normalized: false };
    }
    sucio = true;
    void nodo.setParameterValues(cambios);
  };

  const caja = el(
    'div',
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;` +
      `background:${v('fondo')};color:${v('tinta')};border:1px solid ${v('borde')};` +
      `font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`,
  );

  // --- la cabecera
  const cabecera = el('div', `display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid ${v('borde')};`);
  cabecera.append(
    el('span', 'font-weight:bold;font-size:13px;', t('Ecualizador')),
    el('span', `margin-left:auto;color:${v('tinta2')};font-size:11px;`, t('Doble clic: banda nueva o apagarla · arrastrar: mover · rueda: Q')),
  );

  // --- el gráfico
  const grafico = lienzo(536, 220);
  grafico.c.style.cursor = 'crosshair';
  grafico.c.style.touchAction = 'none';
  const marcoGrafico = el('div', 'padding:10px 10px 8px;');
  marcoGrafico.append(grafico.c);
  const W = grafico.ancho;
  const H = grafico.alto;
  const X = (f) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * W;
  const FX = (x) => F_MIN * (F_MAX / F_MIN) ** (x / W);
  const Y = (g) => H / 2 - (g / RANGO) * (H / 2 - 10);
  const GY = (y) => ((H / 2 - y) / (H / 2 - 10)) * RANGO;
  const punto = (b) => [X(b.frec), Y(conGanancia(b.tipo) ? b.gan : 0)];

  // --- la franja de la banda elegida
  const franja = el('div', `display:flex;align-items:center;gap:10px;padding:7px 10px;border-top:1px solid ${v('borde')};`);
  const botones = el('div', 'display:flex;gap:3px;');
  const boton = [];
  for (let i = 0; i < BANDAS; i++) {
    const b = el(
      'button',
      `width:20px;height:20px;box-sizing:border-box;padding:0;border-radius:0;cursor:pointer;` +
        `font:inherit;font-size:11px;color:${v('tinta')};`,
      String(i + 1),
    );
    b.type = 'button';
    b.setAttribute('aria-label', `${t('Banda')} ${i + 1}`);
    b.addEventListener('click', () => {
      sel = i;
      pintarFranja();
    });
    boton.push(b);
    botones.append(b);
  }
  const encendida = interruptor({ nombre: t('Encendida'), porDefecto: false, alCambiar: (si) => sel >= 0 && (ponerBanda(sel, { on: si }), pintarFranja()) });
  const tipo = elegidor({ nombre: t('Tipo de banda'), opciones: TIPOS.map((x) => t(x)), alCambiar: (t) => sel >= 0 && (ponerBanda(sel, { tipo: t }), pintarFranja()) });
  const pend = elegidor({ nombre: t('Pendiente del corte'), opciones: PENDIENTES.map((x) => t(x)), alCambiar: (x) => sel >= 0 && ponerBanda(sel, { pend: x }) });
  franja.append(botones, encendida.el, tipo.el, pend.el);

  const fila = el('div', `display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px 10px 10px;`);
  const pFrec = perilla({ nombre: t('Frecuencia'), min: F_MIN, max: F_MAX, paso: 1, log: true, porDefecto: 1000, formato: hz, alCambiar: (x) => sel >= 0 && ponerBanda(sel, { frec: x }) });
  const pGan = perilla({ nombre: t('Ganancia'), min: -RANGO, max: RANGO, paso: 0.1, porDefecto: 0, formato: dB, alCambiar: (x) => sel >= 0 && ponerBanda(sel, { gan: x }) });
  const pQ = perilla({ nombre: t('Q'), min: 0.1, max: 18, paso: 0.01, log: true, porDefecto: 1, formato: (x) => numero(x, 2), alCambiar: (x) => sel >= 0 && ponerBanda(sel, { q: x }) });
  const pSalida = perilla({
    nombre: t('Salida'),
    min: -RANGO,
    max: RANGO,
    paso: 0.1,
    porDefecto: 0,
    formato: dB,
    alCambiar: (x) => {
      salida = x;
      sucio = true;
      void nodo.setParameterValues({ salida: { id: 'salida', value: x, normalized: false } });
    },
  });
  pSalida.poner(salida);
  pSalida.el.style.borderLeft = `1px solid ${v('borde')}`;
  fila.append(pFrec.el, pGan.el, pQ.el, pSalida.el);

  const apagar = (e, si) => {
    e.style.opacity = si ? '0.35' : '';
    e.style.pointerEvents = si ? 'none' : '';
  };
  function pintarFranja() {
    for (let i = 0; i < BANDAS; i++) {
      boton[i].style.background = B[i].on ? v('acento') : v('pantalla');
      boton[i].style.border = i === sel ? `2px solid ${v('tinta')}` : `1px solid ${v('borde')}`;
      boton[i].style.fontWeight = i === sel ? 'bold' : '';
    }
    const b = sel >= 0 ? B[sel] : null;
    for (const e of [encendida.el, tipo.el, pFrec.el, pQ.el]) apagar(e, !b);
    apagar(pGan.el, !b || !conGanancia(b.tipo));
    // la pendiente solo existe en los cortes
    pend.el.style.visibility = b && esCorte(b.tipo) ? '' : 'hidden';
    if (!b) return;
    encendida.poner(b.on);
    tipo.poner(b.tipo);
    pend.poner(b.pend);
    pFrec.poner(b.frec);
    pGan.poner(b.gan);
    pQ.poner(b.q);
  }

  caja.append(cabecera, marcoGrafico, franja, fila);
  pintarFranja();

  // --- los gestos sobre el gráfico
  const lugar = (ev) => {
    const r = grafico.c.getBoundingClientRect();
    return [((ev.clientX - r.left) * W) / r.width, ((ev.clientY - r.top) * H) / r.height];
  };
  const bandaEn = (x, y) => {
    let mejor = -1;
    let dMejor = 121; // a menos de 11 px
    for (let i = 0; i < BANDAS; i++) {
      if (!B[i].on) continue;
      const [px, py] = punto(B[i]);
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < dMejor) {
        dMejor = d;
        mejor = i;
      }
    }
    return mejor;
  };
  let arrastrando = -1;
  grafico.c.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const [x, y] = lugar(ev);
    const i = bandaEn(x, y);
    if (i < 0) return;
    sel = i;
    arrastrando = i;
    try {
      grafico.c.setPointerCapture(ev.pointerId);
    } catch (err) {
      // puntero de prueba
    }
    pintarFranja();
    ev.preventDefault();
  });
  grafico.c.addEventListener('pointermove', (ev) => {
    if (arrastrando < 0) return;
    const [x, y] = lugar(ev);
    const b = B[arrastrando];
    const campos = { frec: Math.round(entre(FX(x), F_MIN, F_MAX)) };
    if (conGanancia(b.tipo)) campos.gan = Math.round(entre(GY(y), -RANGO, RANGO) * 10) / 10;
    ponerBanda(arrastrando, campos);
    pFrec.poner(b.frec);
    pGan.poner(b.gan);
  });
  const soltarBanda = () => (arrastrando = -1);
  grafico.c.addEventListener('pointerup', soltarBanda);
  grafico.c.addEventListener('pointercancel', soltarBanda);
  grafico.c.addEventListener('dblclick', (ev) => {
    const [x, y] = lugar(ev);
    const i = bandaEn(x, y);
    if (i >= 0) {
      ponerBanda(i, { on: false });
      if (sel === i) sel = B.findIndex((b) => b.on);
    } else {
      const libre = B.findIndex((b) => !b.on);
      if (libre < 0) return;
      const frec = Math.round(entre(FX(x), F_MIN, F_MAX));
      // en las orillas nace un corte; en el resto, una campana
      const t = frec < 40 ? 3 : frec > 12000 ? 4 : 0;
      ponerBanda(libre, { tipo: t, frec, gan: t === 0 ? Math.round(entre(GY(y), -RANGO, RANGO) * 10) / 10 : 0, q: t === 0 ? 1 : 0.71, on: true });
      sel = libre;
    }
    pintarFranja();
  });
  grafico.c.addEventListener(
    'wheel',
    (ev) => {
      if (sel < 0 || !B[sel].on) return;
      ev.preventDefault();
      const q = Math.round(entre(B[sel].q * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), 0.1, 18) * 100) / 100;
      ponerBanda(sel, { q });
      pQ.poner(q);
    },
    { passive: false },
  );

  // --- los espectros (comun/espectros.js): cómo está el sonido al entrar y cómo queda al salir.
  const esp = espectros(nodo);

  // --- lo que se dibuja en cada cuadro
  const curva = new Float32Array(W + 1);
  let C = coloresDe(caja);
  let cuadros = 0;
  const calcular = () => {
    curva.fill(salida);
    for (const b of B) {
      if (!b.on) continue;
      const n = etapas(b.tipo, b.pend);
      for (let s = 0; s < n; s++) {
        coefs(b.c[s], b.tipo, b.frec, b.gan, qEtapa(b.q, s, n), fm);
        for (let px = 0; px <= W; px++) curva[px] += magnitud(b.c[s], FX(px), fm);
      }
    }
    sucio = false;
  };

  const dibujar = () => {
    const g = grafico.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, W, H);
    // la rejilla
    g.lineWidth = 1;
    g.font = '11px system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
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
    g.textAlign = 'left';
    for (const [f, t] of [[100, '100'], [1000, '1 k'], [10000, '10 k']]) g.fillText(t, X(f) + 3, H - 4);
    for (const db of [-12, 12]) {
      const y = Math.round(Y(db)) + 0.5;
      g.strokeStyle = C.traza;
      g.globalAlpha = 0.45;
      g.beginPath();
      g.moveTo(1, y);
      g.lineTo(W - 1, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillText(db > 0 ? '+12' : '−12', 4, y - 3);
    }
    // los espectros: cómo está (relleno) y cómo queda (línea), con su leyenda mientras haya sonido
    esp.dibujar(g, W, H, C, FX);
    // la línea de 0 dB
    g.strokeStyle = C.borde;
    g.beginPath();
    g.moveTo(1, Math.round(Y(0)) + 0.5);
    g.lineTo(W - 1, Math.round(Y(0)) + 0.5);
    g.stroke();
    // la curva, con su relleno hasta el 0
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const y = entre(Y(curva[px]), 0, H);
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    g.strokeStyle = C.acento;
    g.lineWidth = 2;
    g.stroke();
    g.lineTo(W, Y(0));
    g.lineTo(0, Y(0));
    g.closePath();
    g.fillStyle = C.acento;
    g.globalAlpha = 0.15;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 1;
    // las bandas
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 11px system-ui, sans-serif';
    for (let i = 0; i < BANDAS; i++) {
      if (!B[i].on) continue;
      const [x, y] = punto(B[i]);
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fillStyle = i === sel ? C.tinta : C.acento;
      g.fill();
      g.fillStyle = i === sel ? C.pantalla : C.tinta;
      g.fillText(String(i + 1), x, y + 0.5);
    }
    g.strokeStyle = C.borde;
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
    esp.soltar();
  };
  const pintar = () => {
    // si sacaron la carátula de la página sin avisar, se deja de dibujar
    if (caja.isConnected) visto = true;
    else if (visto) return soltar();
    if (cuadros++ % 60 === 0) C = coloresDe(caja);
    if (sucio) calcular();
    dibujar();
    cuadro = requestAnimationFrame(pintar);
  };

  // Si los parámetros cambian por otro lado (el anfitrión pone un estado, una automatización),
  // la carátula se pone al día, salvo lo que se está moviendo.
  const CAMPOS = ['on', 'tipo', 'frec', 'gan', 'q', 'pend'];
  reloj = setInterval(() => {
    // si el anfitrión rearmó sus cables (desconectó todo y volvió a conectar), los analizadores
    // se vuelven a colgar; conectar dos veces lo mismo no hace nada
    esp.recolgar();
    nodo.getParameterValues(false).then((vals) => {
      if (!vals || !reloj) return;
      let cambio = false;
      for (let i = 0; i < BANDAS; i++) {
        if (i === arrastrando) continue;
        if (i === sel && (pFrec.agarrada() || pGan.agarrada() || pQ.agarrada() || tipo.agarrada() || pend.agarrada())) continue;
        for (const campo of CAMPOS) {
          const dato = vals[`b${i + 1}${campo}`];
          if (!dato) continue;
          const entero = campo === 'tipo' || campo === 'pend';
          const x = campo === 'on' ? Number(dato.value) >= 0.5 : entero ? Math.round(Number(dato.value)) : Number(dato.value);
          if (campo === 'on' || entero ? x === B[i][campo] : Math.abs(x - B[i][campo]) < 1e-4) continue;
          B[i][campo] = x;
          cambio = true;
        }
      }
      if (vals.salida && !pSalida.agarrada() && Math.abs(Number(vals.salida.value) - salida) > 1e-4) {
        salida = Number(vals.salida.value);
        pSalida.poner(salida);
        cambio = true;
      }
      if (!cambio) return;
      if (sel < 0) sel = B.findIndex((b) => b.on);
      sucio = true;
      pintarFranja();
    });
  }, 500);

  cuadro = requestAnimationFrame(pintar);
  caja._pzSoltar = soltar;
  return caja;
}
