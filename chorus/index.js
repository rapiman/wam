// CHORUS — plugin WAM 2.0 propio (2026-11-23). El sonido es el retardo con vaivén de
// `comun/nucleoRetardo.js` (el mismo del flanger, con otros rangos); lo demás lo pone el molde.
import descriptor from './descriptor.json';
import { hacerModulo } from '../comun/molde.js';
import { caratulaSimple } from '../comun/caratulaSimple.js';
import { nucleoRetardo, CHORUS } from '../comun/nucleoRetardo.js';

const N = nucleoRetardo(CHORUS);

export default hacerModulo({
  descriptor,
  nucleo: nucleoRetardo,
  config: CHORUS,
  caratula: (nodo) => caratulaSimple(nodo, { titulo: 'Chorus', PARAMS: N.PARAMS }),
});
