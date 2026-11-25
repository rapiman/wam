// EL CORAZÓN DEL SAMPLER (2026-11-24, JP: «me gustan las 3», piano con zonas, batería con una nota
// por sonido y tajadas; capas; «dónde parte la nota, loop y release, con o sin cambio de altura»).
//
// Solo cuentas: ni nodos del navegador ni nada de afuera. Así corre en el hilo de audio (va como
// texto con `mandarConFunciones`), se prueba con Node (`prueba.mjs`) y algún día se puede pasar a
// un plugin nativo (JP: «quizá armar todo para hacer un VST»).
//
// EL INSTRUMENTO (lo que el hilo principal manda con `ponerInstrumento`):
//   { zonas: [ZONA…] }
//   ZONA  = { baja, alta, raiz, golpe, tajadas, capas: [CAPA…] }   notas MIDI; hasta 3 capas
//           `golpe`: la nota dispara el sonido entero y soltarla no hace nada (batería, tajadas)
//   CAPA  = { m, ini, lIni, lFin, fin, loop, alt: [a, l, r], gan, pan, afinar, cortes }
//           `m`: qué muestra; `ini…fin` en SEGUNDOS de la muestra: dónde parte la nota (ini), el
//           tramo que se repite mientras se sostiene (lIni…lFin, si `loop`) y hasta dónde suena
//           al soltar (fin). Las tres partes: la de entrada (ini…lIni), la del loop y la del
//           release (lFin…fin). `alt[k]`: si esa parte sigue la altura de la nota (si no, suena a
//           la altura de la muestra). `gan` en dB, `pan` −1…1, `afinar` en semitonos.
// Las muestras llegan aparte (`ponerMuestra`), como canales Float32Array con su frecuencia.
//
// TAJADAS (paso 2): una ZONA con `tajadas: true` reparte un audio en las teclas. Cada CAPA lleva
// `cortes` (dónde empieza cada tajada, en segundos, en orden): la nota `baja + i` toca la tajada i,
// desde `cortes[i]` hasta el corte que sigue (la última, hasta `fin`). Suena entera como un golpe,
// a la altura de la muestra (solo la afinación la mueve), con un fundido de 2 ms en cada borde
// para que no haga clic.
//
// FILTRO, COLOR Y VAIVENES (paso 3; JP: «distorsión, efectos sencillos, noise para agregarle
// cuerpo, detune», «osc modulación al pitch, al volumen, al efecto o al filtro», y un sub):
//   - Cada voz pasa por su FILTRO (variable de estado, 12 dB/oct: pasa bajos, altos o banda), con
//     su envolvente propia (sube en «ataque del filtro», cae a cero en «caída del filtro») que
//     mueve el corte hasta ±8 octavas.
//   - Antes del filtro, cada voz suma RUIDO blanco y un SUB (seno o cuadrada una o dos octavas bajo
//     la nota). El DESAFINADO lee cada capa con dos cabezas, una por oreja, separadas en centésimas.
//   - La DISTORSIÓN (tanh) va al final, sobre todo lo que suena, con su mezcla.
//   - Dos VAIVENES (osciladores lentos: seno, triángulo, cuadrada, sierra o azar) que van a la
//     altura, al volumen, al corte del filtro, a la distorsión o al paneo.
//
// OSCILADORES (paso 5; JP: «formas clásicas y samplers»): una CAPA puede ser, en vez de un audio,
// un oscilador: `osc: { forma, ancho }` (forma 0 seno, 1 triángulo, 2 sierra, 3 cuadrada; `ancho`
// del pulso de la cuadrada, 5…95 %). Siempre sigue la altura de la nota; sierra y cuadrada sin
// el zumbido de lo que se dobla (polyBLEP). Suena mientras dure la envolvente; en una zona de golpe
// cae a cero en el «decaimiento» (si no, no se apagaría nunca).
//
// EL LARGO QUE NO CAMBIA CON LA ALTURA (2026-11-25, JP: «mantener el pitch y el largo»): una capa
// puede traer `var: { [nota]: { m, ini, lIni, lFin, fin } }`, una muestra estirada por el nodo para
// cada nota, de modo que al tocarla a la altura de esa nota dure lo pedido. Una nota sin su versión
// (todavía calculándose) suena como siempre.
//
// CADA CAPA MOLDEA SU SONIDO, COMO LOS OSCILADORES DEL KORG M1 (2026-11-25, JP: «copiarle los VDA,
// VDF, envelope… y revisar su manera de moldear el sonido», «todo, que quede bien complejo»).
// La capa 1, 2 o 3 de cada zona es como el oscilador 1, 2 o 3: lo que es del audio (la muestra,
// las marcas, su volumen y paneo) va en la zona; lo que moldea el sonido va en parámetros de la
// capa (`c1…`, `c2…`, `c3…`), iguales para todas las zonas, y todos se automatizan:
//   - VOLUMEN (el VDA): envolvente de seis tramos — ataque hasta el nivel de ataque, decaimiento
//     hasta el punto de quiebre, pendiente hasta el sostenido, soltado hasta cero —, sensibilidad a
//     la intensidad, y cuánto la intensidad y la tecla alargan o acortan cada tiempo (+, x, −).
//   - FILTRO (el VDF): tipo, corte, resonancia, y su envolvente de ocho tramos (nivel inicial,
//     ataque, nivel de ataque, decaimiento, quiebre, pendiente, sostenido, soltado y nivel final;
//     los niveles van de −100 a 100 % de la «intensidad», en octavas). La intensidad de la nota
//     cambia la intensidad y los tiempos; la tecla mueve el corte y los tiempos.
//   - ALTURA (la Pitch EG): nivel inicial, ataque, nivel de ataque, decaimiento hasta la altura
//     justa, soltado hasta el nivel final; por la intensidad, más o menos honda y más o menos lenta.
//   - Nivel, afinación y retardo de entrada de la capa.
// Lo general: volumen y afinación, y un ataque, decaimiento y soltado que se suman a los de todas
// las envolventes (como los del M1), el color y los dos vaivenes.
//
// EL SOPLO (2026-11-25, JP, tomando la manera del Yamaha VL70-m como una parte del moldeado y no
// como otro instrumento: «esas desafinaciones como de flauta cuando entre más aire, muy tarka o
// pifilkas o trutrucas o trompetas»). Una CAPA puede ser, en vez de un audio o un oscilador, un
// modelo físico (`mod: {}`): un tubo (una línea de retardo con sus pérdidas) excitado por
//   - un BISEL (el chorro de aire contra un filo: tarka, quena, pifilka, flautas): con más aire la
//     nota sube y, pasado el «salto», brinca al armónico de arriba; extremo abierto o cerrado;
//     DOBLE FONDO: un segundo tubo más hondo que entra con la fuerza (la pifilka);
//   - LABIOS (trutruka, trompeta): el tubo sigue la nota (trompeta, pistones) o queda FIJO y los
//     labios —la tecla, la embocadura y el aire— eligen el armónico (trutruka, cuerno);
//   - una CAÑA con tubo recto (clarinete) o cónico (saxo).
// Los modelos son los de la Synthesis ToolKit de Perry Cook y Gary Scavone (flauta, metal,
// clarinete, saxofón), retocados: la saturación de los labios es suave para que no se ahogue.
// La envolvente de volumen de la capa es el SOPLO (la presión): el sonido no se multiplica por ella,
// sale del tubo. El aire es «Aire» × la intensidad de la nota × (si se elige) la rueda, el
// controlador de aliento, la expresión o el aftertouch.
// MODIFICADORES por capa, para cualquier fuente (como los del VL): realce de armónicos (el sonido
// modula en fase un seno a una razón de la nota), resonador (un retardo realimentado afinado a la
// nota) y cuerpo (tres resonancias de madera, campana o caja).

