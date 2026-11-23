# wam — plugins de audio propios (Web Audio Modules 2.0)

Efectos e instrumentos para el navegador, hechos como [Web Audio Modules 2.0](https://www.webaudiomodules.com/):
sirven en cualquier anfitrión WAM. Nacieron para la caja de ritmos y el mixer de Pizarrita, pero
no dependen de ella: lo único que importan es `@webaudiomodules/sdk`.

## Plugins

| Carpeta | Qué es | Estado |
|---|---|---|
| `compresor` | Compresor (umbral, razón, ataque, relajación, rodilla, ganancia, mezcla) y limitador con techo que mira 5 ms hacia adelante. El cálculo corre en el hilo de audio. | 0.1.0 |
| `ecualizador` | Ecualizador paramétrico de 8 bandas (campana, repisa baja y alta, corte bajo y alto, muesca) y ganancia de salida; los cortes pueden ser de 12, 24, 36 o 48 dB por octava. Las bandas se crean con doble clic y se arrastran sobre la curva; la rueda cambia el Q; detrás se ven los dos espectros: cómo está el sonido al entrar y cómo queda al salir (para eso el nodo tiene una segunda salida con la entrada sin tocar, que no hay que conectar a nada). | 0.1.0 |
| `filtro` | Pasa bajos, pasa altos, pasa banda o muesca, de 12 o 24 dB por octava, con resonancia y vaivén (un oscilador lento que mueve la frecuencia). La carátula dibuja la curva. | 0.1.0 |
| `chorus` | Varias voces: el sonido sumado con una copia atrasada cuyo atraso sube y baja. | 0.1.0 |
| `flanger` | Barrido metálico: un atraso corto con vaivén y realimentación. Mismo núcleo que el chorus, con otros rangos. | 0.1.0 |
| `phaser` | Muescas que se pasean: 4, 6, 8 o 12 filtros «pasa todo» en cadena, con vaivén y realimentación. | 0.1.0 |
| `tremolo` | El volumen sube y baja (seno, triángulo o cuadrada); con las orejas desfasadas, paneo automático. Muestra el volumen en el tiempo: cómo está y cómo queda. | 0.1.0 |
| `reverberacion` | Reverb de espacios, por convolución: cuarto, sala, salón, iglesia, placa y túnel, con largo, atraso («antes»), brillo y mezcla. Los espacios de hoy son GENERADOS (se calculan, no son grabaciones). Es un nodo compuesto: usa el `ConvolverNode` del navegador. **Guardado**: no está puesto en Pizarrita (archivo `GUARDADO`). | 0.1.0 |

## Usarlos

Lo armado está en `dist/<plugin>/` (`index.js` y `descriptor.json`): se copia esa carpeta al sitio
y se carga como cualquier WAM.

```js
import { initializeWamHost } from '@webaudiomodules/sdk';

const [grupo] = await initializeWamHost(contexto);
const { default: Compresor } = await import('./wam/compresor/index.js');
const plugin = await Compresor.createInstance(grupo, contexto);
fuente.connect(plugin.audioNode).connect(contexto.destination);
document.body.append(await plugin.createGui());
```

El estado (`getState` / `setState`) es `{ parameterValues }`, el del SDK.

### Automatizar

Cada control es un parámetro WAM (`getParameterInfo` los declara con su rango y sus unidades) y
acepta eventos `wam-automation` con hora exacta:

```js
plugin.audioNode.scheduleEvents({ type: 'wam-automation', time: contexto.currentTime, data: { id: 'umbral', value: -24, normalized: false } });
```

Las carátulas siguen solas esos cambios. El ecualizador, que tiene 49 parámetros, exporta además
`paramsVisiblesPz(estado)`: los ids que vale la pena ofrecer con ese estado (los de las bandas
encendidas y la salida).

### Colores

Las carátulas usan variables CSS con un valor por defecto; la página las cambia desde afuera,
en cualquier elemento que contenga la carátula:

`--pzw-fondo` `--pzw-tinta` `--pzw-tinta2` `--pzw-borde` `--pzw-pantalla` `--pzw-acento`
`--pzw-nivel` `--pzw-reduccion` `--pzw-traza` `--pzw-letra`

**Sin definir nada, la carátula sigue el tema de la ventana donde se abre** (`seguirTema` en
`comun/controles.js`): toma el color de letra, el fondo y la tipografía del lugar donde quedó
puesta y deduce los demás tonos; el acento es `--pz-acento` o `accent-color` si la página lo
declara. Una variable `--pzw-*` definida por la página manda sobre lo deducido. Si letra y fondo
no contrastan lo suficiente, quedan los colores de siempre.

## Armar

```sh
npm install
npm test            # las pruebas del cálculo, con Node y sin navegador
bash armar.sh       # prueba y arma a dist/
bash armar.sh /ruta/al/sitio/wam   # además copia cada plugin armado a esa carpeta
```

Las funciones que van al hilo de audio se mandan como texto (`addFunctionModule`), por eso no se
minifica ni se baja la sintaxis.

## Cómo está ordenado

Hay dos maneras de armar un plugin:

- **Con el molde** (`comun/molde.js`), para un efecto simple: el plugin es su `nucleo.js` (la lista de
  parámetros y el efecto: una función que se basta sola, que va al hilo de audio como texto y que
  también usan la carátula y la prueba), un `descriptor.json` y un `index.js` de diez líneas. La
  carátula sale de la lista de parámetros (`comun/caratulaSimple.js`): el gráfico con los dos
  espectros («cómo está» y «cómo queda», `comun/espectros.js`) y un control por parámetro; cada
  efecto puede dibujar encima lo suyo. Así están hechos el filtro, el chorus, el flanger, el phaser
  y el trémolo. Todos sus nodos tienen dos salidas: la 0 es el sonido y la 1, la entrada sin tocar
  (para el espectro; no hay que conectarla a nada).
- **A mano**, cuando la carátula es propia: el compresor y el ecualizador.

Un efecto del molde que además necesita nodos del navegador pide más salidas y los arma en
`componer(nodo)`: así está hecha la reverb (`reverberacion/index.js`), que para quien la conecta
sigue siendo un nodo solo. Para los efectos que cambian cuánto suena y no el color (el trémolo),
`comun/niveles.js` dibuja el volumen en el tiempo en vez de los espectros.

`armar.sh <destino>` no pisa un plugin ajeno que se llame igual que uno de estos.

- `comun/controles.js`: perilla, casilla de número, interruptor y lienzo, comunes a todas las carátulas.
- `comun/hilo.js`: manda al hilo de audio una función que recibe otras funciones y datos.
- `comun/molde.js`, `comun/caratulaSimple.js`, `comun/espectros.js`: el molde de los efectos simples.
- `comun/nucleoRetardo.js`: el retardo con vaivén que comparten el chorus y el flanger.
- `comun/probar.mjs`: lo común de las pruebas.
- `<plugin>/procesador.js`: el cálculo y el procesador (hilo de audio).
- `<plugin>/index.js`: el nodo y el módulo (lo que carga el anfitrión).
- `<plugin>/caratula.js`: la interfaz.
- `<plugin>/nucleo.js` (si lo hay): la cuenta que comparten el hilo de audio y la carátula (en el ecualizador, los coeficientes de cada banda: lo que se dibuja es lo que suena).
- `<plugin>/prueba.mjs`: mide el cálculo con números. En el compresor, un tono a −6 dB con umbral −18 y razón 4 tiene que salir a −15 dB y el limitador no puede pasar del techo; en el ecualizador, cada tipo de banda tiene que dar su ganancia y lo que suena tiene que coincidir con la curva.

## Licencia

Copyright (C) 2026 Juan Pablo Rapiman Risco

Estos plugins son software libre: pueden redistribuirse y modificarse bajo los términos de la
[GNU Affero General Public License](LICENSE) publicada por la Free Software Foundation,
versión 3 o (a elección) cualquier versión posterior (`AGPL-3.0-or-later`).

Se distribuyen con la esperanza de que sean útiles, pero SIN NINGUNA GARANTÍA. Quien
ofrezca una versión modificada a usuarios a través de una red debe poner a su
disposición el código fuente correspondiente (sección 13 de la licencia).

Lo armado en `dist/` incluye `@webaudiomodules/sdk` (licencia MIT).
