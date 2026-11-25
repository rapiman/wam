// Prueba de los idiomas de los plugins propios (comun/idiomas.js), y de que todo texto visible de
// las carátulas y de los parámetros esté en la tabla. `node idiomas/prueba.mjs`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { t, tEtiqueta, traducirInfo, idioma, _TEXTOS, _IDIOMAS } from '../comun/idiomas.js';

let fallas = 0;
const ok = (c, que) => {
  if (!c) {
    fallas += 1;
    console.log('FALLA:', que);
  }
};

// Cada fila, con los nueve idiomas y sin huecos.
for (const [es, fila] of Object.entries(_TEXTOS)) ok(Array.isArray(fila) && fila.length === _IDIOMAS.length && fila.every((x) => typeof x === 'string' && x.trim()), `«${es}» con sus ${_IDIOMAS.length} idiomas`);

// Buscar.
ok(t('Frecuencia', 'EN') === 'Frequency' && t('Frecuencia', 'JA') === '周波数' && t('Frecuencia', 'ES') === 'Frecuencia', 't en cada idioma');
ok(t('algo que no está', 'EN') === 'algo que no está' && t('Mezcla', 'XX') === 'Mezcla', 'lo que no está sale como vino');
ok(tEtiqueta('Banda 3: frecuencia', 'EN') === 'Band 3: frequency' && tEtiqueta('Banda 8', 'FR') === 'Bande 8' && tEtiqueta('Umbral', 'PT') === 'Limiar', 'las etiquetas del ecualizador, por partes');
const info = { tipo: { label: 'Tipo', choices: ['Pasa bajos', 'Muesca'], minValue: 0 }, b1q: { label: 'Banda 1: Q' } };
const en = traducirInfo(info, 'EN');
ok(en.tipo.label === 'Type' && en.tipo.choices[1] === 'Notch' && en.tipo.minValue === 0 && en.b1q.label === 'Band 1: Q', 'traducirInfo: nombres y opciones');
ok(info.tipo.label === 'Tipo' && traducirInfo(info, 'ES') === info, 'traducirInfo no cambia lo que recibe; en castellano, igual');
globalThis.window = { idioma: 'KO' };
ok(idioma() === 'KO', 'el idioma de Pizarrita (window.idioma)');
globalThis.window = { idioma: 'DE' };
ok(idioma() === 'ES', 'un idioma que no está: castellano');

// TODO TEXTO VISIBLE ESTÁ EN LA TABLA: lo que se pasa por t(…) en las carátulas, los nombres de los
// parámetros (`nombre:` de los núcleos y `label` del compresor y el ecualizador) y sus opciones.
const raiz = new URL('..', import.meta.url).pathname;
const archivos = [];
for (const d of readdirSync(raiz)) {
  if (['node_modules', 'dist', 'reverberacion', '.git'].includes(d) || !statSync(raiz + d).isDirectory()) continue;
  for (const f of readdirSync(raiz + d)) if (f.endsWith('.js') && f !== 'prueba.mjs' && d + '/' + f !== 'comun/idiomas.js') archivos.push(d + '/' + f);
}
const faltan = new Set();
const mirar = (x) => {
  if (!(x in _TEXTOS) && !/^[\d\s.,:/%dBoctkHz−+-]+$/.test(x) && x !== 'Q') faltan.add(x);
};
for (const a of archivos) {
  const s = readFileSync(raiz + a, 'utf8');
  for (const m of s.matchAll(/\bt\('([^']+)'\)/g)) mirar(m[1]);
  for (const m of s.matchAll(/\bt\(([^)]*\?[^)]*)\)/g)) for (const q of m[1].matchAll(/'([^']+)'/g)) mirar(q[1]);
  for (const m of s.matchAll(/nombre: '([^']+)'/g)) mirar(m[1]);
  for (const m of s.matchAll(/\b(?:f|b)\('\w+', '([^']+)'/g)) mirar(m[1]);
  for (const m of s.matchAll(/(?:TIPOS|TIPOS_FILTRO|PENDIENTES|FORMAS|DESTINOS) = \[([^\]]+)\]/g)) for (const q of m[1].matchAll(/'([^']+)'/g)) mirar(q[1]);
  // el sampler: nombres cortos, listas escritas ahí mismo, nombres con el número del vaivén y
  // los títulos de sus pestañas
  for (const m of s.matchAll(/corto: '([^']+)'/g)) mirar(m[1]);
  for (const m of s.matchAll(/opciones: \[([^\]]+)\]/g)) for (const q of m[1].matchAll(/'([^']+)'/g)) mirar(q[1]);
  for (const m of s.matchAll(/nombre: `([^`]+)\$\{k\}`/g)) for (const k of [1, 2]) mirar(`${m[1]}${k}`);
  for (const m of s.matchAll(/^\s*\['\w+', '([^']+)'\],$/gm)) mirar(m[1]);
  for (const m of s.matchAll(/label: `Banda \$\{b\}: ([^`]+)`/g)) mirar(m[1]);
  for (const m of s.matchAll(/titulo: '([^']+)'/g)) mirar(m[1]);
}
// el sampler arma muchos nombres por capa: cada parte de cada nombre, y cada opción, en la tabla
{
  const { nucleoSampler } = await import('../sampler/nucleo.js');
  for (const p of nucleoSampler().PARAMS) {
    const partes = p.nombre.replace(/^(Banda|Capa) \d+: /, '').split(': ');
    if (/^(Banda|Capa) \d+: /.test(p.nombre)) mirar(p.nombre.split(' ')[0]);
    for (const x of partes) if (!/ \d$/.test(x) || !(x in _TEXTOS)) mirar(x);
    if (p.corto) mirar(p.corto);
    for (const o of p.opciones || []) mirar(o);
  }
}
ok(faltan.size === 0, `textos sin traducir: ${[...faltan].join(' | ')}`);

console.log(fallas ? `${fallas} falla(s)` : 'todo bien');
process.exit(fallas ? 1 : 0);
