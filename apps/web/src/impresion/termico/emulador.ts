/**
 * UNA IMPRESORA FALSA (DP-20 · refuerzo §1.5 y encargo Parte 7). Pura.
 *
 * Lee los bytes ESC/POS que mandaríamos y devuelve el papel que saldría: la imagen punto por
 * punto, dónde cortó y cuántas veces pulsó el cajón. Con ella las pruebas comprueban que lo que
 * se codificó es EXACTAMENTE lo que se dibujó, y el laboratorio enseña la vista previa sin gastar
 * papel. Entiende lo que el POS manda; ante una orden que no conoce LANZA: un byte de más en una
 * térmica real es una hoja de basura, y aquí debe ser una prueba en rojo.
 */
import { bytesPorFila, type MapaDeBits } from './mapa.ts';

const ESC = 0x1b;
const GS = 0x1d;
const DLE = 0x10;
const LF = 0x0a;

/** El interlineado de fábrica (`ESC 2`): 30 puntos, un sexto de pulgada a 180 dpi. */
const INTERLINEADO_DE_FABRICA = 30;
const BANDA = 24;

export interface PulsoLeido {
  readonly pin: 2 | 5;
  readonly enTiempoReal: boolean;
}

export interface PapelImpreso extends MapaDeBits {
  /** La fila en la que cayó cada corte, y si fue parcial. */
  readonly cortes: readonly { readonly fila: number; readonly parcial: boolean }[];
  readonly pulsos: readonly PulsoLeido[];
  /** Los renglones de texto simple que llegaron (el emulador no dibuja letras). */
  readonly texto: readonly string[];
  readonly preguntasDeEstado: readonly number[];
}

export class OrdenDesconocida extends Error {
  constructor(posicion: number, byte: number) {
    super(
      `ESC/POS: orden que el emulador no conoce en el byte ${String(posicion)} (0x${byte.toString(16)}).`,
    );
    this.name = 'OrdenDesconocida';
  }
}

class Papel {
  readonly filas: Uint8Array[] = [];
  readonly cortes: { fila: number; parcial: boolean }[] = [];
  readonly pulsos: PulsoLeido[] = [];
  readonly texto: string[] = [];
  readonly preguntas: number[] = [];
  interlineado = INTERLINEADO_DE_FABRICA;
  /** La banda de `ESC *` que espera su salto de línea. */
  banda: Uint8Array[] | null = null;
  renglon = '';

  constructor(readonly ancho: number) {}

  enBlanco(cuantas: number): void {
    for (let i = 0; i < cuantas; i += 1) this.filas.push(new Uint8Array(this.ancho));
  }

  saltoDeLinea(): void {
    if (this.banda !== null) {
      this.filas.push(...this.banda);
      this.enBlanco(Math.max(0, this.interlineado - BANDA));
      this.banda = null;
      return;
    }
    if (this.renglon !== '') {
      this.texto.push(this.renglon);
      this.renglon = '';
    }
    this.enBlanco(this.interlineado);
  }
}

/** Lee `cuantos` bytes desde `desde` o lanza si el trabajo se corta a la mitad. */
function tramo(datos: Uint8Array, desde: number, cuantos: number): Uint8Array {
  if (desde + cuantos > datos.length) {
    throw new RangeError(`ESC/POS: el trabajo se corta en el byte ${String(desde)}.`);
  }
  return datos.subarray(desde, desde + cuantos);
}

function leerRaster(papel: Papel, datos: Uint8Array, i: number): number {
  const [modo = 0, xL = 0, xH = 0, yL = 0, yH = 0] = tramo(datos, i, 5);
  if (modo !== 0 && modo !== 48) throw new OrdenDesconocida(i, modo);
  const porFila = xL | (xH << 8);
  const filas = yL | (yH << 8);
  if (porFila > bytesPorFila(papel.ancho)) {
    throw new RangeError(
      `ESC/POS: la imagen mide ${String(porFila * 8)} puntos y el papel ${String(papel.ancho)}.`,
    );
  }
  const cuerpo = tramo(datos, i + 5, porFila * filas);
  for (let fila = 0; fila < filas; fila += 1) {
    const puntos = new Uint8Array(papel.ancho);
    for (let x = 0; x < Math.min(papel.ancho, porFila * 8); x += 1) {
      const byte = cuerpo[fila * porFila + (x >> 3)] ?? 0;
      puntos[x] = (byte & (0x80 >> (x & 7))) === 0 ? 0 : 1;
    }
    papel.filas.push(puntos);
  }
  return i + 5 + porFila * filas;
}

