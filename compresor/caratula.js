// CARÁTULA DEL COMPRESOR Y LIMITADOR (2026-11-23), la que aprobó JP: arriba la curva (con el
// umbral que se arrastra), la historia del nivel con la reducción encima y los medidores;
// al medio las siete perillas; abajo la franja del limitador.
//
// Los controles y los colores (`--pzw-*`) son los comunes: `../comun/controles.js`.
import { v, coloresDe, numero, el, lienzo, perilla, casilla, interruptor } from '../comun/controles.js';

const PISO = -60; // dB: lo más bajo que muestran la curva, la historia y los medidores
const RED_MAX = 24; // dB de reducción que caben en la historia y en el medidor
const dBtxt = (x) => (x <= -120 ? '−∞' : numero(x, 1));
const tiempo = (x) => `${numero(x, x < 1 ? 2 : x < 20 ? 1 : 0)} ms`;

const PERILLAS = [
  { id: 'umbral', nombre: 'Umbral', min: -60, max: 0, paso: 0.5, porDefecto: -18, formato: (x) => `${numero(x, 1)} dB` },
  { id: 'razon', nombre: 'Razón', min: 1, max: 20, paso: 0.1, log: true, porDefecto: 4, formato: (x) => `${numero(x, 1)} : 1` },
  { id: 'ataque', nombre: 'Ataque', min: 0.1, max: 250, paso: 1, log: true, porDefecto: 10, formato: tiempo },
  { id: 'relajacion', nombre: 'Relajación', min: 10, max: 2000, paso: 1, log: true, porDefecto: 120, formato: tiempo },
  { id: 'rodilla', nombre: 'Rodilla', min: 0, max: 24, paso: 0.5, porDefecto: 6, formato: (x) => `${numero(x, 1)} dB` },
  { id: 'ganancia', nombre: 'Ganancia', min: -12, max: 24, paso: 0.5, porDefecto: 0, formato: (x) => `${x > 0 ? '+' : ''}${numero(x, 1)} dB` },
  { id: 'mezcla', nombre: 'Mezcla', min: 0, max: 100, paso: 1, porDefecto: 100, formato: (x) => `${numero(x, 0)} %` },
];

// Cuánto reduce el compresor (dB, positivo) a un nivel de entrada: la misma cuenta del
// hilo de audio (`procesador.js`), para dibujar la curva.
function reduccion(x, P) {
  const sobre = x - P.umbral;
  const W = P.rodilla;
  const pend = 1 - 1 / Math.max(1, P.razon);
  if (2 * sobre <= -W) return 0;
  if (2 * sobre < W) return (pend * (sobre + W / 2) ** 2) / (2 * W);
  return pend * sobre;
}

