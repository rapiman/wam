# Sampler — diseño (desde 2026-11-24)

Un solo WAM con los tres estilos que pidió JP: **piano** (zonas que cubren tramos del teclado),
**batería** (cada nota dispara su sonido entero) y **tajadas** (un audio cortado en pedazos, cada
pedazo en una tecla). Más adelante, osciladores y moduladores «al estilo Massive», efectos sencillos
(distorsión, ruido para dar cuerpo, desafinado) y el estirado al tempo.

## Reglas

- **El cálculo del sonido son cuentas puras** (`nucleo.js`): ni nodos del navegador ni nada de
  afuera. Corre en el hilo de audio, se prueba con Node (`prueba.mjs`) y se puede pasar algún día a
  un plugin nativo (VST).
- **Los audios no van en el estado** (pesan demasiado para la configuración de una caja): el estado
  guarda DIRECCIONES. El hilo principal baja cada audio, lo decodifica y le manda los canales al hilo
  de audio (`ponerMuestra`).
- **De dónde salen los audios**: dentro de Pizarrita, el sitio le ofrece los de la pizarrita, subir y
  grabar (el «mismo camino» de siempre). Fuera de Pizarrita, una dirección web (queda guardada) o un
  archivo del computador (no queda guardado).
- La fila de sonido de la caja no cambia: sigue siendo la forma sencilla.

## El instrumento

```
{ zonas: [ZONA…] }
ZONA = { baja, alta, raiz, golpe, tajadas, sens, capas: [CAPA…] }      hasta 3 capas
CAPA = { m, ini, lIni, lFin, fin, loop, alt: [a, l, r], gan, pan, afinar, cortes: [s…] }
```

- Una ZONA cubre las notas `baja…alta`; `raiz` es la nota en la que la muestra suena tal cual.
  Con `golpe` la nota dispara el sonido entero y soltarla no hace nada (batería y tajadas); la misma
  nota ahoga a la anterior.
- Cada CAPA es un audio con sus **tres partes**: la entrada (`ini…lIni`), el loop (`lIni…lFin`,
  se repite mientras la tecla está apretada, con un fundido de 4 ms para que no haga clic) y el
  release (`lFin…fin`, suena al soltar). Las posiciones van en segundos de la muestra.
  `alt[k]`: si esa parte sigue la altura de la nota o suena a la altura de la muestra.
- Parámetros que se automatizan: volumen, envolvente (ataque, decaimiento, sostenido, soltado),
  afinación y sensibilidad a la intensidad. 32 voces; sin lugar, se roba la más vieja.

## Por partes

1. **El reproductor** — HECHO: el corazón (`nucleo.js`, 18 comprobaciones: zonas, capas, las tres
   partes con o sin la altura de la nota, golpe, envolvente), el procesador (recibe MIDI y las
   muestras), la carátula (teclado con las zonas, la forma de onda con las marcas que se
   arrastran, cargar audios por archivo o dirección web) y el módulo. FALTA probarlo en un navegador.
2. **Las tajadas** — HECHO: una zona con `tajadas: true` y `cortes` en cada capa; la nota
   `baja + i` toca la tajada i entera, a la altura de la muestra, con bordes fundidos de 2 ms.
   `tajadas.js` detecta los golpes (subidas de la energía de lo agudo; sensibilidad 0–100) sobre
   la energía que se calcula al abrir el audio, o parte en partes iguales. En la carátula: «+ Tajadas»
   (desde C3), al abrir un audio se detecta solo; los cortes se arrastran, doble clic agrega o
   quita uno, clic en una tajada la hace sonar. La zona se alarga sola, una tecla por tajada.
3. **Filtro, efectos y moduladores** — HECHO (todo parámetro del plugin, se automatiza):
   - filtro por voz (variable de estado de 12 dB/oct: pasa bajos, altos o banda; corte, resonancia)
     con su envolvente (ataque y caída propios, hasta ±8 octavas);
   - «color»: distorsión (tanh, con mezcla, al final de todo), ruido blanco por voz, desafinado (dos
     cabezas por capa, una por oreja, separadas hasta 100 centésimas) y **sub** (seno o cuadrada,
     una o dos octavas abajo de la nota);
   - dos vaivenes (seno, triángulo, cuadrada, sierra, azar; 0,05–30 Hz) hacia la altura (hasta
     ±12 st, con la profundidad al cuadrado para afinar lo chico), el volumen, el corte del filtro
     (±4 oct), la distorsión (±24 dB) o el paneo. La altura se mueve por bloque de 128 muestras; lo
     demás, muestra por muestra.
   - En la carátula, abajo, en pestañas: General, Filtro, Color, Vaivén 1, Vaivén 2.
   - Costo medido en wedwed (Node): 16 voces × 3 capas ≈ 25 % del tiempo real sin nada, ≈ 38 % con
     todo prendido. Si pesa en la caja, lo primero es achicar el ciclo de cada cabeza.
