// PHASER — plugin WAM 2.0 propio (2026-11-23). El sonido y los parámetros: `nucleo.js`; lo demás
// lo pone el molde (`comun/molde.js`) y la carátula común.
import descriptor from './descriptor.json';
import { hacerModulo } from '../comun/molde.js';
import { caratulaSimple } from '../comun/caratulaSimple.js';
import { nucleoPhaser } from './nucleo.js';

const N = nucleoPhaser();

export default hacerModulo({
  descriptor,
  nucleo: nucleoPhaser,
  caratula: (nodo) => caratulaSimple(nodo, { titulo: 'Phaser', PARAMS: N.PARAMS }),
});
