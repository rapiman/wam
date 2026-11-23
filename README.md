# wam — plugins de audio propios (Web Audio Modules 2.0)

Efectos e instrumentos para el navegador, hechos como [Web Audio Modules 2.0](https://www.webaudiomodules.com/):
sirven en cualquier anfitrión WAM. Nacieron para la caja de ritmos y el mixer de Pizarrita, pero
no dependen de ella: lo único que importan es `@webaudiomodules/sdk`.

## Plugins

| Carpeta | Qué es | Estado |
|---|---|---|
| `compresor` | Compresor (umbral, razón, ataque, relajación, rodilla, ganancia, mezcla) y limitador con techo que mira 5 ms hacia adelante. El cálculo corre en el hilo de audio. | 0.1.0 |

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

### Colores

Las carátulas usan variables CSS con un valor por defecto; la página las cambia desde afuera,
en cualquier elemento que contenga la carátula:

`--pzw-fondo` `--pzw-tinta` `--pzw-tinta2` `--pzw-borde` `--pzw-pantalla` `--pzw-acento`
`--pzw-nivel` `--pzw-reduccion` `--pzw-traza` `--pzw-letra`

## Armar

```sh
npm install
npm test            # la prueba del cálculo, con Node y sin navegador
bash armar.sh       # prueba y arma a dist/
bash armar.sh /ruta/al/sitio/wam   # además copia cada plugin armado a esa carpeta
```

Las funciones que van al hilo de audio se mandan como texto (`addFunctionModule`), por eso no se
minifica ni se baja la sintaxis.

## Cómo está ordenado

- `comun/controles.js`: perilla, casilla de número, interruptor y lienzo, comunes a todas las carátulas.
- `<plugin>/procesador.js`: el cálculo y el procesador (hilo de audio).
- `<plugin>/index.js`: el nodo y el módulo (lo que carga el anfitrión).
- `<plugin>/caratula.js`: la interfaz.
- `prueba.mjs`: mide el cálculo con números (un tono a −6 dB con umbral −18 y razón 4 tiene que salir a −15 dB, el limitador no puede pasar del techo, etc.).

## Licencia

Copyright (C) 2026 Juan Pablo Rapiman Risco

Estos plugins son software libre: pueden redistribuirse y modificarse bajo los términos de la
[GNU Affero General Public License](LICENSE) publicada por la Free Software Foundation,
versión 3 o (a elección) cualquier versión posterior (`AGPL-3.0-or-later`).

Se distribuyen con la esperanza de que sean útiles, pero SIN NINGUNA GARANTÍA. Quien
ofrezca una versión modificada a usuarios a través de una red debe poner a su
disposición el código fuente correspondiente (sección 13 de la licencia).

Lo armado en `dist/` incluye `@webaudiomodules/sdk` (licencia MIT).
