// MANDAR AL HILO DE AUDIO UNA FUNCIÓN QUE RECIBE OTRAS FUNCIONES (Y DATOS).
//
// `addFunctionModule` del SDK manda una función como texto y le pasa argumentos que caben en
// JSON. Cuando lo que hay que pasar es OTRA función (un núcleo de cálculo que también usa la
// carátula), se arma el mismo texto a mano: `(fn)(moduleId, cosa1, cosa2…)`, donde cada cosa es
// una función (va como texto) o un dato (va como JSON).
// Las funciones tienen que bastarse solas (sin imports ni variables de afuera) y no se minifican.
export function mandarConFunciones(audioWorklet, fn, moduleId, ...cosas) {
  const args = cosas.map((c) => `, ${typeof c === 'function' ? c.toString() : JSON.stringify(c === undefined ? null : c)}`).join('');
  const texto = `(${fn.toString()})(${JSON.stringify(moduleId)}${args});`;
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/javascript' }));
  return audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
}
