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
ZONA = { baja, alta, raiz, golpe, capas: [CAPA…] }      hasta 3 capas
CAPA = { m, ini, lIni, lFin, fin, loop, alt: [a, l, r], gan, pan, afinar }
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

1. **El reproductor** — HECHO el corazón (`nucleo.js`, 18 comprobaciones): zonas, capas, las tres
   partes con o sin la altura de la nota, golpe, envolvente. FALTA: el procesador (recibe MIDI y
   las muestras), la carátula (teclado con las zonas, la forma de onda con las marcas que se
   arrastran, cargar audios) y el módulo.
2. **Las tajadas**: cortar un audio en pedazos (marcas que se mueven) y detectar los golpes; cada
   pedazo, una zona de golpe en una tecla.
3. **Filtro, efectos y moduladores**: filtro por voz con su envolvente; distorsión, ruido, desafinado;
   osciladores lentos (LFO) que van a la altura, el volumen, el filtro o el efecto.
4. **Estirar al tempo** cada parte (necesita que la caja y Edit Pro le avisen el tempo).
5. **Osciladores de síntesis** «al estilo Massive», como capas además de los audios.
6. **La pieza de Pizarrita**: elegir, subir y grabar audios desde la carátula.
