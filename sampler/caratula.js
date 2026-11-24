// LA CARÁTULA DEL SAMPLER (2026-11-24). Arriba el teclado con las zonas (clic: elegir la zona de
// esa tecla); la zona elegida con su tramo, su raíz y si es golpe (batería); sus capas (hasta 3),
// cada una con su audio, la forma de onda y las cuatro marcas que se arrastran —dónde parte la nota,
// el comienzo y el final del loop, y el fin—, el loop, si cada parte sigue la altura de la nota, y
// su volumen, paneo y afinación. Abajo, la envolvente y lo general (parámetros del plugin).
//
// Mismos controles y colores que los demás plugins propios (`comun/controles.js`), sigue el tema
// de la ventana y habla el idioma de la página (`comun/idiomas.js`).
import { v, coloresDe, numero, el, lienzo, perilla, casilla, interruptor } from '../comun/controles.js';
import { t } from '../comun/idiomas.js';
import { nucleoSampler } from './nucleo.js';
import { parejos } from './tajadas.js';

const N = nucleoSampler();
const NOTA_BAJA = 24; // C1
const NOTA_ALTA = 108; // C8
const NOMBRES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nombreNota = (n) => `${NOMBRES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
const negra = (n) => [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12);
const entre = (x, a, b) => Math.min(b, Math.max(a, x));
const copia = (x) => JSON.parse(JSON.stringify(x));

const boton = (texto, alClic, titulo) => {
  const b = el('button', `font:inherit;font-size:11px;color:${v('tinta')};background:${v('pantalla')};border:1px solid ${v('borde')};padding:1px 6px;cursor:pointer;`, texto);
  b.type = 'button';
  if (titulo) b.title = titulo;
  b.addEventListener('click', alClic);
  return b;
};

export function crearCaratula(nodo) {
  let inst = copia(nodo.inst);
  let zSel = inst.zonas.length ? 0 : -1;
  let cSel = 0;
  const guardar = () => nodo.ponerInstrumento(copia(inst));
  const zona = () => (zSel >= 0 ? inst.zonas[zSel] : null);
  const capa = () => {
    const z = zona();
    return z ? z.capas[cSel] || null : null;
  };

  const caja = el(
    'div',
    `display:inline-flex;flex-direction:column;box-sizing:border-box;width:558px;user-select:none;` +
      `background:${v('fondo')};color:${v('tinta')};border:1px solid ${v('borde')};font:12px/1.3 var(--pzw-letra,system-ui,sans-serif);`,
  );
  const cabecera = el('div', `display:flex;align-items:baseline;gap:8px;padding:6px 10px;border-bottom:1px solid ${v('borde')};`);
  cabecera.append(
    el('span', 'font-weight:bold;font-size:13px;', t('Sampler')),
    el('span', `margin-left:auto;color:${v('tinta2')};font-size:11px;`, t('Clic en el teclado: elegir la zona · arrastrar las marcas: dónde parte, el loop y el fin')),
  );

  // --- el teclado con las zonas
  const tec = lienzo(536, 52);
  tec.c.style.cursor = 'pointer';
  const marcoTec = el('div', 'padding:8px 10px 4px;');
  marcoTec.append(tec.c);
  const anchoTecla = 536 / (NOTA_ALTA - NOTA_BAJA + 1);
  const xNota = (n) => (n - NOTA_BAJA) * anchoTecla;
  const notaEn = (x) => entre(Math.floor(x / anchoTecla) + NOTA_BAJA, NOTA_BAJA, NOTA_ALTA);
  tec.c.addEventListener('pointerdown', (ev) => {
    const r = tec.c.getBoundingClientRect();
    const n = notaEn(((ev.clientX - r.left) * 536) / r.width);
    const i = inst.zonas.findIndex((z) => n >= z.baja && n <= z.alta);
    if (i >= 0) {
      zSel = i;
      cSel = 0;
      pintarTodo();
    }
  });

  // --- la zona elegida
  const filaZona = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:4px 10px 6px;border-bottom:1px solid ${v('borde')};`);
  const titZona = el('span', 'font-weight:bold;');
  const fmtNota = (x) => nombreNota(Math.round(x));
  const cBaja = casilla({ nombre: t('Desde'), min: 0, max: 127, paso: 1, porDefecto: 36, formato: fmtNota, alCambiar: (x) => ponerZona({ baja: Math.round(x) }) });
  const cAlta = casilla({ nombre: t('Hasta'), min: 0, max: 127, paso: 1, porDefecto: 36, formato: fmtNota, alCambiar: (x) => ponerZona({ alta: Math.round(x) }) });
  const cRaiz = casilla({ nombre: t('Raíz'), min: 0, max: 127, paso: 1, porDefecto: 60, formato: fmtNota, alCambiar: (x) => ponerZona({ raiz: Math.round(x) }) });
  const iGolpe = interruptor({ nombre: t('Golpe (batería)'), porDefecto: false, alCambiar: (si) => ponerZona({ golpe: si }) });
  const etiqueta = (texto, control) => {
    const s = el('span', 'display:inline-flex;align-items:center;gap:4px;');
    s.append(el('span', `color:${v('tinta2')};`, texto), control);
    return s;
  };
  const zonaNueva = (golpe, tajadas = false) => {
    // Piano: lo que quede libre del teclado, con la raíz al medio. Batería: la próxima tecla libre
    // desde el bombo (C1, 36). Tajadas: desde C3 (48), y se alarga sola con los cortes.
    const ocupada = (n) => inst.zonas.some((z) => n >= z.baja && n <= z.alta);
    let z;
    if (tajadas) {
      let n = 48;
      while (n < 127 && ocupada(n)) n++;
      z = { baja: n, alta: n, raiz: n, golpe: true, tajadas: true, sens: 50, capas: [{}] };
    } else if (golpe) {
      let n = 36;
      while (n < 127 && ocupada(n)) n++;
      z = { baja: n, alta: n, raiz: n, golpe: true, capas: [{}] };
    } else {
      let a = NOTA_BAJA;
      while (a < NOTA_ALTA && ocupada(a)) a++;
      let b = a;
      while (b < NOTA_ALTA && !ocupada(b + 1)) b++;
      z = { baja: a, alta: b, raiz: entre(60, a, b), golpe: false, capas: [{}] };
    }
    inst.zonas.push(z);
    zSel = inst.zonas.length - 1;
    cSel = 0;
    guardar();
    pintarTodo();
  };
  const borrarZona = () => {
    if (zSel < 0) return;
    inst.zonas.splice(zSel, 1);
    zSel = Math.min(zSel, inst.zonas.length - 1);
    cSel = 0;
    guardar();
    pintarTodo();
  };
  filaZona.append(
    titZona,
    etiqueta(t('Desde'), cBaja.el),
    etiqueta(t('Hasta'), cAlta.el),
    etiqueta(t('Raíz'), cRaiz.el),
    iGolpe.el,
    boton(`+ ${t('Piano')}`, () => zonaNueva(false), t('Nueva zona de piano')),
    boton(`+ ${t('Batería')}`, () => zonaNueva(true), t('Nueva zona de batería')),
    boton(`+ ${t('Tajadas')}`, () => zonaNueva(true, true), t('Nueva zona de tajadas')),
    boton('×', borrarZona, t('Borrar zona')),
  );
  const ponerZona = (campos) => {
    const z = zona();
    if (!z) return;
    Object.assign(z, campos);
    if (z.alta < z.baja) [z.baja, z.alta] = [z.alta, z.baja];
    ajustarTajadas(z);
    guardar();
    pintarTodo();
  };
  // Una zona de tajadas ocupa una tecla por tajada, desde `baja`; la raíz no se usa.
  const ajustarTajadas = (z) => {
    if (!z || !z.tajadas) return;
    let n = 1;
    for (const c of z.capas) if (Array.isArray(c.cortes)) n = Math.max(n, c.cortes.length);
    z.alta = Math.min(127, z.baja + n - 1);
    z.raiz = z.baja;
    z.golpe = true;
  };
  // Cortes nuevos para la capa elegida: detectados, o en partes iguales.
  const ponerCortes = (cortes) => {
    const z = zona();
    const c = capa();
    if (!z || !c) return;
    c.cortes = cortes.length ? cortes.map((x) => Math.round(x * 10000) / 10000) : [0];
    ajustarTajadas(z);
    guardar();
    pintarTodo();
  };
  const detectar = () => {
    const z = zona();
    const c = capa();
    if (z && c && durDe()) ponerCortes(nodo.detectarGolpes(c.m, z.sens === undefined ? 50 : z.sens));
  };

  // --- la capa elegida
  const filaCapas = el('div', 'display:flex;align-items:center;gap:6px;padding:6px 10px 2px;');
  const botonesCapa = [0, 1, 2].map((k) => {
    const b = boton(`${t('Capa')} ${k + 1}`, () => {
      const z = zona();
      if (!z) return;
      if (!z.capas[k]) {
        while (z.capas.length <= k) z.capas.push({});
        guardar();
      }
      cSel = k;
      pintarTodo();
    });
    return b;
  });
  const nombreAudio = el('span', `flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${v('tinta2')};`);
  const archivo = el('input');
  archivo.type = 'file';
  archivo.accept = 'audio/*';
  archivo.style.display = 'none';
  archivo.addEventListener('change', async () => {
    const f = archivo.files && archivo.files[0];
    archivo.value = '';
    if (!f || !capa()) return;
    const m = await nodo.cargarArchivo(f);
    ponerAudio(m);
  });
  const quitarCapa = () => {
    const z = zona();
    if (!z || z.capas.length <= 1) return;
    z.capas.splice(cSel, 1);
    cSel = Math.max(0, cSel - 1);
    guardar();
    pintarTodo();
  };
  filaCapas.append(...botonesCapa, nombreAudio, boton(t('Abrir archivo'), () => archivo.click()), archivo, boton('×', quitarCapa, t('Quitar capa')));
  const filaDir = el('div', 'display:flex;align-items:center;gap:6px;padding:2px 10px 4px;');
  const dir = el('input', `flex:1;min-width:0;font:inherit;font-size:11px;color:${v('tinta')};background:${v('pantalla')};border:1px solid ${v('borde')};padding:1px 4px;`);
  dir.placeholder = t('Dirección web del audio');
  const cargarDir = async () => {
    const url = dir.value.trim();
    if (!url || !capa()) return;
    const m = await nodo.cargarDireccion(url);
    dir.value = '';
    ponerAudio(m);
  };
  dir.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') void cargarDir();
  });
  filaDir.append(dir, boton(t('Cargar'), () => void cargarDir()));
  // Un audio nuevo en la capa: las marcas, a lo largo entero.
  const ponerAudio = (m) => {
    const c = capa();
    if (!c) return;
    const viejo = c.m;
    Object.assign(c, { m, ini: 0, lIni: undefined, lFin: undefined, fin: undefined, cortes: undefined });
    if (viejo && !inst.zonas.some((z) => z.capas.some((x) => x.m === viejo))) nodo.quitarMuestra(viejo);
    guardar();
    pintarTodo();
  };

  // --- la forma de onda con las marcas
  const onda = lienzo(536, 110);
  const marcoOnda = el('div', 'padding:2px 10px 4px;');
  marcoOnda.append(onda.c);
  const MARCAS = ['ini', 'lIni', 'lFin', 'fin'];
  let tomada = null;
  const durDe = () => {
    const c = capa();
    const mu = c && nodo.muestras[c.m];
    return mu && mu.estado === 'lista' ? mu.dur : 0;
  };
  const marcaDe = (c, k, dur) => {
    if (k === 'ini') return c.ini || 0;
    if (k === 'fin') return c.fin === undefined || c.fin === null ? dur : c.fin;
    if (k === 'lIni') return c.lIni === undefined || c.lIni === null ? marcaDe(c, 'ini', dur) : c.lIni;
    return c.lFin === undefined || c.lFin === null ? marcaDe(c, 'fin', dur) : c.lFin;
  };
  const xDe = (s, dur) => (dur > 0 ? (s / dur) * 536 : 0);
  // En una zona de tajadas las marcas son los cortes (`c0`, `c1`…) y el fin.
  const enTajadas = () => !!(zona() && zona().tajadas);
  const cortesDe = (c) => (Array.isArray(c.cortes) ? c.cortes : []);
  const marcasDe = (c, dur) =>
    enTajadas()
      ? [...cortesDe(c).map((s, i) => ({ k: `c${i}`, s })), { k: 'fin', s: marcaDe(c, 'fin', dur) }]
      : MARCAS.filter((k) => c.loop || (k !== 'lIni' && k !== 'lFin')).map((k) => ({ k, s: marcaDe(c, k, dur) }));
  const segDe = (ev, dur) => {
    const r = onda.c.getBoundingClientRect();
    return entre((((ev.clientX - r.left) * 536) / r.width / 536) * dur, 0, dur);
  };
  const marcaCerca = (c, dur, x) => {
    let mejor = null;
    let dist = 7;
    for (const mk of marcasDe(c, dur)) {
      const d = Math.abs(xDe(mk.s, dur) - x);
      if (d < dist) {
        dist = d;
        mejor = mk.k;
      }
    }
    return mejor;
  };
  // La tajada que cubre un segundo (−1 antes del primer corte o después del fin).
  const tajadaEn = (c, s, dur) => {
    const cs = cortesDe(c);
    if (s >= marcaDe(c, 'fin', dur)) return -1;
    let i = -1;
    for (let k = 0; k < cs.length; k++) if (cs[k] <= s) i = k;
    return i;
  };
  onda.c.addEventListener('pointerdown', (ev) => {
    const c = capa();
    const dur = durDe();
    if (!c || !dur) return;
    const s = segDe(ev, dur);
    const mejor = marcaCerca(c, dur, xDe(s, dur));
    if (!mejor) {
      // Fuera de las marcas, en tajadas: oír la tajada que está ahí.
      if (enTajadas()) {
        const i = tajadaEn(c, s, dur);
        if (i >= 0) nodo.tocar(zona().baja + i);
      }
      return;
    }
    tomada = mejor;
    try {
      onda.c.setPointerCapture(ev.pointerId);
    } catch (e) {
      // puntero de prueba
    }
  });
  onda.c.addEventListener('pointermove', (ev) => {
    const c = capa();
    const dur = durDe();
    if (!tomada || !c || !dur) return;
    const s = segDe(ev, dur);
    if (enTajadas()) {
      // Los cortes no se cruzan entre ellos ni pasan el fin.
      const cs = cortesDe(c);
      if (tomada === 'fin') {
        c.fin = Math.round(entre(s, cs.length ? cs[cs.length - 1] + 0.005 : 0, dur) * 10000) / 10000;
      } else {
        const i = Number(tomada.slice(1));
        const lo = i > 0 ? cs[i - 1] + 0.005 : 0;
        const hi = i + 1 < cs.length ? cs[i + 1] - 0.005 : marcaDe(c, 'fin', dur) - 0.005;
        cs[i] = Math.round(entre(s, lo, Math.max(lo, hi)) * 10000) / 10000;
      }
      pintarOnda();
      return;
    }
    // Las marcas no se cruzan: ini ≤ lIni ≤ lFin ≤ fin.
    const orden = MARCAS.indexOf(tomada);
    const lo = orden > 0 ? marcaDe(c, MARCAS[orden - 1], dur) : 0;
    const hi = orden < 3 ? marcaDe(c, MARCAS[orden + 1], dur) : dur;
    c[tomada] = Math.round(entre(s, lo, hi) * 10000) / 10000;
    pintarOnda();
  });
  // Doble clic en tajadas: sobre un corte lo quita; en otro lado agrega uno.
  onda.c.addEventListener('dblclick', (ev) => {
    const c = capa();
    const dur = durDe();
    if (!c || !dur || !enTajadas()) return;
    const s = segDe(ev, dur);
    const k = marcaCerca(c, dur, xDe(s, dur));
    const cs = cortesDe(c).slice();
    if (k && k !== 'fin') {
      if (cs.length <= 1) return;
      cs.splice(Number(k.slice(1)), 1);
    } else if (!k && s < marcaDe(c, 'fin', dur)) {
      cs.push(s);
      cs.sort((x, y) => x - y);
    } else return;
    ponerCortes(cs);
  });
  const soltarMarca = () => {
    if (!tomada) return;
    tomada = null;
    guardar();
  };
  onda.c.addEventListener('pointerup', soltarMarca);
  onda.c.addEventListener('pointercancel', soltarMarca);

  // --- lo de la capa: loop, altura por parte, volumen, paneo y afinación
  const filaCapa = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:2px 10px 8px;border-bottom:1px solid ${v('borde')};`);
  const ponerCapa = (campos) => {
    const c = capa();
    if (!c) return;
    Object.assign(c, campos);
    guardar();
    pintarOnda();
  };
  const iLoop = interruptor({ nombre: t('Loop'), porDefecto: false, alCambiar: (si) => ponerCapa({ loop: si }) });
  const altura = (k) =>
    interruptor({
      nombre: [t('Entrada'), t('Loop'), t('Release')][k],
      porDefecto: true,
      alCambiar: (si) => {
        const c = capa();
        if (!c) return;
        const alt = Array.isArray(c.alt) ? c.alt.slice() : [true, true, true];
        alt[k] = si;
        ponerCapa({ alt });
      },
    });
  const iAlt = [altura(0), altura(1), altura(2)];
  const pGan = perilla({ nombre: t('Volumen'), min: -40, max: 12, paso: 0.5, porDefecto: 0, formato: (x) => `${numero(x, 1)} dB`, alCambiar: (x) => ponerCapa({ gan: x }) });
  const pPan = perilla({ nombre: t('Paneo'), min: -1, max: 1, paso: 0.01, porDefecto: 0, formato: (x) => (Math.abs(x) < 0.005 ? 'C' : `${x < 0 ? 'I' : 'D'} ${Math.round(Math.abs(x) * 100)}`), alCambiar: (x) => ponerCapa({ pan: x }) });
  const pAfin = perilla({ nombre: t('Afinación'), min: -24, max: 24, paso: 0.01, porDefecto: 0, formato: (x) => `${numero(x, 2)} st`, alCambiar: (x) => ponerCapa({ afinar: x }) });
  const altCaja = el('span', 'display:inline-flex;align-items:center;gap:8px;');
  altCaja.append(el('span', `color:${v('tinta2')};`, t('Con la altura de la nota:')), ...iAlt.map((x) => x.el));
  const perillasCapa = el('span', 'display:inline-flex;gap:10px;margin-left:auto;');
  perillasCapa.append(pGan.el, pPan.el, pAfin.el);
  filaCapa.append(iLoop.el, altCaja, perillasCapa);

  // --- en tajadas: detectar los golpes o partir en partes iguales
  const filaTajadas = el('div', 'display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:2px 10px 6px;');
  const pSens = perilla({
    nombre: t('Sensibilidad'),
    min: 0,
    max: 100,
    paso: 1,
    porDefecto: 50,
    formato: (x) => `${Math.round(x)} %`,
    alCambiar: (x) => {
      const z = zona();
      if (z) z.sens = Math.round(x);
    },
  });
  let partes = 16;
  const cPartes = casilla({ nombre: t('Partes'), min: 1, max: 64, paso: 1, porDefecto: 16, formato: (x) => String(Math.round(x)), alCambiar: (x) => (partes = Math.round(x)) });
  filaTajadas.append(
    boton(t('Detectar'), detectar, t('Detectar los golpes')),
    pSens.el,
    el('span', `color:${v('tinta2')};margin-left:8px;`, t('Partes')),
    cPartes.el,
    boton(t('Partes iguales'), () => {
      const c = capa();
      const dur = durDe();
      if (c && dur) ponerCortes(parejos(marcaDe(c, 'fin', dur), partes));
    }),
    el('span', `margin-left:auto;color:${v('tinta2')};font-size:11px;`, t('Clic: oír la tajada · doble clic: agregar o quitar un corte')),
  );

  // --- lo general: los parámetros del plugin
  const filaGeneral = el('div', 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:6px 10px 10px;');
  const textoDe = (p, x) => `${numero(x, p.dec !== undefined ? p.dec : 0)}${p.unidad ? ` ${p.unidad}` : ''}`;
  const generales = {};
  for (const p of N.PARAMS) {
    const c = perilla({
      nombre: t(p.nombre),
      min: p.min,
      max: p.max,
      paso: p.paso || 1,
      log: p.id === 'atq' || p.id === 'dec' || p.id === 'sol',
      porDefecto: p.defecto,
      formato: (x) => textoDe(p, x),
      alCambiar: (x) => void nodo.setParameterValues({ [p.id]: { id: p.id, value: x, normalized: false } }),
    });
    generales[p.id] = c;
    filaGeneral.append(c.el);
  }

  caja.append(cabecera, marcoTec, filaZona, filaCapas, filaDir, marcoOnda, filaTajadas, filaCapa, filaGeneral);

  // --- dibujar
  let C = coloresDe(caja);
  const pintarTeclado = () => {
    const g = tec.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, 536, 52);
    // las zonas, arriba
    inst.zonas.forEach((z, i) => {
      const x0 = xNota(Math.max(NOTA_BAJA, z.baja));
      const x1 = xNota(Math.min(NOTA_ALTA, z.alta) + 1);
      if (x1 <= x0) return;
      g.fillStyle = C.acento;
      g.globalAlpha = i === zSel ? 0.9 : 0.4;
      g.fillRect(x0 + 0.5, 1, x1 - x0 - 1, 14);
      g.globalAlpha = 1;
      if (z.raiz >= NOTA_BAJA && z.raiz <= NOTA_ALTA) {
        g.fillStyle = C.tinta;
        g.fillRect(xNota(z.raiz) + anchoTecla / 2 - 1, 3, 2, 10);
      }
    });
    // las teclas
    for (let n = NOTA_BAJA; n <= NOTA_ALTA; n++) {
      g.fillStyle = negra(n) ? C.tinta2 : C.fondo;
      g.fillRect(xNota(n) + 0.5, 18, anchoTecla - 1, negra(n) ? 22 : 33);
    }
    g.fillStyle = C.tinta2;
    g.font = '9px system-ui, sans-serif';
    g.textAlign = 'left';
    for (let n = 36; n <= NOTA_ALTA; n += 12) g.fillText(nombreNota(n), xNota(n) + 1, 50);
  };
  const pintarOnda = () => {
    const g = onda.g;
    g.fillStyle = C.pantalla;
    g.fillRect(0, 0, 536, 110);
    g.strokeStyle = C.borde;
    g.strokeRect(0.5, 0.5, 535, 109);
    const c = capa();
    const mu = c && nodo.muestras[c.m];
    g.fillStyle = C.tinta2;
    g.font = '11px system-ui, sans-serif';
    g.textAlign = 'center';
    if (!zona()) {
      g.fillText(t('Sin zonas: crear una de piano o de batería'), 268, 58);
      return;
    }
    if (!mu) {
      g.fillText(t('Sin audio: abrir un archivo o pegar una dirección'), 268, 58);
      return;
    }
    if (mu.estado !== 'lista') {
      g.fillText(mu.estado === 'error' ? t('no se pudo abrir') : t('bajando…'), 268, 58);
      return;
    }
    const dur = mu.dur;
    const P = mu.picos.length / 2;
    const pintarForma = () => {
      g.fillStyle = C.tinta;
      for (let x = 0; x < 536; x++) {
        const k = Math.min(P - 1, Math.floor((x / 536) * P));
        const lo = mu.picos[2 * k];
        const hi = mu.picos[2 * k + 1];
        g.fillRect(x, 55 - hi * 50, 1, Math.max(1, (hi - lo) * 50));
      }
    };
    if (enTajadas()) {
      // Las tajadas, una sí y una no sombreadas, con la tecla que las toca.
      const cs = cortesDe(c);
      const xf = xDe(marcaDe(c, 'fin', dur), dur);
      const baja = zona().baja;
      cs.forEach((s, i) => {
        const a = xDe(s, dur);
        const b = i + 1 < cs.length ? xDe(cs[i + 1], dur) : xf;
        if (i % 2 === 0) {
          g.fillStyle = C.acento;
          g.globalAlpha = 0.13;
          g.fillRect(a, 1, Math.max(0, b - a), 108);
          g.globalAlpha = 1;
        }
      });
      pintarForma();
      g.fillStyle = C.pantalla;
      g.globalAlpha = 0.6;
      g.fillRect(0, 1, cs.length ? xDe(cs[0], dur) : 0, 108);
      g.fillRect(xf, 1, 536 - xf, 108);
      g.globalAlpha = 1;
      g.font = '9px system-ui, sans-serif';
      cs.forEach((s, i) => {
        const x = Math.round(xDe(s, dur)) + 0.5;
        g.strokeStyle = C.acento;
        g.lineWidth = tomada === `c${i}` ? 2 : 1;
        g.beginPath();
        g.moveTo(x, 1);
        g.lineTo(x, 109);
        g.stroke();
        g.lineWidth = 1;
        g.fillStyle = C.acento;
        g.textAlign = 'left';
        if (cs.length <= 32 || i % 2 === 0) g.fillText(nombreNota(baja + i), Math.min(x + 2, 520), 10);
      });
      const x = Math.round(xf) + 0.5;
      g.strokeStyle = C.tinta;
      g.lineWidth = tomada === 'fin' ? 2 : 1;
      g.beginPath();
      g.moveTo(x, 1);
      g.lineTo(x, 109);
      g.stroke();
      g.lineWidth = 1;
      return;
    }
    // el loop, sombreado
    if (c.loop) {
      const a = xDe(marcaDe(c, 'lIni', dur), dur);
      const b = xDe(marcaDe(c, 'lFin', dur), dur);
      g.fillStyle = C.acento;
      g.globalAlpha = 0.15;
      g.fillRect(a, 1, b - a, 108);
      g.globalAlpha = 1;
    }
    // la onda
    pintarForma();
    // fuera de ini…fin, más tenue
    g.fillStyle = C.pantalla;
    g.globalAlpha = 0.6;
    g.fillRect(0, 1, xDe(marcaDe(c, 'ini', dur), dur), 108);
    const xf = xDe(marcaDe(c, 'fin', dur), dur);
    g.fillRect(xf, 1, 536 - xf, 108);
    g.globalAlpha = 1;
    // las marcas
    const rotulos = { ini: '▸', lIni: '[', lFin: ']', fin: '◂' };
    for (const k of MARCAS) {
      if ((k === 'lIni' || k === 'lFin') && !c.loop) continue;
      const x = Math.round(xDe(marcaDe(c, k, dur), dur)) + 0.5;
      g.strokeStyle = k === 'ini' || k === 'fin' ? C.tinta : C.acento;
      g.lineWidth = tomada === k ? 2 : 1;
      g.beginPath();
      g.moveTo(x, 1);
      g.lineTo(x, 109);
      g.stroke();
      g.lineWidth = 1;
      g.fillStyle = g.strokeStyle;
      g.textAlign = 'center';
      g.fillText(rotulos[k], entre(x, 6, 530), 12);
    }
  };
  // Un audio recién abierto en una zona de tajadas: se detectan los golpes solos.
  const asegurarCortes = () => {
    const z = zona();
    const c = capa();
    if (!z || !z.tajadas || !c || !c.m || Array.isArray(c.cortes) || !durDe()) return false;
    c.cortes = nodo.detectarGolpes(c.m, z.sens === undefined ? 50 : z.sens).map((x) => Math.round(x * 10000) / 10000);
    if (!c.cortes.length) c.cortes = [0];
    ajustarTajadas(z);
    return true;
  };
  const pintarTodo = () => {
    if (asegurarCortes()) {
      guardar();
      return pintarTodo();
    }
    const z = zona();
    const taj = !!(z && z.tajadas);
    titZona.textContent = z ? `${t('Zona')} ${zSel + 1}/${inst.zonas.length}${taj ? ` · ${t('Tajadas')}` : ''}` : t('Zonas');
    for (const x of [cBaja, cAlta, cRaiz, iGolpe]) x.el.style.opacity = z ? '' : '0.4';
    // En tajadas, el largo, la raíz y el golpe los pone el sampler; el loop y la altura no se usan.
    for (const x of [cAlta, cRaiz, iGolpe, iLoop, { el: altCaja }]) {
      x.el.style.opacity = taj || !z ? '0.4' : '';
      x.el.style.pointerEvents = taj ? 'none' : '';
    }
    filaTajadas.style.display = taj ? 'flex' : 'none';
    if (taj) pSens.poner(z.sens === undefined ? 50 : z.sens);
    if (z) {
      cBaja.poner(z.baja);
      cAlta.poner(z.alta);
      cRaiz.poner(z.raiz);
      iGolpe.poner(!!z.golpe);
    }
    botonesCapa.forEach((b, k) => {
      b.style.fontWeight = k === cSel ? 'bold' : '';
      b.style.background = z && z.capas[k] ? (k === cSel ? v('acento') : v('pantalla')) : 'transparent';
    });
    const c = capa();
    const mu = c && nodo.muestras[c.m];
    nombreAudio.textContent = mu ? `${mu.nombre}${mu.url ? '' : ` (${t('no queda guardado')})`}` : '';
    if (c) {
      iLoop.poner(!!c.loop);
      const alt = Array.isArray(c.alt) ? c.alt : [true, true, true];
      iAlt.forEach((x, k) => x.poner(alt[k] !== false));
      pGan.poner(Number(c.gan) || 0);
      pPan.poner(Number(c.pan) || 0);
      pAfin.poner(Number(c.afinar) || 0);
    }
    pintarTeclado();
    pintarOnda();
  };
  pintarTodo();

  // Lo que cambia por otro lado: el instrumento (otra ventana, un estado nuevo) y los parámetros.
  const quitar = nodo.alCambiar(() => {
    if (!tomada) {
      inst = copia(nodo.inst);
      if (zSel >= inst.zonas.length) zSel = inst.zonas.length - 1;
      if (zSel < 0 && inst.zonas.length) zSel = 0;
      const z = zona();
      if (z && cSel >= z.capas.length) cSel = 0;
    }
    pintarTodo();
  });
  let vigente = true;
  const reloj = setInterval(() => {
    if (!vigente) return;
    C = coloresDe(caja);
    void nodo.getParameterValues(false).then((vals) => {
      if (!vals || !vigente) return;
      for (const p of N.PARAMS) {
        const c = generales[p.id];
        if (vals[p.id] && !c.agarrada()) c.poner(Number(vals[p.id].value));
      }
    });
    if (!caja.isConnected && visto) soltar();
    if (caja.isConnected) visto = true;
  }, 500);
  let visto = false;
  const soltar = () => {
    if (!vigente) return;
    vigente = false;
    clearInterval(reloj);
    quitar();
  };
  caja._pzSoltar = soltar;
  return caja;
}
