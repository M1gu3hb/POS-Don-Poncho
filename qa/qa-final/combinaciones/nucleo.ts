/**
 * DP-22 · COMBINACIONES: el núcleo puro (sin PICT, sin base, sin reloj).
 *
 * Un MODELO es una lista de parámetros con sus valores y una lista de combinaciones PROHIBIDAS
 * (las restricciones reales del sistema). Una TABLA es una lista de renglones, cada uno con un
 * valor por parámetro. Aquí vive todo lo que hace falta para:
 *
 *   · saber qué tuplas (pares o ternas) hay que cubrir: las que algún renglón completo y válido
 *     contiene (`tuplasRequeridas`);
 *   · comprobar que una tabla las cubre todas y no viola ninguna regla (`revisarTabla`) —ésta es
 *     la puerta que la CI corre sin el binario de PICT—;
 *   · generar una tabla a falta de PICT (`generarTabla`): voraz, determinista, con semilla.
 *
 * Nada de aquí lee archivos: los datos entran como argumentos.
 */

export interface Parametro {
  readonly nombre: string;
  readonly valores: readonly string[];
}

/** Una combinación que no puede existir: todos sus pares parámetro/valor a la vez. */
export type Prohibida = Readonly<Record<string, string>>;

export interface Modelo {
  readonly nombre: string;
  /** 2 = pares; 3 = ternas. */
  readonly fuerza: number;
  readonly parametros: readonly Parametro[];
  readonly prohibidas: readonly Prohibida[];
}

export type Fila = Readonly<Record<string, string>>;

/** Una tupla a cubrir: parámetro → valor, de `fuerza` parámetros distintos. */
export type Tupla = Readonly<Record<string, string>>;

export function violaReglas(modelo: Modelo, parcial: Fila): boolean {
  return modelo.prohibidas.some((regla) =>
    Object.entries(regla).every(([parametro, valor]) => parcial[parametro] === valor),
  );
}

/**
 * ¿Hay al menos un renglón completo y válido que contenga esta asignación parcial? Búsqueda con
 * retroceso; el modelo es chico, así que no hace falta nada más fino.
 */
export function esFactible(modelo: Modelo, parcial: Fila): boolean {
  if (violaReglas(modelo, parcial)) return false;
  const libres = modelo.parametros.filter((p) => parcial[p.nombre] === undefined);
  const buscar = (indice: number, actual: Fila): boolean => {
    const siguiente = libres[indice];
    if (siguiente === undefined) return true;
    return siguiente.valores.some((valor) => {
      const extendida = { ...actual, [siguiente.nombre]: valor };
      return !violaReglas(modelo, extendida) && buscar(indice + 1, extendida);
    });
  };
  return buscar(0, parcial);
}

/** Todas las combinaciones de `k` elementos de una lista, en orden. */
function combinaciones<T>(lista: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const salida: T[][] = [];
  lista.forEach((elemento, i) => {
    for (const resto of combinaciones(lista.slice(i + 1), k - 1)) salida.push([elemento, ...resto]);
  });
  return salida;
}

function productoCartesiano(parametros: readonly Parametro[]): Tupla[] {
  return parametros.reduce<Tupla[]>(
    (acumulado, parametro) =>
      acumulado.flatMap((tupla) =>
        parametro.valores.map((valor) => ({ ...tupla, [parametro.nombre]: valor })),
      ),
    [{}],
  );
}

/** Las tuplas de `fuerza` parámetros que algún renglón válido contiene: lo que hay que cubrir. */
export function tuplasRequeridas(modelo: Modelo): Tupla[] {
  return combinaciones(modelo.parametros, modelo.fuerza).flatMap((grupo) =>
    productoCartesiano(grupo).filter((tupla) => esFactible(modelo, tupla)),
  );
}

export function contiene(fila: Fila, tupla: Tupla): boolean {
  return Object.entries(tupla).every(([parametro, valor]) => fila[parametro] === valor);
}

export function claveDeTupla(tupla: Tupla): string {
  return Object.keys(tupla)
    .sort()
    .map((parametro) => `${parametro}=${tupla[parametro] ?? ''}`)
    .join(' · ');
}

export interface RevisionDeTabla {
  readonly requeridas: number;
  readonly sinCubrir: readonly string[];
  /** Renglones con un parámetro que falta, sobra o con un valor que el modelo no tiene. */
  readonly malFormados: readonly number[];
  /** Renglones que caen en una combinación prohibida. */
  readonly prohibidos: readonly number[];
  readonly repetidos: readonly number[];
}