export async function crearCaratula(nodo) {
  const leidos = await nodo.getParameterValues(false);
  const P = { comp: 1, lim: 0, techo: -0.3 };
  for (const p of PERILLAS) P[p.id] = p.porDefecto;
  for (const id of Object.keys(P)) if (leidos && leidos[id]) P[id] = Number(leidos[id].value);
  const mandar = (id, value) => {
    P[id] = value;
    void nodo.setParameterValues({ [id]: { id, value, normalized: false } });
  };

  const caja = el(
    'div',
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;` +
      `background:${v('fondo')};color:${v('tinta')};border:1px solid ${v('borde')};` +
      `font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`,
  );
  const controles = {};

  // --- la cabecera: encendido del compresor y la reducción en números
  const cabecera = el('div', `display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid ${v('borde')};`);
  controles.comp = interruptor({ nombre: 'Compresor', porDefecto: P.comp >= 0.5, alCambiar: (si) => mandar('comp', si ? 1 : 0) });
  const txtRed = el('span', `margin-left:auto;color:${v('tinta2')};font-variant-numeric:tabular-nums;`);
  cabecera.append(controles.comp.el, txtRed);

  // --- la pantalla: curva, historia y medidores
  const pantalla = el('div', 'display:flex;gap:10px;padding:10px 10px 6px;');
  const curva = lienzo(130, 130);
  const historia = lienzo(340, 130);
  const medidores = lienzo(46, 130);
  curva.c.style.cursor = 'ew-resize';
  curva.c.style.touchAction = 'none';
  pantalla.append(curva.c, historia.c, medidores.c);

  // --- las perillas
  const fila = el('div', 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:4px 10px 10px;');
  for (const p of PERILLAS) {
    controles[p.id] = perilla({ ...p, porDefecto: p.porDefecto, alCambiar: (x) => mandar(p.id, x) });
    controles[p.id].poner(P[p.id]);
    fila.append(controles[p.id].el);
  }

  // --- la franja del limitador
  const franja = el('div', `display:flex;align-items:center;gap:12px;padding:7px 10px;border-top:1px solid ${v('borde')};`);
  controles.lim = interruptor({ nombre: 'Limitador', porDefecto: P.lim >= 0.5, alCambiar: (si) => mandar('lim', si ? 1 : 0) });
  controles.techo = casilla({
    nombre: 'Techo',
    min: -12,
    max: 0,
    paso: 0.1,
    porDefecto: -0.3,
    formato: (x) => `${numero(x, 1)} dB`,
    alCambiar: (x) => mandar('techo', x),
  });
  controles.techo.poner(P.techo);
  const barraLim = lienzo(210, 10);
  const txtLim = el('span', `min-width:56px;text-align:right;color:${v('tinta2')};font-variant-numeric:tabular-nums;`);
  franja.append(controles.lim.el, el('span', `color:${v('tinta2')};`, 'Techo'), controles.techo.el, barraLim.c, txtLim);

  caja.append(cabecera, pantalla, fila, franja);

  // El umbral también se arrastra sobre la curva (a lo ancho).
  let arrastrandoUmbral = false;
  const umbralDesde = (ev) => {
    const r = curva.c.getBoundingClientRect();
    const db = PISO + ((ev.clientX - r.left) / r.width) * -PISO;
    const x = Math.min(0, Math.max(PISO, Math.round(db * 2) / 2));
    if (x === P.umbral) return;
    mandar('umbral', x);
    controles.umbral.poner(x);
  };
  curva.c.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    arrastrandoUmbral = true;
    try {
      curva.c.setPointerCapture(ev.pointerId);
    } catch (err) {
      // puntero de prueba
    }
    umbralDesde(ev);
    ev.preventDefault();
  });
  curva.c.addEventListener('pointermove', (ev) => arrastrandoUmbral && umbralDesde(ev));
  const soltarUmbral = () => (arrastrandoUmbral = false);
  curva.c.addEventListener('pointerup', soltarUmbral);
  curva.c.addEventListener('pointercancel', soltarUmbral);

  // --- lo que se dibuja en cada cuadro
  const N = historia.ancho;
  const hE = new Float32Array(N).fill(-180); // nivel de entrada, una columna por medida
  const hR = new Float32Array(N); // reducción (dB, negativa)
  let hPos = 0;
  let ultima = nodo.medidor;
  let mE = -180;
  let mS = -180;
  let mR = 0;
  let mL = 0;
  let C = coloresDe(caja);
  let cuadros = 0;

  const marco = ({ g, ancho, alto }) => {
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, ancho, alto);
    g.strokeStyle = C.borde;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, ancho - 1, alto - 1);
  };

  const dibujarCurva = () => {
    const { g, ancho: W, alto: H } = curva;
    const X = (db) => ((db - PISO) / -PISO) * W;
    const Y = (db) => H - ((db - PISO) / -PISO) * H;
    marco(curva);
    g.strokeStyle = C.traza;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(W, 0);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = C.borde;
    g.beginPath();
    g.moveTo(Math.round(X(P.umbral)) + 0.5, 1);
    g.lineTo(Math.round(X(P.umbral)) + 0.5, H - 1);
    g.stroke();
    const encendido = P.comp >= 0.5;
    g.strokeStyle = encendido ? C.acento : C.traza;
    g.lineWidth = 2;
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const db = PISO + (px / W) * -PISO;
      const y = Y(db - reduccion(db, P));
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    g.stroke();
    g.lineWidth = 1;
    // el tirador del umbral y la bolita del nivel que está entrando
    g.fillStyle = encendido ? C.acento : C.traza;
    g.fillRect(X(P.umbral) - 3, Y(P.umbral - reduccion(P.umbral, P)) - 3, 6, 6);
    if (mE > PISO) {
      const e = Math.min(0, mE);
      g.fillStyle = C.tinta;
      g.beginPath();
      g.arc(X(e), Y(e - (encendido ? reduccion(e, P) : 0)), 3, 0, Math.PI * 2);
      g.fill();
    }
  };

  const dibujarHistoria = () => {
    const { g, ancho: W, alto: H } = historia;
    const Y = (db) => H - ((Math.max(PISO, Math.min(0, db)) - PISO) / -PISO) * (H - 2) - 1;
    marco(historia);
    g.fillStyle = C.traza;
    g.beginPath();
    g.moveTo(1, H - 1);
    for (let i = 0; i < N; i++) g.lineTo(i, Y(hE[(hPos + i) % N]));
    g.lineTo(W - 1, H - 1);
    g.closePath();
    g.fill();
    const yU = Math.round(Y(P.umbral)) + 0.5;
    g.strokeStyle = C.acento;
    g.setLineDash([4, 3]);
    g.beginPath();
    g.moveTo(1, yU);
    g.lineTo(W - 1, yU);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = C.reduccion;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const y = 1.5 + (Math.min(RED_MAX, -hR[(hPos + i) % N]) / RED_MAX) * (H - 3);
      if (i === 0) g.moveTo(i, y);
      else g.lineTo(i, y);
    }
    g.stroke();
    g.lineWidth = 1;
    g.font = '11px system-ui, sans-serif';
    g.fillStyle = C.tinta2;
    g.fillText('Nivel de entrada', 6, H - 6);
    g.fillStyle = C.reduccion;
    g.textAlign = 'right';
    g.fillText('Reducción', W - 6, H - 6);
    g.textAlign = 'left';
  };

  const dibujarMedidores = () => {
    const { g, ancho: W, alto: H } = medidores;
    g.clearRect(0, 0, W, H);
    const alto = H - 14;
    const barra = (x, letra) => {
      g.fillStyle = C.pantalla;
      g.fillRect(x, 0, 10, alto);
      g.strokeStyle = C.borde;
      g.strokeRect(x + 0.5, 0.5, 9, alto - 1);
      g.fillStyle = C.tinta2;
      g.font = '11px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(letra, x + 5, H - 2);
    };
    const sube = (x, db) => {
      const h = ((Math.max(PISO, Math.min(0, db)) - PISO) / -PISO) * (alto - 2);
      g.fillStyle = db > -0.1 ? C.reduccion : C.nivel;
      g.fillRect(x + 1, alto - 1 - h, 8, h);
    };
    barra(2, 'E');
    barra(18, 'R');
    barra(34, 'S');
    sube(2, mE);
    sube(34, mS);
    g.fillStyle = C.reduccion;
    g.fillRect(19, 1, 8, (Math.min(RED_MAX, -mR) / RED_MAX) * (alto - 2));
    g.textAlign = 'left';
  };

  const dibujarLimitador = () => {
    const { g, ancho: W, alto: H } = barraLim;
    marco(barraLim);
    g.fillStyle = C.reduccion;
    const w = (Math.min(12, -mL) / 12) * (W - 2);
    g.fillRect(W - 1 - w, 1, w, H - 2);
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
    nodo.medir(false);
  };
  const pintar = () => {
    // si sacaron la carátula de la página sin avisar, se deja de dibujar y de medir
    if (caja.isConnected) visto = true;
    else if (visto) return soltar();
    if (cuadros++ % 60 === 0) C = coloresDe(caja);
    const m = nodo.medidor;
    if (m !== ultima) {
      ultima = m;
      hE[hPos] = m.e;
      hR[hPos] = P.comp >= 0.5 ? m.r : 0;
      hPos = (hPos + 1) % N;
    }
    // los medidores caen de a poco, para poder leerlos
    mE = Math.max(m.e, mE - 1.2);
    mS = Math.max(m.s, mS - 1.2);
    mR = Math.min(P.comp >= 0.5 ? m.r : 0, mR * 0.93);
    mL = Math.min(P.lim >= 0.5 ? m.l : 0, mL * 0.93);
    if (mR > -0.05) mR = 0;
    if (mL > -0.05) mL = 0;
    txtRed.textContent = `Reducción ${dBtxt(mR)} dB`;
    txtLim.textContent = `${dBtxt(mL)} dB`;
    dibujarCurva();
    dibujarHistoria();
    dibujarMedidores();
    dibujarLimitador();
    cuadro = requestAnimationFrame(pintar);
  };

  // Si los parámetros cambian por otro lado (el anfitrión pone un estado, una automatización),
  // los controles se ponen al día, salvo el que se está moviendo.
  reloj = setInterval(() => {
    nodo.getParameterValues(false).then((vals) => {
      if (!vals || !reloj) return;
      for (const id of Object.keys(controles)) {
        if (!vals[id] || controles[id].agarrada() || (id === 'umbral' && arrastrandoUmbral)) continue;
        const x = Number(vals[id].value);
        if (Math.abs(x - P[id]) < 1e-6) continue;
        P[id] = x;
        controles[id].poner(id === 'comp' || id === 'lim' ? x >= 0.5 : x);
      }
    });
  }, 500);

  nodo.medir(true);
  cuadro = requestAnimationFrame(pintar);
  caja._pzSoltar = soltar;
  return caja;
}
