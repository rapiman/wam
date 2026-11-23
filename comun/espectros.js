// LOS DOS ESPECTROS DE UN PLUGIN: cómo está el sonido al entrar (relleno) y cómo queda al salir
// (línea). Dos analizadores del navegador colgados del nodo: de su salida 0 (el sonido) y de su
// salida 1 (la entrada sin tocar, que ponen los nodos del molde). Sin salida 1, solo «cómo queda».
const PISO = -100; // dB: el espectro se dibuja entre esto…
const TECHO = -10; // …y esto
const entre = (x, a, b) => Math.min(b, Math.max(a, x));

// El eje de frecuencias de un gráfico de `W` px: de 20 Hz a 20 kHz, logarítmico.
export function ejeFrecuencias(W, fMin = 20, fMax = 20000) {
  return {
    X: (f) => (Math.log(f / fMin) / Math.log(fMax / fMin)) * W,
    FX: (x) => fMin * (fMax / fMin) ** (x / W),
  };
}

export function espectros(nodo) {
  const fm = nodo.context.sampleRate;
  const analizar = (salidaDelNodo) => {
    try {
      const an = new AnalyserNode(nodo.context, { fftSize: 4096, smoothingTimeConstant: 0.8 });
      nodo.connect(an, salidaDelNodo);
      return { an, datos: new Float32Array(an.frequencyBinCount), salidaDelNodo };
    } catch (e) {
      return null;
    }
  };
  const queda = analizar(0);
  const esta = nodo.numberOfOutputs > 1 ? analizar(1) : null;

  const trazo = (g, e, W, H, FX) => {
    e.an.getFloatFrequencyData(e.datos);
    const d = e.datos;
    const binHz = fm / e.an.fftSize;
    let hay = false;
    g.beginPath();
    for (let px = 0; px <= W; px++) {
      const pos = FX(px) / binHz;
      const i0 = Math.min(d.length - 2, Math.floor(pos));
      const i1 = Math.min(d.length - 1, Math.max(i0 + 1, Math.floor(FX(px + 1) / binHz)));
      let x;
      if (i1 === i0 + 1) x = d[i0] + (d[i1] - d[i0]) * (pos - i0);
      else {
        x = d[i0];
        for (let i = i0 + 1; i <= i1; i++) if (d[i] > x) x = d[i];
      }
      if (!(x > PISO)) x = PISO;
      else hay = true;
      const y = H - ((entre(x, PISO, TECHO) - PISO) / (TECHO - PISO)) * (H - 2);
      if (px === 0) g.moveTo(px, y);
      else g.lineTo(px, y);
    }
    return hay;
  };

  return {
    // Dibuja los dos espectros y su leyenda en un gráfico de W×H con el eje `FX` (px → Hz) y
    // los colores ya resueltos `C` (coloresDe).
    dibujar(g, W, H, C, FX) {
      let hayEsta = false;
      let hayQueda = false;
      if (esta && trazo(g, esta, W, H, FX)) {
        hayEsta = true;
        g.lineTo(W, H);
        g.lineTo(0, H);
        g.closePath();
        g.fillStyle = C.traza;
        g.globalAlpha = 0.6;
        g.fill();
        g.globalAlpha = 1;
      }
      if (queda && trazo(g, queda, W, H, FX)) {
        hayQueda = true;
        g.strokeStyle = C.tinta2;
        g.lineWidth = 1.25;
        g.stroke();
        g.lineWidth = 1;
      }
      if (!hayEsta && !hayQueda) return false;
      g.font = '11px system-ui, sans-serif';
      g.textBaseline = 'alphabetic';
      g.textAlign = 'right';
      g.fillStyle = C.tinta2;
      g.fillText('cómo queda', W - 6, 14);
      const a1 = W - 6 - g.measureText('cómo queda').width;
      g.strokeStyle = C.tinta2;
      g.lineWidth = 1.25;
      g.beginPath();
      g.moveTo(a1 - 18, 10.5);
      g.lineTo(a1 - 5, 10.5);
      g.stroke();
      g.lineWidth = 1;
      if (esta) {
        g.fillText('cómo está', a1 - 28, 14);
        const a2 = a1 - 28 - g.measureText('cómo está').width;
        g.fillStyle = C.traza;
        g.fillRect(a2 - 16, 6, 11, 9);
      }
      g.textAlign = 'left';
      return true;
    },
    // Si el anfitrión rearmó sus cables (desconectó todo y volvió a conectar), los analizadores
    // se vuelven a colgar; conectar dos veces lo mismo no hace nada.
    recolgar() {
      for (const e of [queda, esta]) {
        if (!e) continue;
        try {
          nodo.connect(e.an, e.salidaDelNodo);
        } catch (err) {
          // el nodo ya no existe
        }
      }
    },
    soltar() {
      for (const e of [queda, esta]) {
        if (!e) continue;
        try {
          nodo.disconnect(e.an);
        } catch (err) {
          // ya lo habían desconectado
        }
      }
    },
  };
}