export function revisarTabla(modelo: Modelo, tabla: readonly Fila[]): RevisionDeTabla {
  const nombres = modelo.parametros.map((p) => p.nombre);
  const malFormados: number[] = [];
  const prohibidos: number[] = [];
  const repetidos: number[] = [];
  const vistos = new Set<string>();
  tabla.forEach((fila, indice) => {
    const claves = Object.keys(fila);
    const bien =
      claves.length === nombres.length &&
      modelo.parametros.every((p) => {
        const valor = fila[p.nombre];
        return valor !== undefined && p.valores.includes(valor);
      });
    if (!bien) {
      malFormados.push(indice);
      return;
    }
    if (violaReglas(modelo, fila)) prohibidos.push(indice);
    const huella = nombres.map((n) => fila[n]).join('\u0001');
    if (vistos.has(huella)) repetidos.push(indice);
    vistos.add(huella);
  });
  const requeridas = tuplasRequeridas(modelo);
  const sinCubrir = requeridas
    .filter((tupla) => !tabla.some((fila) => contiene(fila, tupla)))
    .map(claveDeTupla);
  return { requeridas: requeridas.length, sinCubrir, malFormados, prohibidos, repetidos };
}

/** La tabla está bien si cubre todo y no tiene renglones malos ni repetidos. */
export function tablaCompleta(revision: RevisionDeTabla): boolean {
  return (
    revision.sinCubrir.length === 0 &&
    revision.malFormados.length === 0 &&
    revision.prohibidos.length === 0 &&
    revision.repetidos.length === 0
  );
}

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da la misma tabla. */
export function azar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Generador voraz (al estilo AETG), determinista con su semilla: cada renglón nuevo parte de una
 * tupla sin cubrir y completa los demás parámetros con el valor que cubre más tuplas nuevas.
 * Sin PICT en la máquina, éste es el que arma las tablas guardadas.
 */
export function generarTabla(modelo: Modelo, semilla: number): Fila[] {
  const dado = azar(semilla);
  const pendientes = new Map(tuplasRequeridas(modelo).map((tupla) => [claveDeTupla(tupla), tupla]));
  const tabla: Fila[] = [];
  const grupos = combinaciones(modelo.parametros, modelo.fuerza);

  const nuevasQueCubre = (fila: Fila): number =>
    [...pendientes.values()].filter((tupla) => contiene(fila, tupla)).length;

  while (pendientes.size > 0) {
    const candidatas = [...pendientes.values()];
    const inicio = candidatas[Math.floor(dado() * candidatas.length)];
    if (inicio === undefined) break;
    let fila: Record<string, string> = { ...inicio };
    // Los parámetros que faltan, en orden barajado para que ninguno mande siempre.
    const faltan = modelo.parametros
      .filter((p) => fila[p.nombre] === undefined)
      .map((p) => ({ p, orden: dado() }))
      .sort((a, b) => a.orden - b.orden)
      .map(({ p }) => p);
    for (const parametro of faltan) {
      let mejor: { valor: string; puntos: number } | null = null;
      for (const valor of parametro.valores) {
        const prueba = { ...fila, [parametro.nombre]: valor };
        if (!esFactible(modelo, prueba)) continue;
        // Puntos: tuplas pendientes que ya quedan dentro con lo asignado hasta aquí.
        const puntos =
          [...pendientes.values()].filter((tupla) => contiene(prueba, tupla)).length +
          dado() * 0.001;
        if (mejor === null || puntos > mejor.puntos) mejor = { valor, puntos };
      }
      if (mejor === null) throw new Error(`Sin valor factible para ${parametro.nombre}.`);
      fila = { ...fila, [parametro.nombre]: mejor.valor };
    }
    if (nuevasQueCubre(fila) === 0) throw new Error('El generador no avanza: renglón inútil.');
    tabla.push(fila);
    for (const grupo of grupos) {
      const tupla: Record<string, string> = {};
      for (const p of grupo) tupla[p.nombre] = fila[p.nombre] ?? '';
      pendientes.delete(claveDeTupla(tupla));
    }
  }
  return tabla;
}

/** El modelo en la sintaxis de PICT (Microsoft), por si hay binario para generar la tabla. */
export function modeloParaPict(modelo: Modelo): string {
  const lineas = modelo.parametros.map((p) => `${p.nombre}: ${p.valores.join(', ')}`);
  const reglas = modelo.prohibidas.map((regla) => {
    const entradas = Object.entries(regla);
    const ultima = entradas[entradas.length - 1];
    if (ultima === undefined) throw new Error('Regla prohibida vacía.');
    const antes = entradas
      .slice(0, -1)
      .map(([p, v]) => `[${p}] = "${v}"`)
      .join(' AND ');
    return antes === ''
      ? `[${ultima[0]}] <> "${ultima[1]}";`
      : `IF ${antes} THEN [${ultima[0]}] <> "${ultima[1]}";`;
  });
  return [...lineas, '', ...reglas, ''].join('\n');
}