4. **Estirar al tempo** — HECHO (2026-11-25; JP: «por espectro», «puede ser en ms o en notas»):
   cada parte de una capa (entrada, loop y release; sin loop, la nota entera; en tajadas, todo lo
   cortado) puede durar unos milisegundos o unos tiempos (negras) al tempo. `estirar.js`: vocoder
   de fase con las fases amarradas a los picos, por tramos en una sola pasada (sin costuras), de
   0,125 a 8 veces. Lo estira el nodo, que guarda una copia de cada audio, en un Worker (si la
   página no lo deja, en el hilo principal, de a uno), y le manda al hilo de audio una muestra
   estirada con sus marcas; se recalcula al cambiar el tempo o el ajuste, y mientras tanto suena
   lo que ya está. El tempo llega del anfitrión por `wam-transport`
   (la caja lo manda a sus instrumentos: `avisarTempo` en `audio/wam.ts` de Pizarrita); sin
   anfitrión que lo diga, 120. Con la altura de la nota (JP, 2026-11-25: «mantener el pitch y el largo»): una parte estirada
   que sigue la altura dura lo pedido en TODAS las notas; el nodo hace una versión por nota
   (`var[nota]`, hasta ±24 semitonos de la raíz dentro de la zona; primero las más cercanas), estirada
   por la proporción × la razón de la nota, y el corazón la lee a la altura de esa nota. La
   afinación general y el vaivén a la altura no entran en ese cálculo (mueven un poco el largo).
   CAPA: `est: [e0, e1, e2]`,
   cada uno null o `{ u: 'ms' | 't', v }`.
5. **Osciladores** — HECHO (2026-11-25; JP: «formas clásicas y samplers»): una capa puede ser un
   audio o un oscilador (seno, triángulo, sierra o cuadrada con ancho de pulso; sierra y cuadrada
   con polyBLEP). Pasa por todo lo demás: envolvente, filtro, color, vaivenes; el desafinado le
   da dos fases, una por oreja. En un golpe cae a cero en el decaimiento. CAPA: `osc: { forma, ancho }`.
6. **La pieza de Pizarrita** — HECHO (2026-11-25): si el anfitrión le pone al nodo `pz.elegirAudio()` (Pizarrita: `canvas/caja/audioSampler.tsx`, al abrir el panel del instrumento en la caja), la carátula muestra «Desde Pizarrita», que abre la ventana del anfitrión con los audios de las cajas que se pueden ver (primero los de esa caja) y deja la dirección en la capa. Además, pestaña con los audios sueltos de todas las pizarritas, y **subir y grabar**: el audio queda en la pizarra donde está la caja, como un audio suelto (JP: «en la pizarra como un audio»), y se usa en la capa.
7. **Moldear cada capa como el Korg M1** — HECHO (2026-11-25; JP: «copiarle los VDA, VDF,
   envelope… el gráfico», «todo, que quede bien complejo»). La capa 1, 2 o 3 de cada zona es como
   un oscilador del M1: lo del audio va en la zona; lo que moldea el sonido son parámetros de la
   capa (`c1…`, `c2…`, `c3…`, 55 por capa, 185 en total, todos automatizables), iguales en todas las
   zonas. Volumen (VDA): envolvente de seis tramos con punto de quiebre y pendiente, sensibilidad,
   y la intensidad y la tecla alargan (+), dejan (x) o acortan (−) cada tiempo. Filtro (VDF), uno
   por capa: tipo, corte, resonancia, intensidad en octavas, envolvente de ocho tramos con niveles
   ±100 %, intensidad de la nota sobre la intensidad y los tiempos, tecla sobre el corte y los
   tiempos. Altura: envolvente con inicio, cima, decaimiento a la nota y final, más honda y más
   lenta según la intensidad. Nivel, afinación y retardo de entrada por capa. Lo general: volumen,
   afinación y un ataque, decaimiento y soltado (±50) que se suman a todas las envolventes, como en
   el M1. La carátula (`moldear.js`): pestañas Volumen, Filtro y Altura con la envolvente dibujada
   (los puntos se arrastran: a los lados el tiempo, arriba y abajo el nivel) y sus perillas. Las
   envolventes corren cada 16 muestras y el volumen se reparte en línea recta entre medio. Costo en
   wedwed (Node): 16 voces × 3 capas ≈ 33 % del tiempo real sin filtros, ≈ 56 % con todo.
