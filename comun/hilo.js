// MANDAR AL HILO DE AUDIO UNA FUNCIÓN QUE RECIBE OTRAS FUNCIONES.
//
// `addFunctionModule` del SDK manda una función como texto y le pasa argumentos que caben en
// JSON. Cuando lo que hay que pasar es OTRA función (un núcleo de cálculo que también usa la
// carátula), se arma el mismo texto a mano: `(fn)(moduleId, función1, función2…)`.
// Todas tienen que bastarse solas (sin imports ni variables de afuera) y no se minifican.
export function mandarConFunciones(audioWorklet, fn, moduleId, ...funciones) {
  const texto = `(${fn.toString()})(${JSON.stringify(moduleId)}${funciones.map((f) => `, ${f.toString()}`).join('')});`;
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/javascript' }));
  return audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
}