function leerColumnas(papel: Papel, datos: Uint8Array, i: number): number {
  const [modo = 0, nL = 0, nH = 0] = tramo(datos, i, 3);
  if (modo !== 33) throw new OrdenDesconocida(i, modo);
  const columnas = nL | (nH << 8);
  const cuerpo = tramo(datos, i + 3, columnas * 3);
  const banda = Array.from({ length: BANDA }, () => new Uint8Array(papel.ancho));
  for (let x = 0; x < Math.min(columnas, papel.ancho); x += 1) {
    for (let fila = 0; fila < BANDA; fila += 1) {
      const byte = cuerpo[x * 3 + (fila >> 3)] ?? 0;
      const filaDeLaBanda = banda[fila];
      if (filaDeLaBanda !== undefined)
        filaDeLaBanda[x] = (byte & (0x80 >> (fila & 7))) === 0 ? 0 : 1;
    }
  }
  papel.banda = banda;
  return i + 3 + columnas * 3;
}

function leerEsc(papel: Papel, datos: Uint8Array, i: number): number {
  const orden = datos[i];
  switch (orden) {
    case 0x40:
      papel.interlineado = INTERLINEADO_DE_FABRICA;
      return i + 1;
    case 0x32:
      papel.interlineado = INTERLINEADO_DE_FABRICA;
      return i + 1;
    case 0x33:
      papel.interlineado = tramo(datos, i + 1, 1)[0] ?? 0;
      return i + 2;
    case 0x64:
      papel.enBlanco((tramo(datos, i + 1, 1)[0] ?? 0) * papel.interlineado);
      return i + 2;
    case 0x4a:
      papel.enBlanco(tramo(datos, i + 1, 1)[0] ?? 0);
      return i + 2;
    case 0x70: {
      const [pin = 0] = tramo(datos, i + 1, 3);
      papel.pulsos.push({ pin: pin === 0 || pin === 48 ? 2 : 5, enTiempoReal: false });
      return i + 4;
    }
    case 0x2a:
      return leerColumnas(papel, datos, i + 1);
    default:
      throw new OrdenDesconocida(i, orden ?? 0);
  }
}

function leerGs(papel: Papel, datos: Uint8Array, i: number): number {
  const orden = datos[i];
  if (orden === 0x76 && datos[i + 1] === 0x30) return leerRaster(papel, datos, i + 2);
  if (orden === 0x56) {
    const modo = tramo(datos, i + 1, 1)[0] ?? 0;
    if (modo === 0 || modo === 1 || modo === 48 || modo === 49) {
      papel.cortes.push({ fila: papel.filas.length, parcial: modo === 1 || modo === 49 });
      return i + 2;
    }
    if (modo === 65 || modo === 66) {
      papel.enBlanco(tramo(datos, i + 2, 1)[0] ?? 0);
      papel.cortes.push({ fila: papel.filas.length, parcial: modo === 66 });
      return i + 3;
    }
    throw new OrdenDesconocida(i + 1, modo);
  }
  throw new OrdenDesconocida(i, orden ?? 0);
}

function leerDle(papel: Papel, datos: Uint8Array, i: number): number {
  const orden = datos[i];
  if (orden === 0x04) {
    papel.preguntas.push(tramo(datos, i + 1, 1)[0] ?? 0);
    return i + 2;
  }
  if (orden === 0x14) {
    const [funcion = 0, pin = 0] = tramo(datos, i + 1, 3);
    if (funcion !== 1) throw new OrdenDesconocida(i + 1, funcion);
    papel.pulsos.push({ pin: pin === 0 ? 2 : 5, enTiempoReal: true });
    return i + 4;
  }
  throw new OrdenDesconocida(i, orden ?? 0);
}

/** Imprime `datos` en un papel de `anchoEnPuntos` y devuelve lo que salió. */
export function emular(datos: Uint8Array, anchoEnPuntos: number): PapelImpreso {
  const papel = new Papel(anchoEnPuntos);
  let i = 0;
  while (i < datos.length) {
    const byte = datos[i] ?? 0;
    if (byte === ESC) i = leerEsc(papel, datos, i + 1);
    else if (byte === GS) i = leerGs(papel, datos, i + 1);
    else if (byte === DLE) i = leerDle(papel, datos, i + 1);
    else if (byte === LF) {
      papel.saltoDeLinea();
      i += 1;
    } else if (byte >= 0x20) {
      papel.renglon += String.fromCharCode(byte);
      i += 1;
    } else if (byte === 0x0d) {
      i += 1;
    } else {
      throw new OrdenDesconocida(i, byte);
    }
  }
  if (papel.renglon !== '') papel.texto.push(papel.renglon);
  const puntos = new Uint8Array(papel.ancho * papel.filas.length);
  papel.filas.forEach((fila, y) => {
    puntos.set(fila, y * papel.ancho);
  });
  return {
    ancho: papel.ancho,
    alto: papel.filas.length,
    puntos,
    cortes: papel.cortes,
    pulsos: papel.pulsos,
    texto: papel.texto,
    preguntasDeEstado: papel.preguntas,
  };
}
