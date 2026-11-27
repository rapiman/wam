// LOS PRESETS DEL SAMPLER (2026-11-26, JP: «presets que se puedan grabar»; un preset es el
// instrumento entero, como un programa del Korg M1: sus zonas, sus capas —los osciladores— y todos
// los parámetros). Un preset es el mismo estado que guarda la caja (`getState`): los parámetros,
// el instrumento y la dirección de cada audio. Un audio abierto desde un archivo del computador no
// tiene dirección: no queda en el preset.
//
// Dónde quedan:
// - de fábrica: los de abajo (los ajustes probados con las grabaciones);
// - en el navegador (localStorage): los propios, en este computador y este navegador;
// - en un archivo .json que se baja y se sube (para guardarlo aparte o pasarlo);
// - en la caja de ritmos, si el anfitrión lo ofrece (2026-11-27, JP eligió la caja): `nodo.pz.presets()`
//   → [{ nombre, datos }], `nodo.pz.guardarPreset({ nombre, datos })` y `nodo.pz.borrarPreset(nombre)`.
//   Los ve cualquiera que abra esa caja. Fuera de Pizarrita no están y el grupo no sale.
//
// Sin dependencias del navegador al importarlo (las pruebas lo cargan en Node).

export const FORMATO = 'pz-sampler-preset';
const LLAVE = 'pz-wam-sampler-presets';

const SOPLO = { zonas: [{ baja: 0, alta: 127, raiz: 60, capas: [{ mod: {} }] }] };
// lo que va debajo de todos los de soplo: el volumen como lo usan las pruebas de sonido
const BASE_SOPLO = { vat: 30, vrt: 120, vvs: 0 };

// Los de fábrica: el nombre (castellano, se traduce al mostrarlo), el instrumento y los
// parámetros de la capa 1 que cambian (los demás quedan como vienen).
export const FABRICA = [
  {
    nombre: 'Trutruka (cañería de agua y cacho de vaca)',
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, stn: 28, stf: -50, sgm: 1, sdc: 20, slh: 35, sdh: 90, sfh: 50, slb: 1, slg: 1, slt: 60, sai: 60, sru: 15, sgl: 30, srs: 30, svn: 20, vat: 30, vrt: 80, sds: 20, sdt: 300 },
  },
  {
    nombre: 'Ñolkiñ de cañería (gas y cacho de cabra)',
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, stn: 43, stf: -30, sgm: 1, slb: 1, ssn: 1, sdc: 10, slh: 18, sdh: 45, sfh: 60, slg: 1, slt: 80, sgl: 40, srs: 40, svn: 30, sai: 55, vat: 100, vrt: 80, sin: 18, siv: 6, sca: 30, sru: 100, sbo: 100 },
  },
  {
    nombre: 'Ñolkiñ de tallo (con cono de hoja)',
    inst: SOPLO,
    capa1: { ...BASE_SOPLO, smt: 1, stb: 1, sgm: 1, slm: 1, slc: 145, sdc: 20, slh: 20, sdh: 80, sfh: 0, spa: 30, scb: 50, ssn: 1, slb: 1, sgl: 40, srs: 40, svn: 30, sai: 75, vrt: 80, sin: 18, siv: 6, sru: 20, sbo: 40, sca: 100, vat: 160, stc: 6 },
  },
];

// El estado (como el de `getState`) de un preset de fábrica: todos los parámetros como vienen,
// con los suyos encima.
export function estadoDeFabrica(P, params) {
  const parameterValues = {};
  for (const p of params) parameterValues[p.id] = { id: p.id, value: p.defecto, normalized: false };
  for (const [k, x] of Object.entries(P.capa1 || {})) {
    const id = `c1${k}`;
    if (parameterValues[id]) parameterValues[id].value = x;
  }
  return { parameterValues, inst: JSON.parse(JSON.stringify(P.inst)), muestras: {} };
}

// El paquete que va en un archivo o en la caja.
export const empaquetar = (nombre, estado) => ({ formato: FORMATO, version: 1, nombre, estado });
// Lo contrario: el estado de un paquete, o null si no es un preset del sampler.
export function desempaquetar(d) {
  if (!d || typeof d !== 'object' || d.formato !== FORMATO || !d.estado || typeof d.estado !== 'object') return null;
  return { nombre: typeof d.nombre === 'string' ? d.nombre : '', estado: d.estado };
}
// Los audios que no quedan (abiertos desde el computador): cuántos.
export const sinDireccion = (nodo) => Object.values(nodo.muestras || {}).filter((x) => !x.url).length;

// Los propios, en el navegador. Si el navegador no deja guardar, quedan vacíos (sin error).
export function leerPropios() {
  try {
    const l = JSON.parse(globalThis.localStorage?.getItem(LLAVE) || '[]');
    return Array.isArray(l) ? l.filter((x) => x && typeof x.nombre === 'string' && x.estado) : [];
  } catch {
    return [];
  }
}
export function guardarPropio(nombre, estado) {
  const l = leerPropios().filter((x) => x.nombre !== nombre);
  l.push({ nombre, estado });
  l.sort((a, b) => a.nombre.localeCompare(b.nombre));
  try {
    globalThis.localStorage.setItem(LLAVE, JSON.stringify(l));
    return true;
  } catch {
    return false;
  }
}
export function borrarPropio(nombre) {
  try {
    globalThis.localStorage.setItem(LLAVE, JSON.stringify(leerPropios().filter((x) => x.nombre !== nombre)));
  } catch {
    /* sin almacenamiento */
  }
}