export function nucleoSampler() {
  const TIPOS_FILTRO = ['Apagado', 'Pasa bajos', 'Pasa altos', 'Pasa banda'];
  const FORMAS = ['Seno', 'Triángulo', 'Cuadrada', 'Sierra', 'Azar'];
  const DESTINOS = ['Altura', 'Volumen', 'Filtro', 'Distorsión', 'Paneo'];
  const POLARIDAD = ['+', 'x', '−'];
  const MODELOS = ['Bisel', 'Labios', 'Caña'];
  const FUENTES_AIRE = ['Intensidad', 'Rueda', 'Aliento', 'Expresión', 'Aftertouch'];
  const CUERPOS = ['Madera', 'Campana', 'Caja'];
  const TRAMOS = [
    ['A', 'Ataque'],
    ['D', 'Decaimiento'],
    ['S', 'Pendiente'],
    ['R', 'Soltado'],
  ];
  // `grupo` y `sub`: dónde los pone la carátula; `corto`: su nombre ahí; `angosto`: una lista que
  // cabe en un lugar.
  const vaiven = (k) => [
    { id: `l${k}f`, nombre: `Forma del vaivén ${k}`, corto: 'Forma', grupo: `v${k}`, tipo: 'choice', opciones: FORMAS, defecto: 0, min: 0, max: FORMAS.length - 1 },
    { id: `l${k}v`, nombre: `Velocidad del vaivén ${k}`, corto: 'Velocidad', grupo: `v${k}`, min: 0.05, max: 30, defecto: 2, unidad: 'Hz', paso: 0.01, dec: 2, log: true },
    { id: `l${k}p`, nombre: `Profundidad del vaivén ${k}`, corto: 'Profundidad', grupo: `v${k}`, min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: `l${k}d`, nombre: `Destino del vaivén ${k}`, corto: 'Destino', grupo: `v${k}`, tipo: 'choice', opciones: DESTINOS, defecto: k === 1 ? 0 : 2, min: 0, max: DESTINOS.length - 1 },
  ];
  const tiempo = (defecto) => ({ min: 0.5, max: 10000, defecto, unidad: 'ms', paso: 0.1, dec: 1, log: true });
  const nivel = (defecto, bipolar) => ({ min: bipolar ? -100 : 0, max: 100, defecto, unidad: '%', paso: 1 });
  const polaridades = (k, pre, sub, que) =>
    TRAMOS.map(([L, nom]) => ({
      id: `c${k}${pre}${L}`,
      nombre: `${que}: ${nom}`,
      corto: L,
      sub,
      tipo: 'choice',
      opciones: POLARIDAD,
      defecto: 0,
      min: 0,
      max: 2,
      angosto: true,
    }));
  const capa = (k) => {
    const P = (lista, grupo) => lista.map((p) => ({ ...p, id: p.id.startsWith(`c${k}`) ? p.id : `c${k}${p.id}`, nombre: `Capa ${k}: ${p.nombre}`, grupo: `c${k}${grupo}` }));
    return [
      ...P(
        [
          { id: 'niv', nombre: 'Nivel', sub: 'capa', min: -40, max: 12, defecto: 0, unidad: 'dB', paso: 0.1, dec: 1 },
          { id: 'afi', nombre: 'Afinación', sub: 'capa', min: -24, max: 24, defecto: 0, unidad: 'st', paso: 0.01, dec: 2 },
          { id: 'ret', nombre: 'Retardo de entrada', corto: 'Retardo', sub: 'capa', min: 0, max: 2000, defecto: 0, unidad: 'ms', paso: 1 },
          { id: 'vat', nombre: 'Ataque del volumen', corto: 'Ataque', sub: 'env', ...tiempo(2) },
          { id: 'val', nombre: 'Nivel de ataque del volumen', corto: 'Cima', sub: 'env', ...nivel(100) },
          { id: 'vdt', nombre: 'Decaimiento del volumen', corto: 'Decaimiento', sub: 'env', ...tiempo(300) },
          { id: 'vbp', nombre: 'Quiebre del volumen', corto: 'Quiebre', sub: 'env', ...nivel(100) },
          { id: 'vst', nombre: 'Pendiente del volumen', corto: 'Pendiente', sub: 'env', ...tiempo(300) },
          { id: 'vsl', nombre: 'Sostenido del volumen', corto: 'Sostenido', sub: 'env', ...nivel(100) },
          { id: 'vrt', nombre: 'Soltado del volumen', corto: 'Soltado', sub: 'env', ...tiempo(200) },
          { id: 'vvs', nombre: 'Sensibilidad del volumen', corto: 'Sensibilidad', sub: 'vel', min: 0, max: 100, defecto: 70, unidad: '%', paso: 1 },
          { id: 'vvt', nombre: 'Tiempos del volumen por intensidad', corto: 'Tiempo', sub: 'vel', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          ...polaridades(k, 'vvp', 'vel', 'Intensidad en los tiempos del volumen'),
          { id: 'vkt', nombre: 'Tiempos del volumen por tecla', corto: 'Tiempo', sub: 'tec', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          ...polaridades(k, 'vkp', 'tec', 'Tecla en los tiempos del volumen'),
        ],
        'vol',
      ),
      ...P(
        [
          { id: 'ft', nombre: 'Tipo de filtro', corto: 'Tipo', sub: 'capa', tipo: 'choice', opciones: TIPOS_FILTRO, defecto: 0, min: 0, max: 3 },
          { id: 'fc', nombre: 'Corte', sub: 'capa', min: 20, max: 20000, defecto: 2000, unidad: 'Hz', paso: 1, log: true },
          { id: 'fr', nombre: 'Resonancia', sub: 'capa', min: 0, max: 100, defecto: 10, unidad: '%', paso: 1 },
          { id: 'fi', nombre: 'Intensidad del filtro', corto: 'Intensidad', sub: 'capa', min: -8, max: 8, defecto: 0, unidad: 'oct', paso: 0.05, dec: 2 },
          { id: 'fl0', nombre: 'Nivel inicial del filtro', corto: 'Inicio', sub: 'env', ...nivel(0, true) },
          { id: 'fat', nombre: 'Ataque del filtro', corto: 'Ataque', sub: 'env', ...tiempo(2) },
          { id: 'fal', nombre: 'Nivel de ataque del filtro', corto: 'Cima', sub: 'env', ...nivel(100, true) },
          { id: 'fdt', nombre: 'Decaimiento del filtro', corto: 'Decaimiento', sub: 'env', ...tiempo(300) },
          { id: 'fbp', nombre: 'Quiebre del filtro', corto: 'Quiebre', sub: 'env', ...nivel(50, true) },
          { id: 'fst', nombre: 'Pendiente del filtro', corto: 'Pendiente', sub: 'env', ...tiempo(600) },
          { id: 'fsl', nombre: 'Sostenido del filtro', corto: 'Sostenido', sub: 'env', ...nivel(0, true) },
          { id: 'frt', nombre: 'Soltado del filtro', corto: 'Soltado', sub: 'env', ...tiempo(200) },
          { id: 'frl', nombre: 'Nivel final del filtro', corto: 'Final', sub: 'env', ...nivel(0, true) },
          { id: 'fvi', nombre: 'Intensidad del filtro por intensidad', corto: 'Intensidad', sub: 'vel', min: -100, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'fvt', nombre: 'Tiempos del filtro por intensidad', corto: 'Tiempo', sub: 'vel', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          ...polaridades(k, 'fvp', 'vel', 'Intensidad en los tiempos del filtro'),
          { id: 'fkc', nombre: 'Corte por tecla', corto: 'Corte', sub: 'tec', min: -200, max: 200, defecto: 0, unidad: '%', paso: 1 },
          { id: 'fkt', nombre: 'Tiempos del filtro por tecla', corto: 'Tiempo', sub: 'tec', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          ...polaridades(k, 'fkp', 'tec', 'Tecla en los tiempos del filtro'),
        ],
        'fil',
      ),
      ...P(
        [
          { id: 'pi', nombre: 'Intensidad de la altura', corto: 'Intensidad', sub: 'capa', min: 0, max: 24, defecto: 12, unidad: 'st', paso: 0.01, dec: 2 },
          { id: 'pl0', nombre: 'Nivel inicial de la altura', corto: 'Inicio', sub: 'env', ...nivel(0, true) },
          { id: 'pat', nombre: 'Ataque de la altura', corto: 'Ataque', sub: 'env', ...tiempo(2) },
          { id: 'pal', nombre: 'Nivel de ataque de la altura', corto: 'Cima', sub: 'env', ...nivel(0, true) },
          { id: 'pdt', nombre: 'Decaimiento de la altura', corto: 'Decaimiento', sub: 'env', ...tiempo(100) },
          { id: 'prt', nombre: 'Soltado de la altura', corto: 'Soltado', sub: 'env', ...tiempo(200) },
          { id: 'prl', nombre: 'Nivel final de la altura', corto: 'Final', sub: 'env', ...nivel(0, true) },
          { id: 'pvi', nombre: 'Intensidad de la altura por intensidad', corto: 'Intensidad', sub: 'vel', min: -100, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'pvt', nombre: 'Tiempos de la altura por intensidad', corto: 'Tiempo', sub: 'vel', min: -100, max: 100, defecto: 0, unidad: '%', paso: 1 },
        ],
        'alt',
      ),
      ...P(
        [
          { id: 'smt', nombre: 'Modelo', sub: 'sop1', tipo: 'choice', opciones: MODELOS, defecto: 0, min: 0, max: 2 },
          { id: 'sex', nombre: 'Extremo del tubo', corto: 'Extremo', sub: 'sop1', solo: [0], tipo: 'choice', opciones: ['Abierto', 'Cerrado'], defecto: 0, min: 0, max: 1 },
          { id: 'sfo', nombre: 'Tubo de la caña', corto: 'Tubo de la caña', sub: 'sop1', solo: [2], tipo: 'choice', opciones: ['Recto', 'Cónico'], defecto: 0, min: 0, max: 1 },
          { id: 'stb', nombre: 'Largo del tubo', corto: 'Largo', sub: 'sop1', solo: [1], tipo: 'choice', opciones: ['Sigue la nota', 'Fijo'], defecto: 0, min: 0, max: 1 },
          { id: 'stn', nombre: 'Nota del tubo', sub: 'sop1', solo: [1], nota: true, min: 24, max: 96, defecto: 36, paso: 1 },
          { id: 'sgm', nombre: 'Forma del tubo', corto: 'Forma', sub: 'sop1', solo: [1], tipo: 'choice', opciones: ['Simple', 'Con medidas'], defecto: 0, min: 0, max: 1 },
          { id: 'slm', nombre: 'Largo desde', sub: 'sop1', solo: [1], tipo: 'choice', opciones: ['La nota', 'El largo'], defecto: 0, min: 0, max: 1 },
          { id: 'slc', nombre: 'Largo del tubo recto', corto: 'Largo', sub: 'sop1', solo: [1], min: 5, max: 800, defecto: 400, unidad: 'cm', paso: 0.5, dec: 1 },
          { id: 'sdc', nombre: 'Diámetro del tubo', corto: 'Diámetro', sub: 'sop1', solo: [1], min: 3, max: 40, defecto: 20, unidad: 'mm', paso: 0.5, dec: 1 },
          { id: 'slh', nombre: 'Largo del cacho', sub: 'sop1', solo: [1], min: 0, max: 80, defecto: 35, unidad: 'cm', paso: 0.5, dec: 1 },
          { id: 'sdh', nombre: 'Boca del cacho', sub: 'sop1', solo: [1], min: 5, max: 200, defecto: 90, unidad: 'mm', paso: 1 },
          { id: 'sfh', nombre: 'Curva del cacho', corto: 'Curva', sub: 'sop1', solo: [1], min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
          { id: 'sen', nombre: 'Enrollado', sub: 'sop1', solo: [1], tipo: 'choice', opciones: ['Recto', 'Espiral', 'Óvalo'], defecto: 0, min: 0, max: 2 },
          { id: 'svu', nombre: 'Vueltas', sub: 'sop1', solo: [1], min: 1, max: 12, defecto: 3, paso: 1 },
          { id: 'ssn', nombre: 'Sentido del aire', corto: 'Aire', sub: 'sop1', solo: [1], tipo: 'choice', opciones: ['Soplado', 'Aspirado'], defecto: 0, min: 0, max: 1 },
          { id: 'stf', nombre: 'Afinación del tubo', corto: 'Afinación', sub: 'sop1', solo: [1], min: -100, max: 100, defecto: 0, unidad: 'ct', paso: 1 },
          { id: 'sai', nombre: 'Aire', sub: 'sop2', min: 0, max: 100, defecto: 60, unidad: '%', paso: 1 },
          { id: 'sem', nombre: 'Embocadura', sub: 'sop2', min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
          { id: 'sru', nombre: 'Ruido de aliento', corto: 'Aliento', sub: 'sop2', min: 0, max: 100, defecto: 15, unidad: '%', paso: 1 },
          { id: 'ssu', nombre: 'Subida con el aire', corto: 'Subida', sub: 'sop2', min: 0, max: 100, defecto: 20, unidad: 'ct', paso: 1 },
          { id: 'sds', nombre: 'Desvío al sostener', corto: 'Desvío', sub: 'sop2', min: -100, max: 100, defecto: 0, unidad: 'ct', paso: 1 },
          { id: 'sdt', nombre: 'Tiempo del desvío', corto: 'Tiempo', sub: 'sop2', ...tiempo(300) },
          { id: 'sdx', nombre: 'Desvío al final', corto: 'Al final', sub: 'sop2', min: -200, max: 200, defecto: 0, unidad: 'ct', paso: 1 },
          { id: 'sin', nombre: 'Inestabilidad', sub: 'sop2', min: 0, max: 50, defecto: 0, unidad: 'ct', paso: 1 },
          { id: 'siv', nombre: 'Velocidad de la inestabilidad', corto: 'Velocidad', sub: 'sop2', min: 0.5, max: 15, defecto: 5, unidad: 'Hz', paso: 0.1, dec: 1 },
          { id: 'ssa', nombre: 'Salto', sub: 'sop2', min: 0, max: 100, defecto: 70, unidad: '%', paso: 1 },
          { id: 'sas', nombre: 'Aspereza', sub: 'sop2', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'sgr', nombre: 'Gruñido', sub: 'sop2', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'sgi', nombre: 'Grito', sub: 'sop3', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'sap', nombre: 'Apagado', sub: 'sop3', min: 0, max: 100, defecto: 30, unidad: '%', paso: 1 },
          { id: 'sca', nombre: 'Campana', sub: 'sop3', solo: [1], min: 0, max: 100, defecto: 30, unidad: '%', paso: 1 },
          { id: 'stc', nombre: 'Tercer parcial', corto: 'Tercero', sub: 'sop3', solo: [1], min: -30, max: 12, defecto: -10, unidad: 'dB', paso: 0.5, dec: 1 },
          { id: 'sdf', nombre: 'Doble fondo', sub: 'sop3', solo: [0], min: 0, max: 1200, defecto: 0, unidad: 'ct', paso: 1 },
          { id: 'sde', nombre: 'Entrada del fondo', corto: 'Entrada', sub: 'sop3', solo: [0], min: 0, max: 100, defecto: 50, unidad: '%', paso: 1 },
          { id: 'sfa', nombre: 'Fuente del aire', corto: 'Aire desde', sub: 'sop3', tipo: 'choice', opciones: FUENTES_AIRE, defecto: 0, min: 0, max: FUENTES_AIRE.length - 1 },
        ],
        'sop',
      ),
      ...P(
        [
          { id: 'mhm', nombre: 'Realce de armónicos', corto: 'Realce', sub: 'mdf1', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'mhi', nombre: 'Índice del realce', corto: 'Índice', sub: 'mdf1', min: 0, max: 100, defecto: 30, unidad: '%', paso: 1 },
          { id: 'mhz', nombre: 'Razón del realce', corto: 'Razón', sub: 'mdf1', min: 0.5, max: 8, defecto: 2, paso: 0.01, dec: 2 },
          { id: 'mrm', nombre: 'Resonador', sub: 'mdf2', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'mrf', nombre: 'Realimentación del resonador', corto: 'Realimentación', sub: 'mdf2', min: 0, max: 99, defecto: 70, unidad: '%', paso: 1 },
          { id: 'mrz', nombre: 'Razón del resonador', corto: 'Razón', sub: 'mdf2', min: 0.25, max: 4, defecto: 1, paso: 0.01, dec: 2 },
          { id: 'mcm', nombre: 'Cuerpo', sub: 'mdf3', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
          { id: 'mct', nombre: 'Tamaño del cuerpo', corto: 'Tamaño', sub: 'mdf3', min: 0.5, max: 2, defecto: 1, paso: 0.01, dec: 2 },
          { id: 'mcy', nombre: 'Tipo de cuerpo', corto: 'Tipo', sub: 'mdf3', tipo: 'choice', opciones: CUERPOS, defecto: 0, min: 0, max: CUERPOS.length - 1 },
        ],
        'mdf',
      ),
    ];
  };
  const PARAMS = [
    { id: 'vol', nombre: 'Volumen', grupo: 'general', min: -60, max: 6, defecto: 0, unidad: 'dB', paso: 0.1, dec: 1 },
    { id: 'afinar', nombre: 'Afinación', grupo: 'general', min: -24, max: 24, defecto: 0, unidad: 'st', paso: 0.01, dec: 2 },
    { id: 'gat', nombre: 'Ataque general', corto: 'Ataque', grupo: 'general', min: -50, max: 50, defecto: 0, paso: 1 },
    { id: 'gdt', nombre: 'Decaimiento general', corto: 'Decaimiento', grupo: 'general', min: -50, max: 50, defecto: 0, paso: 1 },
    { id: 'grt', nombre: 'Soltado general', corto: 'Soltado', grupo: 'general', min: -50, max: 50, defecto: 0, paso: 1 },
    { id: 'dist', nombre: 'Distorsión', grupo: 'color', min: 0, max: 36, defecto: 0, unidad: 'dB', paso: 0.5, dec: 1 },
    { id: 'dmez', nombre: 'Mezcla de la distorsión', corto: 'Mezcla', grupo: 'color', min: 0, max: 100, defecto: 100, unidad: '%', paso: 1 },
    { id: 'ruido', nombre: 'Ruido', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: 'desaf', nombre: 'Desafinado', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: 'ct', paso: 1 },
    { id: 'sub', nombre: 'Sub', grupo: 'color', min: 0, max: 100, defecto: 0, unidad: '%', paso: 1 },
    { id: 'subOct', nombre: 'Octava del sub', corto: 'Octava', grupo: 'color', tipo: 'choice', opciones: ['−1', '−2'], defecto: 0, min: 0, max: 1 },
    { id: 'subForma', nombre: 'Forma del sub', corto: 'Forma', grupo: 'color', tipo: 'choice', opciones: ['Seno', 'Cuadrada'], defecto: 0, min: 0, max: 1 },
    ...vaiven(1),
    ...vaiven(2),
    ...capa(1),
    ...capa(2),
    ...capa(3),
  ];
  const VOCES = 32;
  const CRUCE_S = 0.004; // el loop se junta con un fundido de 4 ms, para que no haga clic
  const AHOGO_S = 0.006; // una voz robada o ahogada se apaga en 6 ms
  const BORDE_S = 0.002; // los bordes de una tajada se funden en 2 ms
  const CADA = 16; // cada cuántas muestras se recalculan el filtro y la altura de una capa
  const dB = (x) => Math.pow(10, x / 20);
  const val = (p, id, def) => (p[id] === undefined ? def : p[id]);
  // Cuánto multiplica un tiempo: «+» alarga con más intensidad (o más aguda), «−» acorta, «x» nada.
  const POL = [1, 0, -1];
  const porTiempo = (pol, cant, x) => Math.pow(2, POL[Math.round(pol)] * cant * x * 3);

  // --- EL TUBO CON MEDIDAS (2026-11-25, JP: «se puede definir el largo, el diámetro y también el
  // cono y su diámetro final, y si va enrollado»). Un tubo recto (dos líneas de retardo, ida y
  // vuelta) y un cacho hecho de tajadas de una muestra de largo que se reflejan entre sí por el
  // cambio de área (Kelly-Lochbaum); en la boca del cacho, lo grave se refleja y lo agudo sale. Las
  // pérdidas en las paredes van con el diámetro (≈ 3·10⁻⁵ √f / radio por metro). Enrollado: casi no
  // cambia el sonido, como en un tubo de verdad (una pérdida muy chica por las vueltas).
  const C_AIRE = 343;
  const MAXH = 256;
  const cacheGeo = new Map();
  const geometria = (g, fm) => {
    const clave = `${g.sdc}|${g.slh}|${g.sdh}|${g.sfh}|${g.sen}|${g.svu}|${fm}`;
    let G = cacheGeo.get(clave);
    if (G) return G;
    const rc = Math.max(0.0015, g.sdc / 2000);
    const Lh = Math.max(0, g.slh / 100);
    const rb = Math.max(rc, g.sdh / 2000);
    const gam = 1 + (3 * g.sfh) / 100;
    const M = Math.min(MAXH, Math.round((Lh * fm) / C_AIRE));
    const A = new Float64Array(M + 1);
    A[0] = rc * rc;
    let rMed = 0;
    for (let i = 0; i < M; i++) {
      const r = rc + (rb - rc) * Math.pow((i + 0.5) / M, gam);
      A[i + 1] = r * r;
      rMed += r / M;
    }
    const K = new Float64Array(Math.max(1, M));
    for (let i = 0; i < M; i++) K[i] = (A[i] - A[i + 1]) / (A[i] + A[i + 1]);
    const rBoca = M > 0 ? Math.sqrt(A[M]) : rc;
    const fcB = Math.min(0.4 * fm, (1.2 * C_AIRE) / (2 * Math.PI * rBoca));
    const vueltas = g.sen >= 0.5 ? g.svu : 0;
    G = { M, K, rc, Lh, rMed: rMed || rc, pB: Math.exp((-2 * Math.PI * fcB) / fm), enrollado: 1 - vueltas * (g.sen >= 1.5 ? 0.006 : 0.004), picos: new Map() };
    if (cacheGeo.size > 64) cacheGeo.clear();
    cacheGeo.set(clave, G);
    return G;
  };
  // Lo que vuelve del cacho (con la boca) para una onda que entra, en θ = 2πf/fm: [re, im].
  const respuestaCacho = (G, th) => {
    const cr = Math.cos(th);
    const ci = -Math.sin(th);
    // la boca: −0,99 · paso bajo
    let dr = 1 - G.pB * cr;
    let di = -G.pB * ci;
    let d2 = dr * dr + di * di;
    let Rr = (-0.99 * (1 - G.pB) * dr) / d2;
    let Ri = (0.99 * (1 - G.pB) * di) / d2;
    const c2 = Math.cos(2 * th);
    const s2 = -Math.sin(2 * th);
    for (let i = G.M; i >= 1; i--) {
      const tr = Rr * c2 - Ri * s2;
      const ti = Rr * s2 + Ri * c2;
      const k = G.K[i - 1];
      // (k + R) / (1 + k·R)
      const nr = k + tr;
      const ni = ti;
      dr = 1 + k * tr;
      di = k * ti;
      d2 = dr * dr + di * di;
      Rr = (nr * dr + ni * di) / d2;
      Ri = (ni * dr - nr * di) / d2;
    }
    return [Rr, Ri];
  };
  // Las pérdidas de ida y vuelta como un paso bajo de un polo: { g0, p }.
  const perdidas = (G, Lc, fm) => {
    const Kp = 2.96e-5 * 2 * (Lc / G.rc + G.Lh / G.rMed);
    const gf = (f) => Math.exp(-Kp * Math.sqrt(f)) * G.enrollado;
    const f2 = Math.min(1500, 0.2 * fm);
    const g0 = gf(30);
    const rho = Math.min(0.9999, gf(f2) / g0);
    const th = (2 * Math.PI * f2) / fm;
    const a = 1 - rho * rho;
    const b = 1 - rho * rho * Math.cos(th);
    const p = a < 1e-9 ? 0 : (b - Math.sqrt(Math.max(0, b * b - a * a))) / a;
    return { g0, p };
  };
  const fasePerdida = (p, th) => -Math.atan2(p * Math.sin(th), 1 - p * Math.cos(th));
  // El largo del tubo recto (en muestras, cada sentido) para que una resonancia caiga en `f`,
  // el más cercano a `N0`.
  const largoPara = (G, f, N0, fm, extra = 0) => {
    const th = (2 * Math.PI * f) / fm;
    const [Rr, Ri] = respuestaCacho(G, th);
    const L = perdidas(G, (Math.max(2, N0) * C_AIRE) / fm, fm);
    const fi = Math.atan2(Ri, Rr) + fasePerdida(L.p, th) + Math.PI + extra;
    let m = Math.round((2 * th * N0 - fi) / (2 * Math.PI));
    let N = (fi + 2 * Math.PI * m) / (2 * th);
    while (N < 2) N += Math.PI / th;
    return N;
  };
  // El tubo recto cortado para que tubo y labio juntos suenen en `meta` (la resonancia `k`,
  // separadas por `paso`; el labio afinado en `fL`): se suma la fase del resonador del labio y lo
  // que igual queda alto (medido: unas 8 centésimas, más en los armónicos bajos; aspirado, con el
  // labio abajo de la nota, unas 65 bajo).
  const cortarTubo = (G, meta, k, paso, fL, aspira, fm) => {
    const N0 = fm / (2 * paso) - G.M;
    const th = (2 * Math.PI * meta) / fm;
    const wL = (2 * Math.PI * Math.min(0.2 * fm, fL)) / fm;
    const rr = 1 - (Math.PI * 0.6 * paso) / fm;
    const a1 = -2 * rr * Math.cos(wL);
    const a2 = rr * rr;
    const fLab = -Math.atan2(-(a1 * Math.sin(th) + a2 * Math.sin(2 * th)), 1 + a1 * Math.cos(th) + a2 * Math.cos(2 * th));
    const resto = Math.pow(2, (-(8 + 90 / (k * k)) + (aspira ? 65 : 0)) / 1200);
    return largoPara(G, meta * resto, N0, fm, -fLab);
  };
  // Las resonancias del tubo entero (picos de la impedancia en la boquilla), hasta 3 kHz.
  const resonancias = (G, Nc, fm) => {
    const clave = Math.round(Nc * 100);
    let P = G.picos.get(clave);
    if (P) return P;
    const L = perdidas(G, (Nc * C_AIRE) / fm, fm);
    const fmax = Math.min(3000, 0.3 * fm);
    const z = [];
    for (let f = 15; f <= fmax; f += 1) {
      const th = (2 * Math.PI * f) / fm;
      let [Rr, Ri] = respuestaCacho(G, th);
      // por el tubo recto y las pérdidas
      const fase = -2 * th * Nc + fasePerdida(L.p, th);
      const mag = L.g0 * (1 - L.p) / Math.hypot(1 - L.p * Math.cos(th), L.p * Math.sin(th));
      const cr = Math.cos(fase) * mag;
      const ci = Math.sin(fase) * mag;
      const r = -(Rr * cr - Ri * ci);
      const i = -(Rr * ci + Ri * cr);
      // |Z| = |1 + R| / |1 − R|
      z.push(Math.hypot(1 + r, i) / Math.max(1e-9, Math.hypot(1 - r, i)));
    }
    P = [];
    for (let j = 1; j < z.length - 1; j++)
      if (z[j] > z[j - 1] && z[j] >= z[j + 1] && z[j] > 2) {
        const d = z[j - 1] - 2 * z[j] + z[j + 1];
        P.push(15 + j + (d < 0 ? (0.5 * (z[j - 1] - z[j + 1])) / d : 0));
      }
    if (G.picos.size > 32) G.picos.clear();
    G.picos.set(clave, P);
    return P;
  };
  // Para la carátula: con «Largo desde la nota», el largo del tubo recto que resulta (cm); con
  // «el largo», la nota del tubo (Hz: la distancia entre sus resonancias).
  const medidaTubo = (g, fm = 48000) => {
    const G = geometria(g, fm);
    if (g.slm >= 0.5) {
      const Nc = ((g.slc / 100) * fm) / C_AIRE;
      const P = resonancias(G, Nc, fm);
      // la nota del tubo: lo que suena en su 6.ª resonancia (el labio la sube ≈ un quinto de la
      // distancia entre resonancias), dividido por 6
      if (P.length < 7) return { hz: 0, cm: g.slc };
      const paso = (P[3] - P[1]) / 2;
      return { hz: (P[5] + 0.21 * paso) / 6, cm: g.slc };
    }
    const fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100) / 12);
    const Nc = cortarTubo(G, 6 * fT, 6, fT, 6 * fT, g.ssn >= 0.5, fm);
    return { hz: fT, cm: ((Nc * C_AIRE) / fm) * 100 };
  };

  function crear(fm) {
    const muestras = new Map(); // m → { c: Float32Array[], fm }
    let zonas = [];
    const voces = [];
    let orden = 0;
    // los vaivenes: su fase y, en «azar», el valor que sostienen
    const lfo = [
      { fase: 0, azar: 0 },
      { fase: 0, azar: 0 },
    ];
    let semilla = 22222;
    const azar = () => {
      semilla = (semilla * 1664525 + 1013904223) >>> 0;
      return semilla / 2147483648 - 1;
    };
    // lo que dicen los vaivenes en cada muestra del bloque
    let mVol = new Float32Array(128);
    let mFil = new Float32Array(128);
    let mDis = new Float32Array(128);
    let mPan = new Float32Array(128);

    // `tajada`: el número de tajada que toca (en una zona de tajadas), o −1. `nota`: con una
    // versión propia de esa nota (`var[nota]`, la que estira el nodo para que el largo no cambie
    // con la altura), esa.
    const prepararCapa = (c0, tajada = -1, nota = -1) => {
      const c = tajada < 0 && c0.var && c0.var[nota] ? { ...c0, ...c0.var[nota] } : c0;
      if (c.mod && typeof c.mod === 'object') {
        const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
        const ang = ((pan + 1) * Math.PI) / 4;
        return {
          mod: true,
          gL: dB(Number(c.gan) || 0) * Math.cos(ang),
          gR: dB(Number(c.gan) || 0) * Math.sin(ang),
          afinar: Number(c.afinar) || 0,
        };
      }
      if (c.osc && typeof c.osc === 'object') {
        const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
        const ang = ((pan + 1) * Math.PI) / 4;
        return {
          osc: true,
          forma: Math.max(0, Math.min(3, Math.round(Number(c.osc.forma) || 0))),
          ancho: Math.max(0.05, Math.min(0.95, (Number(c.osc.ancho) || 50) / 100)),
          gL: 0.5 * dB(Number(c.gan) || 0) * Math.cos(ang),
          gR: 0.5 * dB(Number(c.gan) || 0) * Math.sin(ang),
          afinar: Number(c.afinar) || 0,
        };
      }
      const mu = muestras.get(c.m);
      if (!mu || !mu.c.length || !mu.c[0].length) return null;
      const largo = mu.c[0].length;
      const s = (x) => Math.max(0, Math.min(largo - 1, Math.round((Number(x) || 0) * mu.fm)));
      const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
      const ang = ((pan + 1) * Math.PI) / 4;
      const comun = {
        mu,
        gL: dB(Number(c.gan) || 0) * Math.cos(ang),
        gR: dB(Number(c.gan) || 0) * Math.sin(ang),
        afinar: Number(c.afinar) || 0,
      };
      if (tajada >= 0) {
        const cortes = Array.isArray(c.cortes) ? c.cortes : [];
        if (tajada >= cortes.length) return null;
        const ini = s(cortes[tajada]);
        const finTodo = c.fin === undefined || c.fin === null ? largo - 1 : s(c.fin);
        const fin = tajada + 1 < cortes.length ? Math.min(finTodo, s(cortes[tajada + 1])) : finTodo;
        if (fin - ini < 2) return null;
        return {
          ...comun,
          ini,
          lIni: fin,
          lFin: fin,
          fin,
          loop: false,
          alt: [false, false, false],
          cruce: 1,
          borde: Math.max(1, Math.min(Math.floor((fin - ini) / 2), Math.round(BORDE_S * mu.fm))),
        };
      }
      const fin = c.fin === undefined || c.fin === null ? largo - 1 : s(c.fin);
      const ini = Math.min(s(c.ini), fin);
      let lIni = c.lIni === undefined || c.lIni === null ? ini : Math.max(ini, s(c.lIni));
      let lFin = c.lFin === undefined || c.lFin === null ? fin : Math.min(fin, s(c.lFin));
      if (lFin < lIni) lFin = lIni;
      const loop = !!c.loop && lFin - lIni > 2;
      if (!loop) {
        lIni = Math.min(lIni, fin);
        lFin = Math.min(lFin, fin);
      }
      const alt = Array.isArray(c.alt) ? [c.alt[0] !== false, c.alt[1] !== false, c.alt[2] !== false] : [true, true, true];
      return {
        ...comun,
        ini,
        lIni,
        lFin,
        fin,
        loop,
        alt,
        cruce: Math.max(1, Math.min(Math.floor((lFin - lIni) / 2), Math.round(CRUCE_S * mu.fm))),
        borde: 0,
      };
    };

    // Lo que valía un canal en una posición con decimales (entre dos muestras, en línea recta).
    const leer = (canal, pos) => {
      const i = pos | 0;
      const f = pos - i;
      const a = canal[i];
      const b = i + 1 < canal.length ? canal[i + 1] : a;
      return a + (b - a) * f;
    };
    // Lo que da una cabeza de lectura: con el fundido del loop cerca de su final, y los bordes
    // fundidos de una tajada.
    const cabeza = (c, canal, pos, enLoop) => {
      if (!enLoop && !c.borde) return leer(canal, pos);
      let x = leer(canal, pos);
      if (enLoop && pos >= c.lIni && pos < c.lFin && pos > c.lFin - c.cruce) {
        const a = (pos - (c.lFin - c.cruce)) / c.cruce;
        x = x * (1 - a) + leer(canal, pos - (c.lFin - c.lIni)) * a;
      }
      if (c.borde) {
        const d = Math.min(pos - c.ini, c.fin - pos);
        if (d < c.borde) x *= Math.max(0, d) / c.borde;
      }
      return x;
    };
    const parteDe = (c, pos) => (pos < c.lIni ? 0 : pos < c.lFin ? 1 : 2);

    // --- el soplo: líneas de retardo, el estado de cada tubo y los controles en vivo
    const MAXL = 8192;
    const lineaS = () => ({ b: new Float32Array(MAXL), i: 0 });
    const leerS = (l, d) => {
      let q = l.i - Math.max(1, Math.min(MAXL - 2, d));
      if (q < 0) q += MAXL;
      const i0 = q | 0;
      const f = q - i0;
      return l.b[i0] * (1 - f) + l.b[(i0 + 1) & (MAXL - 1)] * f;
    };
    const ponerS = (l, x) => {
      l.b[l.i] = x;
      l.i = (l.i + 1) & (MAXL - 1);
    };
    const nuevoSoplo = () => ({ a: lineaS(), b: lineaS(), j: lineaS(), k: lineaS(), lpA: 0, lpB: 0, dx: 0, dy: 0, y1: 0, y2: 0, z1: 0, cx: 0, gfase: 0, q1: 0, q2: 0, q3: 0, q4: 0 });
    // la afinación de cada modelo (medida: cada uno suena un poco alto por sus filtros)
    const CAL = [1.0195, 1.07, 1.009, 1.025];
    const CONTROL_DE = [null, 'rueda', 'aliento', 'expresion', 'presion'];
    const vivo = {};
    const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    // Una muestra del tubo. `M`: lo que se recalcula cada CADA muestras; `p`: la presión de ahora.
    const soplar = (st, M, p) => {
      if (M.gru > 0) {
        st.gfase += 28 / fm;
        if (st.gfase >= 1) st.gfase -= 1;
        p *= 1 + M.gru * 0.5 * Math.sin(2 * Math.PI * st.gfase);
      }
      const rn = azar();
      p += rn * (M.ruido * 0.12 + M.asp * 0.25) * p;
      let y;
      if (M.tipo === 0) {
        st.lpA = (1 - M.ap) * leerS(st.a, M.N) + M.ap * st.lpA;
        let t = -st.lpA;
        if (M.w2 > 0) {
          st.lpB = (1 - M.ap) * leerS(st.b, M.N2) + M.ap * st.lpB;
          t = (t - st.lpB * M.w2) / (1 + M.w2);
        }
        const z = t - st.dx + 0.995 * st.dy;
        st.dx = t;
        st.dy = z;
        let pd = p - 0.5 * z;
        ponerS(st.j, pd);
        pd = leerS(st.j, M.J) * (1 + M.gri * 2);
        let x = pd * (pd * pd - 1);
        if (x > 1) x = 1;
        else if (x < -1) x = -1;
        x += 0.5 * z;
        ponerS(st.a, x);
        if (M.w2 > 0) ponerS(st.b, x);
        y = 0.3 * x;
        // un tubo CERRADO da solo los armónicos impares: se le restan los pares con lo que sonó
        // medio período antes (así el modelo queda estable también en lo muy agudo, la pifilka)
        if (M.cerrado) {
          ponerS(st.k, y);
          y = 0.7 * (y - leerS(st.k, M.medio));
        }
      } else if (M.tipo === 1) {
        // aspirado: la presión en la boca es al revés (los labios se abren hacia adentro)
        const boca = (M.aspira ? -0.3 : 0.3) * p;
        if (M.med) st.lpA = M.lg * leerS(st.b, M.Nc) + M.lp * st.lpA;
        else st.lpA = (1 - M.ap * 0.5) * leerS(st.a, M.N) + M.ap * 0.5 * st.lpA;
        const tubo = M.med ? st.lpA : 0.85 * st.lpA;
        let dd = boca - tubo;
        const yy = M.b0 * dd - M.a1 * st.y1 - M.a2 * st.y2;
        st.y2 = st.y1;
        st.y1 = yy;
        dd = yy * yy * (1 + M.gri * 3);
        dd = dd / (1 + dd);
        const q = dd * boca + (1 - dd) * tubo;
        const z = q - st.dx + 0.995 * st.dy;
        st.dx = q;
        st.dy = z;
        ponerS(st.a, M.med ? -z : z);
        if (M.med) {
          // el cacho, tajada por tajada; en su boca, lo grave vuelve y lo que sale es lo que se oye
          const G = M.G;
          const hf = st.hf || (st.hf = new Float64Array(MAXH + 1));
          const hb = st.hb || (st.hb = new Float64Array(MAXH + 1));
          let entra = leerS(st.a, M.Nc);
          let llega;
          if (G.M === 0) llega = entra;
          else {
            for (let i = 0; i < G.M; i++) {
              const k = G.K[i];
              const der = hb[i];
              const viejo = hf[i];
              hf[i] = (1 + k) * entra - k * der;
              const izq = k * entra + (1 - k) * der;
              if (i === 0) ponerS(st.b, izq);
              else hb[i - 1] = izq;
              entra = viejo;
            }
            llega = entra;
          }
          st.cx = G.pB * st.cx + (1 - G.pB) * llega;
          const vuelve = -0.99 * st.cx;
          if (G.M === 0) ponerS(st.b, vuelve);
          else hb[G.M - 1] = vuelve;
          // lo que se oye: con «Campana» en 0, la onda que vuelve a la boquilla (el sonido de adentro
          // del tubo, oscuro); en 100, lo que sale por la boca del cacho (lo grave casi no sale: brillante)
          y = 4 * ((1 - M.camp) * st.lpA + M.camp * 5 * (llega + vuelve));
        } else {
          // la campana deja salir más agudo
          st.cx = 0.9 * st.cx + 0.1 * z;
          y = 4 * (z - M.camp * 0.8 * st.cx);
        }
        if (M.tc) {
          const o = M.t0 * y + M.t1 * st.q1 + M.t2 * st.q2 - M.t1 * st.q3 - M.t4 * st.q4;
          st.q2 = st.q1;
          st.q1 = y;
          st.q4 = st.q3;
          st.q3 = o;
          y = o;
        }
      } else if (!M.conico) {
        const x = leerS(st.a, M.N);
        const lp = 0.5 * (x + st.z1);
        st.z1 = x;
        st.lpA = (1 - M.ap * 0.5) * lp + M.ap * 0.5 * st.lpA;
        const pd = -0.95 * st.lpA - p;
        let caña = 0.7 + M.pend * pd;
        if (caña > 1) caña = 1;
        else if (caña < -1) caña = -1;
        const q = p + pd * caña;
        ponerS(st.a, q);
        const z = q - st.dx + 0.995 * st.dy;
        st.dx = q;
        st.dy = z;
        y = 0.8 * z;
      } else {
        st.lpA = (1 - M.ap * 0.5) * leerS(st.a, M.N) + M.ap * 0.5 * st.lpA;
        const temp = -0.95 * st.lpA;
        const ultimo = temp - leerS(st.b, M.N2);
        const pd = p - ultimo;
        let caña = 0.7 + 0.3 * (1 + M.gri) * pd;
        if (caña > 1) caña = 1;
        else if (caña < -1) caña = -1;
        ponerS(st.b, temp);
        ponerS(st.a, p - pd * caña - temp);
        const z = ultimo - st.dx + 0.995 * st.dy;
        st.dx = ultimo;
        st.dy = z;
        y = 0.5 * z;
      }
      return y + rn * M.ruido * 0.04 * M.env;
    };
    // Lo del tubo que depende de la nota y de los parámetros, cada CADA muestras.
    const prepararSoplo = (cap, g, v, st, nivel) => {
      const M = cap.M || (cap.M = {});
      const nombre = CONTROL_DE[Math.round(g.sfa)];
      const ctl = nombre && vivo[nombre] !== undefined ? vivo[nombre] : 1;
      const sens = Math.max(0, Math.min(1, g.vvs / 100));
      const a = Math.max(0, Math.min(1.5, (g.sai / 100) * (1 - sens + (sens * v.vel) / 127) * ctl));
      const emb = g.sem / 100;
      const salto = g.ssa / 100;
      // el desvío de la nota: mientras se sostiene (llega en «Tiempo del desvío») y al final (con
      // el soplo que se va: desde que se suelta hasta que el volumen se apaga)
      cap.tS = (cap.tS || 0) + CADA;
      let des = g.sds * suave(cap.tS / Math.max(1, (g.sdt / 1000) * fm));
      if (v.soltada && g.sdx) {
        if (!cap.n0) cap.n0 = Math.max(1e-4, nivel);
        des += g.sdx * (1 - Math.min(1, nivel / cap.n0));
      }
      // la inestabilidad: la nota tiembla sin regularidad (ruido suavizado a «Velocidad»,
      // normalizado para que «Inestabilidad» sea la desviación típica en centésimas)
      if (g.sin > 0) {
        const cI = 1 - Math.exp((-2 * Math.PI * g.siv * CADA) / fm);
        cap.ri = (cap.ri || 0) + cI * (azar() * 1.732 - (cap.ri || 0));
        des += (g.sin * cap.ri) / Math.sqrt(cI / (2 - cI));
      }
      // la nota, con la subida que da el aire y el desvío (en centésimas)
      const stTecla = v.nota - 69 + cap.c.afinar + st;
      const stN = stTecla + (g.ssu * a + des) / 100;
      const fN = 440 * Math.pow(2, stN / 12);
      cap.fN = fN;
      M.tipo = Math.round(g.smt);
      M.env = nivel;
      M.ap = 0.05 + 0.85 * (g.sap / 100);
      M.ruido = g.sru / 100;
      M.asp = g.sas / 100;
      M.gru = g.sgr / 100;
      M.gri = g.sgi / 100;
      M.camp = g.sca / 100;
      if (M.tipo === 0) {
        M.cerrado = g.sex >= 0.5;
        const f = fN / CAL[0];
        let N = (1.5 * fm) / f - 2;
        // el chorro: más corto con más aire (sube y, sin «salto», brinca al armónico)
        const jr = (0.42 - 0.12 * emb) * (1 - (1 - salto) * 0.55 * Math.max(0, a - 0.3));
        M.N = N;
        M.medio = (0.5 * fm) / fN;
        M.J = N * jr * (1 + M.asp * 0.08 * azar());
        M.N2 = g.sdf > 0 ? N * Math.pow(2, g.sdf / 1200) : 0;
        M.w2 = g.sdf > 0 ? suave((a - g.sde / 100) / 0.15 + 0.5) : 0;
        M.pb = 0.6 + 0.8 * Math.min(1, a);
      } else if (M.tipo === 1) {
        // los labios a la nota (con la embocadura y, sin «salto», subiendo con el aire)
        const labio = Math.pow(2, ((emb - 0.5) * 6 + (1 - salto) * 4 * Math.max(0, a - 0.5)) / 12);
        let fL;
        M.med = g.sgm >= 0.5;
        // (aspirado, solo con el tubo con medidas: ahí está medido)
        M.aspira = M.med && g.ssn >= 0.5;
        if (M.med) {
          // el tubo con medidas: la resonancia que toca la tecla y el largo del tubo recto
          const G = geometria(g, fm);
          M.G = G;
          const fTecla = 440 * Math.pow(2, stTecla / 12);
          let meta;
          let paso;
          if (g.stb >= 0.5 && g.slm >= 0.5) {
            // «Largo desde el largo»: las resonancias que tenga; la tecla va a la más cercana (no a
            // la primera, que no se afirma) y el desvío estira el tubo
            const Nc = (((g.slc / 100) * fm) / C_AIRE) * Math.pow(2, -des / 1200);
            const P = resonancias(G, Nc / Math.pow(2, -des / 1200), fm);
            // (el labio la sube: suena ≈ un quinto de la distancia entre resonancias más arriba)
            paso = P.length > 3 ? (P[3] - P[1]) / 2 : fTecla / 3;
            let mejor = P.length > 1 ? P[1] : P[0] || fTecla;
            for (let j = 2; j < P.length; j++) if (Math.abs(Math.log((P[j] + 0.21 * paso) / fTecla)) < Math.abs(Math.log((mejor + 0.21 * paso) / fTecla))) mejor = P[j];
            meta = (mejor + 0.21 * paso) * Math.pow(2, des / 1200);
            M.Nc = Nc;
          } else {
            // «Largo desde la nota»: el tubo recto se corta para que la resonancia elegida caiga
            // justo (tubo fijo: la tecla elige el armónico de la nota del tubo; si sigue la nota,
            // la nota es su 3.ª resonancia)
            let fT;
            let k;
            if (g.stb >= 0.5) {
              fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100 + st) / 12);
              k = Math.max(2, Math.round(fTecla / fT));
            } else {
              k = 3;
              fT = fN / k;
            }
            meta = g.stb >= 0.5 ? k * fT * Math.pow(2, des / 1200) : fN;
            paso = meta / k;
            // el labio corre la nota: el tubo se corta contando con él
            const fLm = meta * Math.pow(2, (g.ssu * a) / 1200) * labio * (M.aspira ? Math.pow(2, -1 / 12) : 1);
            const claveM = `${meta}|${fLm}|${paso}|${M.aspira}`;
            if (cap.medMeta !== claveM || cap.medG !== G) {
              cap.medMeta = claveM;
              cap.medG = G;
              cap.medN = cortarTubo(G, meta, k, paso, fLm, M.aspira, fm);
            }
            M.Nc = cap.medN;
          }
          const L = perdidas(G, (M.Nc * C_AIRE) / fm, fm);
          M.lg = L.g0 * (1 - L.p);
          M.lp = L.p;
          M.fTx = paso;
          cap.fN = meta;
          fL = meta * Math.pow(2, (g.ssu * a) / 1200) * labio * (M.aspira ? Math.pow(2, -1 / 12) : 1);
        } else if (g.stb >= 0.5) {
          // tubo fijo: sus resonancias en la nota del tubo × 1, 2, 3…; la tecla elige el armónico
          // más cercano (el labio no se sostiene entre dos) y el desvío estira el tubo con él
          const fT = 440 * Math.pow(2, (g.stn - 69 + g.stf / 100 + st) / 12);
          // (del 3.º para arriba: el 1.º y el 2.º no se afirman, como en la trutruka de verdad)
          const k = Math.max(3, Math.round((440 * Math.pow(2, stTecla / 12)) / fT));
          const fTd = fT * Math.pow(2, des / 1200);
          // el tubo suena con sus resonancias corridas en (k + 0,19)·f (medido): se acorta para que
          // la elegida caiga justo; en los armónicos bajos un poco más
          M.N = (fm * (k + 0.19 + 0.15 / k)) / (k * fTd) + 3;
          M.fTx = fTd;
          fL = k * fTd * Math.pow(2, (g.ssu * a) / 1200) * labio;
          cap.fN = k * fT * Math.pow(2, des / 1200);
        } else {
          M.N = (2 * fm) / (fN / CAL[1]) + 3;
          fL = (fN / CAL[1]) * labio;
        }
        fL = Math.min(0.2 * fm, fL);
        const w = (2 * Math.PI * fL) / fm;
        // el ancho del labio: con el tubo fijo, angosto como la distancia entre sus resonancias (si no,
        // cubre varias y el labio no se afirma en ninguna)
        const r = 1 - (Math.PI * (g.stb >= 0.5 || M.med ? 0.6 * M.fTx : 0.15 * fL)) / fm;
        M.a1 = -2 * r * Math.cos(w);
        M.a2 = r * r;
        M.b0 = 25 * (1 - r) * 2 * Math.sin(w);
        // el tercer parcial de la nota: un filtro angosto en 3 × la nota que lo sube o lo baja
        // (el modelo lo da muy fuerte: −7 dB, y en la trutruka y el ñolkin grabados está en −17 a −26)
        M.tc = g.stc !== 0 && 3 * cap.fN < 0.45 * fm;
        if (M.tc) {
          const A = Math.pow(10, g.stc / 40);
          const w3 = (2 * Math.PI * 3 * cap.fN) / fm;
          const al = Math.sin(w3) / (2 * 6);
          const a0 = 1 + al / A;
          M.t0 = (1 + al * A) / a0;
          M.t1 = (-2 * Math.cos(w3)) / a0;
          M.t2 = (1 - al * A) / a0;
          M.t4 = (1 - al / A) / a0;
        }
        M.pb = 0.4 + 0.8 * Math.min(1, a);
      } else {
        M.conico = g.sfo >= 0.5;
        if (!M.conico) {
          M.N = (0.5 * fm) / (fN / CAL[2]) - 1.5;
          M.pend = -(0.26 + 0.18 * emb) * (1 + M.gri * 1.5);
        } else {
          const total = fm / (fN / CAL[3]) - 3;
          const pos = 0.2 + 0.3 * emb;
          M.N = (1 - pos) * total;
          M.N2 = pos * total;
        }
        M.pb = 0.5 + 0.4 * Math.min(1, a);
      }
      // sin aire, sin sonido (y no un tubo que igual suena con lo mínimo)
      M.pb *= suave(a / 0.15);
      return M;
    };
    // --- los modificadores de la capa
    const CUERPO_F = [
      [280, 1100, 2700],
      [500, 1500, 3500],
      [180, 650, 2200],
    ];
    const nuevoMod = () => ({ fase: 0, ef: 0, rL: lineaS(), rR: lineaS(), bq: new Float64Array(24), co: new Float64Array(15), clave: '' });
    const coefCuerpo = (m, tipo, tam) => {
      const clave = `${tipo}|${tam}`;
      if (m.clave === clave) return;
      m.clave = clave;
      const F = CUERPO_F[Math.max(0, Math.min(2, tipo))];
      for (let k = 0; k < 3; k++) {
        const f = Math.min(0.45 * fm, F[k] / tam);
        const w = (2 * Math.PI * f) / fm;
        const al = Math.sin(w) / (2 * 4);
        const a0 = 1 + al;
        m.co[5 * k] = al / a0;
        m.co[5 * k + 1] = 0;
        m.co[5 * k + 2] = -al / a0;
        m.co[5 * k + 3] = (-2 * Math.cos(w)) / a0;
        m.co[5 * k + 4] = (1 - al) / a0;
      }
    };
    const cuerpo = (m, x, canal) => {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        const e = canal * 12 + k * 4;
        const c = 5 * k;
        const y = m.co[c] * x + m.co[c + 1] * m.bq[e] + m.co[c + 2] * m.bq[e + 1] - m.co[c + 3] * m.bq[e + 2] - m.co[c + 4] * m.bq[e + 3];
        m.bq[e + 1] = m.bq[e];
        m.bq[e] = x;
        m.bq[e + 3] = m.bq[e + 2];
        m.bq[e + 2] = y;
        s += y;
      }
      return s * 2;
    };

    const zonaDe = (nota) => {
      for (const z of zonas) if (nota >= z.baja && nota <= z.alta) return z;
      return null;
    };

    // UNA ENVOLVENTE DE TRAMOS: niveles L = [inicio, ataque, quiebre, sostenido, final] y tiempos
    // T = [ataque, decaimiento, pendiente, soltado] en muestras. Fases: 0 ataque, 1 decaimiento,
    // 2 pendiente, 3 sostenido, 4 soltado (desde donde esté hasta el nivel final), 5 terminada.
    const envolvente = () => ({ fase: 0, t: 0, nivel: null, desde: 0 });
    // Avanzar `m` muestras de una vez (las envolventes van cada CADA muestras; el volumen se
    // reparte en línea recta entre medio).
    const paso = (e, D, m) => {
      if (e.nivel === null) e.nivel = D.L[0];
      while (m > 0) {
        if (e.fase === 5) return e.nivel;
        if (e.fase === 3) return (e.nivel = D.L[3]);
        const T = Math.max(1, D.T[e.fase === 4 ? 3 : e.fase]);
        const a = e.fase === 4 ? e.desde : D.L[e.fase];
        const b = e.fase === 4 ? D.L[4] : D.L[e.fase + 1];
        const resta = T - e.t;
        if (m < resta) {
          e.t += m;
          e.nivel = a + ((b - a) * e.t) / T;
          return e.nivel;
        }
        m -= resta;
        e.nivel = b;
        e.t = 0;
        e.fase = e.fase === 4 ? 5 : e.fase + 1;
      }
      return e.nivel;
    };
    const soltar = (e) => {
      if (e.fase >= 4) return;
      e.desde = e.nivel === null ? 0 : e.nivel;
      e.fase = 4;
      e.t = 0;
    };

    function notaOn(nota, vel, p) {
      const z = zonaDe(nota);
      if (!z) return;
      const tajadas = !!z.tajadas;
      const golpe = !!z.golpe || tajadas;
      // En batería, la misma nota ahoga a la que sonaba (como un tambor que se vuelve a golpear).
      if (golpe) for (const v of voces) if (v.nota === nota && !v.ahogo) v.ahogo = AHOGO_S * fm;
      const capas = [];
      (z.capas || []).slice(0, 3).forEach((c, k) => {
        const pc = prepararCapa(c, tajadas ? nota - z.baja : -1, nota);
        if (!pc) return;
        capas.push({
          c: pc,
          k: k + 1,
          pos: pc.osc ? 0 : pc.ini,
          pos2: pc.osc ? 0 : pc.ini,
          viva: true,
          viva2: true,
          muerta: false,
          espera: Math.round((Math.max(0, val(p, `c${k + 1}ret`, 0)) / 1000) * fm),
          eV: envolvente(),
          eF: envolvente(),
          eP: envolvente(),
          f: [0, 0, 0, 0],
          fG: 0,
          fK: 1,
          cuenta: 0,
          r: [0, 0, 0],
          s: pc.mod ? nuevoSoplo() : null,
          m: null,
          cola: 0,
          lv: 0,
          dlv: 0,
          fin: false,
        });
      });
      if (!capas.length) return;
      // Sin lugar: se roba la más vieja.
      if (voces.length >= VOCES) {
        let vieja = voces[0];
        for (const v of voces) if (v.orden < vieja.orden) vieja = v;
        vieja.ahogo = vieja.ahogo || AHOGO_S * fm;
        if (voces.length >= VOCES + 8) voces.splice(voces.indexOf(vieja), 1);
      }
      const ve = Math.max(0, Math.min(127, vel));
      voces.push({
        nota,
        raiz: tajadas ? nota : Number(z.raiz) || 60,
        golpe,
        capas,
        vel: ve,
        velX: (ve - 64) / 63,
        tecX: Math.max(-2.5, Math.min(2.5, (nota - 60) / 24)),
        soltada: false,
        soltadaHecha: false,
        ahogo: 0,
        ahogoN: 1,
        orden: orden++,
        subFase: 0,
      });
    }

    function notaOff(nota) {
      for (const v of voces) if (v.nota === nota && !v.golpe && !v.soltada) v.soltada = true;
    }

    function callar() {
      for (const v of voces) v.ahogo = v.ahogo || AHOGO_S * fm;
    }

    // El escalón suavizado de polyBLEP: lo que se resta cerca de cada salto de la sierra y la
    // cuadrada para que no aparezcan las frecuencias dobladas.
    const blep = (t, dt) => {
      if (t < dt) {
        const x = t / dt;
        return x + x - x * x - 1;
      }
      if (t > 1 - dt) {
        const x = (t - 1) / dt;
        return x * x + x + x + 1;
      }
      return 0;
    };
    const onda = (c, t, dt) => {
      if (c.forma === 0) return Math.sin(2 * Math.PI * t);
      if (c.forma === 1) return 1 - 4 * Math.abs(t - 0.5);
      if (c.forma === 2) return 2 * t - 1 - blep(t, dt);
      const w = c.ancho;
      let t2 = t + 1 - w;
      if (t2 >= 1) t2 -= 1;
      return (t < w ? 1 : -1) + blep(t, dt) - blep(t2, dt);
    };

    // Un vaivén en su fase (0…1): de −1 a 1.
    const forma = (k, ph, l) => {
      if (k === 0) return Math.sin(2 * Math.PI * ph);
      if (k === 1) return 1 - 4 * Math.abs(ph - 0.5);
      if (k === 2) return ph < 0.5 ? 1 : -1;
      if (k === 3) return 2 * ph - 1;
      return l.azar;
    };

    // Lo de cada capa (1, 2, 3) que dicen los parámetros, leído una vez por bloque. Los nombres
    // (`c1vat`…) se arman una sola vez: armarlos en cada bloque costaba más que el sonido.
    const CLAVES = ['smt', 'sex', 'sfo', 'stb', 'stn', 'sgm', 'slm', 'slc', 'sdc', 'slh', 'sdh', 'sfh', 'sen', 'svu', 'ssn', 'stf', 'sai', 'sem', 'sru', 'ssu', 'sds', 'sdt', 'sdx', 'sin', 'siv', 'ssa', 'sas', 'sgr', 'sgi', 'sap', 'sca', 'stc', 'sdf', 'sde', 'sfa', 'mhm', 'mhi', 'mhz', 'mrm', 'mrf', 'mrz', 'mcm', 'mct', 'mcy', 'niv', 'afi', 'vat', 'val', 'vdt', 'vbp', 'vst', 'vsl', 'vrt', 'vvs', 'vvt', 'vkt', 'ft', 'fc', 'fr', 'fi', 'fl0', 'fat', 'fal', 'fdt', 'fbp', 'fst', 'fsl', 'frt', 'frl', 'fvi', 'fvt', 'fkc', 'fkt', 'pi', 'pl0', 'pat', 'pal', 'pdt', 'prt', 'prl', 'pvi', 'pvt'];
    for (const pre of ['vvp', 'vkp', 'fvp', 'fkp']) for (const L of 'ADSR') CLAVES.push(pre + L);
    const DEFECTO = {};
    for (const q of PARAMS) if (q.id.startsWith('c1')) DEFECTO[q.id.slice(2)] = q.defecto;
    const IDS = [1, 2, 3].map((k) => CLAVES.map((c) => [c, `c${k}${c}`]));
    const leerCapa = (p, k) => {
      const o = {};
      for (const [c, id] of IDS[k - 1]) o[c] = p[id] === undefined ? DEFECTO[c] : p[id];
      o.firma = firmaDe(o);
      o.ganBase = dB(o.niv);
      o.ftipo = Math.round(o.ft);
      o.fK = 1 / (0.5 * Math.pow(40, Math.max(0, Math.min(100, o.fr)) / 100));
      return o;
    };

    // Las tres envolventes de una capa de una voz, con lo que les hacen la intensidad y la tecla y
    // los tiempos generales. Se arman una vez por bloque, sobre el mismo objeto (`cap.d`). Lo que la
    // intensidad y la tecla les hacen a los tiempos (16 potencias) solo se recalcula si cambian sus
    // ajustes (`firma`).
    const ms = (x) => Math.max(1, (x / 1000) * fm);
    const firmaDe = (g) => {
      let f = g.vvt + g.vkt * 101 + g.fvt * 10201 + g.fkt * 1030301 + g.pvt * 104060401;
      let b = 1;
      for (const pre of ['vvp', 'vkp', 'fvp', 'fkp']) for (const L of 'ADSR') {
        f += Math.round(g[pre + L]) * b * 1e-6;
        b *= 3;
      }
      return f;
    };
    const describir = (v, cap, g, g3) => {
      let d = cap.d;
      if (!d) {
        d = cap.d = {
          vol: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0] },
          fil: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0], int: 0 },
          alt: { T: [1, 1, 1, 1], L: [0, 0, 0, 0, 0], int: 0 },
          tv: [1, 1, 1, 1],
          tf: [1, 1, 1, 1],
          pt: 1,
          firma: NaN,
        };
      }
      if (d.firma !== g.firma) {
        d.firma = g.firma;
        for (let w = 0; w < 4; w++) {
          const L = 'ADSR'[w];
          d.tv[w] = porTiempo(g['vvp' + L], g.vvt / 100, v.velX) * porTiempo(g['vkp' + L], g.vkt / 100, v.tecX);
          d.tf[w] = porTiempo(g['fvp' + L], g.fvt / 100, v.velX) * porTiempo(g['fkp' + L], g.fkt / 100, v.tecX);
        }
        d.pt = Math.pow(2, (g.pvt / 100) * v.velX * 3);
      }
      const [fa, fd, fr] = g3;
      const V = d.vol;
      V.T[0] = ms(g.vat) * fa * d.tv[0];
      V.T[1] = ms(g.vdt) * fd * d.tv[1];
      V.T[2] = ms(g.vst) * fd * d.tv[2];
      V.T[3] = ms(g.vrt) * fr * d.tv[3];
      V.L[1] = g.val / 100;
      V.L[2] = g.vbp / 100;
      // un golpe con oscilador cae a cero (si no, sonaría para siempre)
      V.L[3] = v.golpe && (cap.c.osc || cap.c.mod) ? 0 : g.vsl / 100;
      d.g = g;
      const F = d.fil;
      F.T[0] = ms(g.fat) * fa * d.tf[0];
      F.T[1] = ms(g.fdt) * fd * d.tf[1];
      F.T[2] = ms(g.fst) * fd * d.tf[2];
      F.T[3] = ms(g.frt) * fr * d.tf[3];
      F.L[0] = g.fl0 / 100;
      F.L[1] = g.fal / 100;
      F.L[2] = g.fbp / 100;
      F.L[3] = g.fsl / 100;
      F.L[4] = g.frl / 100;
      F.int = g.fi * (1 + (g.fvi / 100) * v.velX);
      const A = d.alt;
      A.T[0] = ms(g.pat) * fa * d.pt;
      A.T[1] = ms(g.pdt) * fd * d.pt;
      A.T[2] = 1;
      A.T[3] = ms(g.prt) * fr * d.pt;
      A.L[0] = g.pl0 / 100;
      A.L[1] = g.pal / 100;
      A.L[4] = g.prl / 100;
      A.int = g.pi * (1 + (g.pvi / 100) * v.velX);
      const sens = Math.max(0, Math.min(1, g.vvs / 100));
      d.gan = g.ganBase * (1 - sens + (sens * v.vel) / 127);
      d.afi = g.afi;
      d.ftipo = g.ftipo;
      d.corte = g.fkc ? g.fc * Math.pow(2, ((g.fkc / 100) * (v.nota - 60)) / 12) : g.fc;
      d.fK = g.fK;
      return d;
    };

    // Llenar `sL`, `sR` entre `desde` y `hasta`. Quien llama los deja en cero: el sampler suma sus
    // voces y después les pasa la distorsión ahí mismo.
    function procesar(sL, sR, desde, hasta, p) {
      const n = hasta - desde;
      if (n <= 0) return;
      if (mVol.length < n) {
        mVol = new Float32Array(n);
        mFil = new Float32Array(n);
        mDis = new Float32Array(n);
        mPan = new Float32Array(n);
      }
      const vol = dB(val(p, 'vol', 0));
      const afinar = val(p, 'afinar', 0);
      const g3 = [Math.pow(2, val(p, 'gat', 0) / 12.5), Math.pow(2, val(p, 'gdt', 0) / 12.5), Math.pow(2, val(p, 'grt', 0) / 12.5)];
      const ruido = Math.pow(Math.max(0, val(p, 'ruido', 0)) / 100, 2) * 0.5;
      const desaf = Math.max(0, val(p, 'desaf', 0));
      const sub = (Math.max(0, val(p, 'sub', 0)) / 100) * 0.6;
      const subOct = Math.round(val(p, 'subOct', 0)) === 1 ? 2 : 1;
      const subCuadrada = Math.round(val(p, 'subForma', 0)) === 1;

      // --- los vaivenes: la altura vale para todo el bloque; lo demás, muestra por muestra
      let altSt = 0;
      mVol.fill(1, 0, n);
      mFil.fill(0, 0, n);
      mDis.fill(0, 0, n);
      mPan.fill(0, 0, n);
      let hayPan = false;
      for (let k = 0; k < 2; k++) {
        const pre = `l${k + 1}`;
        const prof = Math.max(0, Math.min(100, val(p, `${pre}p`, 0))) / 100;
        const l = lfo[k];
        const ritmo = Math.max(0, val(p, `${pre}v`, 2)) / fm;
        if (prof <= 0) {
          l.fase = (l.fase + ritmo * n) % 1;
          continue;
        }
        const fo = Math.round(val(p, `${pre}f`, 0));
        const de = Math.round(val(p, `${pre}d`, 0));
        if (de === 0) altSt += forma(fo, l.fase, l) * 12 * prof * prof;
        if (de === 4) hayPan = true;
        for (let i = 0; i < n; i++) {
          const x = forma(fo, l.fase, l);
          if (de === 1) mVol[i] *= 1 - (prof * (1 - x)) / 2;
          else if (de === 2) mFil[i] += x * prof * 4;
          else if (de === 3) mDis[i] += x * prof * 24;
          else if (de === 4) mPan[i] += x * prof;
          l.fase += ritmo;
          if (l.fase >= 1) {
            l.fase -= 1;
            l.azar = azar();
          }
        }
      }

      const S = [null, leerCapa(p, 1), leerCapa(p, 2), leerCapa(p, 3)];
      const dA = Math.pow(2, -desaf / 2400);
      const dB2 = Math.pow(2, desaf / 2400);
      for (let kv = voces.length - 1; kv >= 0; kv--) {
        const v = voces[kv];
        if (v.soltada && !v.golpe && !v.soltadaHecha) {
          v.soltadaHecha = true;
          for (const cap of v.capas) {
            soltar(cap.eV);
            soltar(cap.eF);
            soltar(cap.eP);
          }
        }
        const ds = v.capas.map((cap) => describir(v, cap, S[cap.k], g3));
        const subPaso = (440 * Math.pow(2, (v.nota - 69 - 12 * subOct + afinar + altSt) / 12)) / fm;
        // (el ruido y el sub entran por la primera capa viva: pasan por su filtro y su envolvente)
        const primera = v.capas.findIndex((x) => !x.muerta);
        let terminada = false;
        for (let j = 0; j < n; j++) {
          const i = desde + j;
          let ah = 1;
          if (v.ahogo) {
            v.ahogoN -= 1 / Math.max(1, v.ahogo);
            if (v.ahogoN <= 0) {
              terminada = true;
              break;
            }
            ah = v.ahogoN;
          }
          let oL = 0;
          let oR = 0;
          let vivas = 0;
          for (let q = 0; q < v.capas.length; q++) {
            const cap = v.capas[q];
            if (cap.muerta) continue;
            vivas++;
            if (cap.espera > 0) {
              cap.espera--;
              continue;
            }
            const d = ds[q];
            const c = cap.c;
            if (cap.cuenta-- <= 0) {
              cap.cuenta = CADA - 1;
              // las envolventes, de a CADA muestras; el volumen llega a lo nuevo en línea recta
              const meta = paso(cap.eV, d.vol, CADA);
              cap.dlv = (meta - cap.lv) / CADA;
              const lf = paso(cap.eF, d.fil, CADA);
              const lp = paso(cap.eP, d.alt, CADA);
              // la envolvente de volumen llegó al final (o a un sostenido en cero): la capa calla
              // cuando el volumen termina de llegar
              if (c.mod) {
                // el tubo sigue sonando un poco después del soplo: calla un cuarto de segundo después
                if (cap.eV.fase === 5 || (cap.eV.fase === 3 && d.vol.L[3] <= 0)) {
                  cap.cola += CADA;
                  if (cap.cola > 0.25 * fm) cap.muerta = true;
                } else cap.cola = 0;
              } else if (cap.eV.fase === 5 || (cap.eV.fase === 3 && d.vol.L[3] <= 0)) cap.fin = true;
              else if (cap.fin) cap.fin = false;
              // la altura: la de la nota, la afinación, el vaivén y la envolvente de altura
              const st = afinar + altSt + d.afi + d.alt.int * lp;
              if (c.mod) prepararSoplo(cap, d.g, v, st, meta);
              else if (c.osc) {
                const f = (440 * Math.pow(2, (v.nota - 69 + c.afinar + st) / 12)) / fm;
                cap.r[0] = cap.r[1] = cap.r[2] = f;
                cap.fN = f * fm;
              } else {
                const base = c.mu.fm / fm;
                const conNota = Math.pow(2, (v.nota - v.raiz + c.afinar + st) / 12);
                const sinNota = Math.pow(2, (c.afinar + st) / 12);
                for (let w = 0; w < 3; w++) cap.r[w] = base * (c.alt[w] ? conNota : sinNota);
                cap.fN = 440 * Math.pow(2, (v.nota - 69 + c.afinar + st) / 12);
              }
              if (d.ftipo > 0) {
                const f = Math.min(0.45 * fm, Math.max(20, d.corte * Math.pow(2, d.fil.int * lf + mFil[j])));
                cap.fG = Math.tan((Math.PI * f) / fm);
                cap.fK = d.fK;
              }
            }
            let xL = 0;
            let xR = 0;
            if (c.mod) {
              const y = soplar(cap.s, cap.M, (cap.lv + cap.dlv) * cap.M.pb);
              xL = y * c.gL;
              xR = y * c.gR;
            } else if (c.osc) {
              const pa = cap.r[0] * dA;
              const pb = cap.r[0] * dB2;
              xL = onda(c, cap.pos, pa) * c.gL;
              xR = onda(c, cap.pos2, pb) * c.gR;
              cap.pos += pa;
              if (cap.pos >= 1) cap.pos -= 1;
              cap.pos2 += pb;
              if (cap.pos2 >= 1) cap.pos2 -= 1;
            } else {
              const enLoop = c.loop && !v.golpe && !v.soltada;
              const L = c.mu.c[0];
              const R = c.mu.c[1] || L;
              if (cap.viva) {
                xL = cabeza(c, L, cap.pos, enLoop) * c.gL;
                cap.pos += cap.r[parteDe(c, cap.pos)] * dA;
                if (enLoop && cap.pos >= c.lFin) cap.pos -= c.lFin - c.lIni;
                if (cap.pos >= c.fin) cap.viva = false;
              }
              if (cap.viva2) {
                xR = cabeza(c, R, cap.pos2, enLoop) * c.gR;
                cap.pos2 += cap.r[parteDe(c, cap.pos2)] * dB2;
                if (enLoop && cap.pos2 >= c.lFin) cap.pos2 -= c.lFin - c.lIni;
                if (cap.pos2 >= c.fin) cap.viva2 = false;
              }
              if (!cap.viva && !cap.viva2) cap.muerta = true;
            }
            if (q === primera) {
              if (ruido > 0) {
                const r = azar() * ruido;
                xL += r;
                xR += r;
              }
              if (sub > 0) {
                const s = (subCuadrada ? (v.subFase < 0.5 ? 0.7 : -0.7) : Math.sin(2 * Math.PI * v.subFase)) * sub;
                xL += s;
                xR += s;
                v.subFase += subPaso;
                if (v.subFase >= 1) v.subFase -= 1;
              }
            }
            // los modificadores de la capa
            const g = d.g;
            if (g.mhm > 0 || g.mrm > 0 || g.mcm > 0) {
              const m = cap.m || (cap.m = nuevoMod());
              const fN = cap.fN || 440;
              if (g.mhm > 0) {
                const x = 0.5 * (xL + xR);
                m.ef = 0.995 * m.ef + 0.005 * Math.abs(x);
                m.fase += (fN * g.mhz) / fm;
                if (m.fase >= 1) m.fase -= Math.floor(m.fase);
                const y = Math.sin(2 * Math.PI * m.fase + (g.mhi / 100) * 4 * x) * m.ef * 2;
                const k = g.mhm / 100;
                xL = xL * (1 - k) + y * k;
                xR = xR * (1 - k) + y * k;
              }
              if (g.mrm > 0) {
                const dl = fm / Math.max(20, fN * g.mrz);
                const fb = g.mrf / 100;
                const yL = xL + fb * leerS(m.rL, dl);
                const yR = xR + fb * leerS(m.rR, dl);
                ponerS(m.rL, yL);
                ponerS(m.rR, yR);
                const k = g.mrm / 100;
                xL = xL * (1 - k) + yL * k * (1 - fb);
                xR = xR * (1 - k) + yR * k * (1 - fb);
              }
              if (g.mcm > 0) {
                coefCuerpo(m, Math.round(g.mcy), g.mct);
                const k = g.mcm / 100;
                xL = xL * (1 - k) + cuerpo(m, xL, 0) * k;
                xR = xR * (1 - k) + cuerpo(m, xR, 1) * k;
              }
            }
            // el filtro de la capa
            if (d.ftipo > 0) {
              const gg = cap.fG;
              const kk = cap.fK;
              const a1 = 1 / (1 + gg * (gg + kk));
              const a2 = gg * a1;
              const a3 = gg * a2;
              const s = cap.f;
              for (let o = 0; o < 2; o++) {
                const x = o === 0 ? xL : xR;
                const v3 = x - s[2 * o + 1];
                const v1 = a1 * s[2 * o] + a2 * v3;
                const v2 = s[2 * o + 1] + a2 * s[2 * o] + a3 * v3;
                s[2 * o] = 2 * v1 - s[2 * o];
                s[2 * o + 1] = 2 * v2 - s[2 * o + 1];
                const y = d.ftipo === 1 ? v2 : d.ftipo === 2 ? x - kk * v1 - v2 : v1;
                if (o === 0) xL = y;
                else xR = y;
              }
            }
            cap.lv += cap.dlv;
            // (el soplo ya trae su envolvente: la presión)
            const gc = c.mod ? d.gan : cap.lv * d.gan;
            oL += xL * gc;
            oR += xR * gc;
            if (cap.fin && cap.cuenta === 0) cap.muerta = true;
          }
          if (!vivas) {
            terminada = true;
            break;
          }
          let gL = vol * mVol[j] * ah;
          let gR = gL;
          if (hayPan) {
            const a = ((Math.max(-1, Math.min(1, mPan[j])) + 1) * Math.PI) / 4;
            gL *= Math.cos(a) * Math.SQRT2;
            gR *= Math.sin(a) * Math.SQRT2;
          }
          sL[i] += oL * gL;
          sR[i] += oR * gR;
        }
        if (terminada || v.capas.every((x) => x.muerta)) voces.splice(kv, 1);
      }

      // --- la distorsión, sobre todo lo que suena
      const dist = val(p, 'dist', 0);
      const mez = Math.max(0, Math.min(100, val(p, 'dmez', 100))) / 100;
      if (mez > 0 && (dist > 0 || mDis.some((x, j) => j < n && x !== 0))) {
        for (let j = 0; j < n; j++) {
          const dd = dist + mDis[j];
          if (dd <= 0) continue;
          const g = dB(dd);
          const comp = 1 / Math.sqrt(g);
          const i = desde + j;
          sL[i] = sL[i] * (1 - mez) + Math.tanh(g * sL[i]) * comp * mez;
          sR[i] = sR[i] * (1 - mez) + Math.tanh(g * sR[i]) * comp * mez;
        }
      }
    }

    return {
      ponerMuestra(m, canales, fmMuestra) {
        muestras.set(m, { c: canales, fm: fmMuestra || fm });
      },
      quitarMuestra(m) {
        muestras.delete(m);
      },
      ponerInstrumento(def) {
        zonas = Array.isArray(def && def.zonas) ? def.zonas.filter((z) => z && Array.isArray(z.capas)) : [];
      },
      notaOn,
      notaOff,
      callar,
      // Un control en vivo para el aire: 'rueda', 'aliento', 'expresion' o 'presion', de 0 a 1.
      controlar(nombre, valor) {
        vivo[nombre] = Math.max(0, Math.min(1, Number(valor) || 0));
      },
      procesar,
      cuantasVoces: () => voces.length,
    };
  }

  return { PARAMS, TIPOS_FILTRO, FORMAS, DESTINOS, POLARIDAD, MODELOS, crear, medidaTubo };
}