8. **El soplo y los modificadores** — HECHO (2026-11-25; JP, tomando la manera del Yamaha VL70-m
   como parte del moldeado: «esas desafinaciones como de flauta cuando entre más aire, muy tarka o
   pifilkas o trutrucas o trompetas»). Una capa puede ser un modelo físico (`mod: {}`, fuente
   «Soplo»): bisel (chorro contra un filo: sube con el aire y, sin «salto», brinca al armónico;
   extremo cerrado = solo armónicos impares, restando lo de medio período antes; doble fondo = un
   segundo tubo más hondo que entra con la fuerza, la pifilka), labios (el tubo sigue la nota, o
   queda fijo y los labios eligen su armónico: la trutruka) y caña (tubo recto o cónico). Modelos de
   la STK (Cook y Scavone) retocados; afinación medida (`CAL`). La envolvente de Volumen es el
   soplo; el aire = «Aire» × intensidad × (rueda, aliento CC 2, expresión CC 11 o aftertouch, si se
   elige). Modificadores por capa para cualquier fuente: realce de armónicos (FM sobre el sonido),
   resonador (retardo realimentado afinado a la nota) y cuerpo (madera, campana o caja). Carpeta
   «Soplo»; los modificadores, en «Efectos». 81 parámetros por capa, 266 en total. Costo: 16 voces de
   soplo con todo ≈ 53 % del tiempo real en wedwed.
   - **Retoque con una grabación de trutruka** (2026-11-25; JP mandó un trutrukero y pidió los
     cambios a, c, d y e, y que el aliento se pueda bajar). Lo medido: tubo de ≈ 40 Hz (Mi 1 −50 ct),
     toca los armónicos 6–7–8 (5 y 9 a veces), notas de 0,2 s, ataque de 30 ms, la nota sube ≈ 20 ct
     al sostenerse, 2.º parcial a −7 dB, aliento 20–25 dB bajo la nota. Cambios:
     - Labios con tubo fijo: el ancho del labio va con la distancia entre las resonancias del tubo
       (0,6 × la nota del tubo; antes 0,25 × la de los labios, que cubría varias y salía casi un
       seno, muy bajo). Suenan los armónicos 3 a 10 con timbre de bronce.
     - La tecla elige el armónico más cercano (del 3.º arriba: el 1.º y el 2.º no se afirman); el
       tubo se corrige porque sus resonancias caen en (k + 0,19)·f (medido) y no usa `CAL`.
     - «Afinación del tubo» (`stf`, ±100 ct).
     - «Desvío de la nota», para todos los modelos: «Desvío al sostener» (`sds`, ±100 ct, llega en
       «Tiempo del desvío», `sdt`) y «Desvío al final» (`sdx`, ±200 ct, con el soplo que se va desde
       que se suelta hasta que el volumen se apaga).
     - Los labios salen 2,7 veces más fuerte (estaban 12 dB bajo los otros modelos; por eso el
       aliento los tapaba). Con 15 % de aliento la nota queda ≈ 34 dB arriba del ruido.
   - **Con una grabación de ñolkin** (2026-11-25): tubo de ≈ 85,3 Hz (Fa 2 −39 ct), armónicos 4 a 7
     (el 3.º nunca), pares e impares, ataque ≈ 105 ms, la altura tiembla ±10–14 ct sin regularidad
     (2–7 Hz). Sale con labios y tubo fijo. JP pidió (1 y 2):
     - «Tercer parcial» (`stc`, −30 a +12 dB, −10 por defecto; solo labios): filtro angosto en
       3 × la nota (el modelo lo daba en −7 dB; grabado, −17 a −26). Oscurece también la trompeta.
     - «Inestabilidad» (`sin`, 0–50 ct, desviación típica) y su «Velocidad» (`siv`, 0,5–15 Hz):
       ruido suavizado sumado al desvío de la nota, para todos los modelos.
     89 parámetros por capa, 287 en total.
   - **El tubo con medidas, paso 1 de 3** (2026-11-25; JP: «todos los que tenga sentido, la nota
     define el largo y el largo podría definir la nota»; el ñolkin «también es labio», de cañería de
     gas y cacho de cabra, aspirado; la trutruka de cañería de agua y cacho de vaca; enrollada en
     espiral u óvalo, y dibujada; eligió la física de verdad: «1b»). Solo labios, con «Forma del
     tubo: Con medidas» (con «Simple» queda todo como antes):
     - Tubo recto (dos líneas de retardo) + cacho de tajadas de una muestra que se reflejan por el
       cambio de área (Kelly-Lochbaum); boca del cacho: −0,99 · paso bajo en 1,2·c/(2π·radio).
       Pérdidas en las paredes ≈ 2,96·10⁻⁵ √f / radio por metro, como un paso bajo de un polo.
       Enrollado: pérdida de 0,4 % (espiral) o 0,6 % (óvalo) por vuelta; casi no cambia el sonido.
     - El labio conserva la convención de la STK (la onda de vuelta con el signo de la línea
       simple); por eso las resonancias quedan en la serie entera, como en las grabaciones.
     - «Largo desde la nota»: el tubo recto se corta para la resonancia elegida contando la fase
       del resonador del labio y lo que igual queda alto (8 + 90/k² centésimas; aspirado, −65).
       Medido: trutruka y ñolkin dentro de ±10 ct; una trompeta muy abierta, ≈ +30 ct.
       «Largo desde el largo»: las resonancias salen de la impedancia (picos hasta 3 kHz); la tecla
       va a la más cercana (lo que suena ≈ pico + 0,21 × la distancia entre resonancias).
     - Aspirado: la presión de la boca al revés y el labio un semitono abajo.
     - Lo que se oye: «Campana» mezcla la onda que vuelve a la boquilla (0) con lo que sale por la
       boca del cacho (100).
     - Carátula: «Medidas del tubo» en Soplo, botones de materiales (medidas aproximadas, JP las
       dará después: cañería de gas 10 mm, de agua 20 mm, cacho de cabra 18 cm/45 mm, de vaca
       35 cm/90 mm) y el dibujo a escala (recto, espiral, óvalo) donde va la forma de onda.
     - Costo: 16 voces ≈ 20 % del tiempo real en el espacio de Claude (sin medidas, 12 %).
     99 parámetros por capa, 317 en total. Faltan: paso 2, los hoyos (hasta 8, tapados a medias,
     ubicados a mano o por escala); paso 3, la pifilka con dos secciones (la segunda más angosta).
   - **Un sonido más real** (2026-11-26; JP: «implementa eso 1234»):
     1. **Ligado** (`slg`, y `slt` «Tiempo del ligado»): con una nota apretada en la misma zona, la
        nueva no hace otra voz: la misma cambia de nota sin cortar el aire; el labio se desliza y el
        tubo lo agarra en la resonancia más cercana (el quiebre). Al soltar la de arriba vuelve a la
        que sigue apretada. Al cambiar de nota el aire afloja ≈ 15 ms (−60 %). Para bajar de
        armónico hace falta el labio con flujo de aire: con el simple se queda pegado arriba.
     2. **Soplo vivo**: «Golpe de lengua» (`sgl`, pulso de presión y de ruido de ≈ 15 ms);
        «Respiración» (`srs`, presión que sube y baja ≈ 1,2 Hz, hasta ±12 %, mueve volumen, brillo y
        altura); «Variación entre notas» (`svn`, hasta ±15 ct y ±12 % de aire por nota); el ruido de
        aliento ahora filtrado (≈ 500 Hz–5 kHz) y a golpes con la abertura (labio, caña o chorro).
     3. **Labio con flujo de aire** (`slb`, solo con el tubo con medidas): la presión en la
        boquilla es lo que llega más lo que sale; el aire pasa según la abertura y la raíz de la
        diferencia (Bernoulli), con algo de inercia (más brusco con más aire). El labio, angosto
        (0,15 × la distancia entre resonancias) y afinado 0,15 de esa distancia abajo de la nota (el
        labio que se abre hacia afuera suena arriba de su resonancia); al empezar, 0,5 más abajo
        (se va en ≈ 50 ms). Medido: trutruka ±3 ct, ñolkin −12, trompeta −9 a +16, aspirado ±33
        (corrección +110 ct). Con mucho aire salta al armónico de arriba; en tubos largos un
        ataque lento parte un armónico arriba (≈ 100 ms): conviene un ataque corto. **Boquilla**
        (`sbq`, `sbv` copa en cm³, `sbg` garganta en mm): resonador de Helmholtz (garganta de
        2,5 cm) como paso bajo resonante Q = 2 en la onda que entra al tubo; su fase entra en el
        corte del tubo (la nota sigue justa).
     4. **Bramido** (`sbr`): la onda fuerte viaja más rápido (retardo que se acorta con la onda,
        60·aire² muestras por unidad): tocado fuerte, el tubo largo se pone metálico.
     Costo: 16 voces con todo ≈ 30 % del tiempo real en el espacio de Claude. 109 parámetros por
     capa, 347 en total.

