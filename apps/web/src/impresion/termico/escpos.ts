/**
 * LOS BYTES ESC/POS (DP-20 · refuerzo §1 y §2). Puro.
 *
 * Sólo lo que el POS manda de verdad: la imagen (en franjas `GS v 0`, o por columnas `ESC *`
 * para las impresoras que no entienden la primera), el avance, el corte y el pulso del cajón.
 * Cada orden vive en su función para que el laboratorio pueda probarlas una por una y el
 * emulador (`emulador.ts`) las lea de vuelta.
 */
import { bytesPorFila, empaquetarFilas, puntoEn, type MapaDeBits } from './mapa.ts';

const ESC = 0x1b;
const GS = 0x1d;
const DLE = 0x10;
const LF = 0x0a;

/** Filas por franja cuando el perfil no dice otra cosa: ni tan grande que llene el búfer. */
export const FRANJA_POR_OMISION = 64;
/** `GS v 0` lleva el alto en dos bytes, pero las impresoras viejas se ahogan mucho antes. */
export const FRANJA_MAXIMA = 1024;

export function unir(...partes: readonly Uint8Array[]): Uint8Array {
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    salida.set(parte, posicion);
    posicion += parte.length;
  }
  return salida;
}

const bytes = (...valores: readonly number[]): Uint8Array => Uint8Array.from(valores);

function enRango(valor: number, minimo: number, maximo: number, nombre: string): number {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(
      `${nombre} debe ser un entero entre ${String(minimo)} y ${String(maximo)}.`,
    );
  }
  return valor;
}

/** `ESC @`: deja la impresora como recién encendida (sin estilos ni márgenes de otro trabajo). */
export function iniciar(): Uint8Array {
  return bytes(ESC, 0x40);
}

/**
 * La imagen en franjas `GS v 0`: cada franja es una orden completa que la impresora imprime y
 * suelta, así su búfer nunca tiene que guardar el ticket entero.
 */
export function imagenEnFranjas(
  mapa: MapaDeBits,
  filasPorFranja = FRANJA_POR_OMISION,
): Uint8Array[] {
  enRango(filasPorFranja, 1, FRANJA_MAXIMA, 'Las filas por franja');
  const porFila = bytesPorFila(mapa.ancho);
  const franjas: Uint8Array[] = [];
  for (let desde = 0; desde < mapa.alto; desde += filasPorFranja) {
    const filas = Math.min(filasPorFranja, mapa.alto - desde);
    franjas.push(
      unir(
        bytes(GS, 0x76, 0x30, 0, porFila & 0xff, porFila >> 8, filas & 0xff, filas >> 8),
        empaquetarFilas(mapa, desde, filas),
      ),
    );
  }
  return franjas;
}

/** Alto de cada banda de `ESC *` en modo de 24 puntos. */
export const BANDA_DE_COLUMNAS = 24;

/**
 * La alternativa `ESC * 33` (24 puntos, doble densidad): la imagen por columnas, banda por
 * banda, con el interlineado en 24 puntos para que las bandas no dejen rayas blancas.
 */
export function imagenPorColumnas(mapa: MapaDeBits): Uint8Array[] {
  const bandas: Uint8Array[] = [bytes(ESC, 0x33, BANDA_DE_COLUMNAS)];
  for (let desde = 0; desde < mapa.alto; desde += BANDA_DE_COLUMNAS) {
    const datos = new Uint8Array(mapa.ancho * 3);
    for (let x = 0; x < mapa.ancho; x += 1) {
      for (let fila = 0; fila < BANDA_DE_COLUMNAS; fila += 1) {
        if (puntoEn(mapa, x, desde + fila) === 1) {
          const indice = x * 3 + (fila >> 3);
          datos[indice] = (datos[indice] ?? 0) | (0x80 >> (fila & 7));
        }
      }
    }
    bandas.push(unir(bytes(ESC, 0x2a, 33, mapa.ancho & 0xff, mapa.ancho >> 8), datos, bytes(LF)));
  }
  bandas.push(bytes(ESC, 0x32));
  return bandas;
}

/** `ESC d n`: avanza n líneas (para que el corte no se coma el final). */
export function avanzar(lineas: number): Uint8Array {
  if (lineas === 0) return new Uint8Array(0);
  return bytes(ESC, 0x64, enRango(lineas, 0, 255, 'Las líneas de avance'));
}

export type Corte =
  'completo' | 'parcial' | 'completo-con-avance' | 'parcial-con-avance' | 'ninguno';

export const CORTES: readonly Corte[] = [
  'parcial-con-avance',
  'completo-con-avance',
  'parcial',
  'completo',
  'ninguno',
];

/** `GS V`: 0 y 1 cortan donde está el papel; 65 y 66 avanzan hasta la cuchilla y cortan. */
export function cortar(corte: Corte): Uint8Array {
  switch (corte) {
    case 'completo':
      return bytes(GS, 0x56, 0);
    case 'parcial':
      return bytes(GS, 0x56, 1);
    case 'completo-con-avance':
      return bytes(GS, 0x56, 65, 0);
    case 'parcial-con-avance':
      return bytes(GS, 0x56, 66, 0);
    case 'ninguno':
      return new Uint8Array(0);
  }
}

export type PinDelCajon = 2 | 5;

/** Cada unidad de `ESC p` son 2 ms. */
const MS_POR_UNIDAD = 2;
export const PULSO_ENCENDIDO_MS = 50;
export const PULSO_APAGADO_MS = 500;

/** `ESC p m t1 t2`: el pulso que abre el cajón, por el pin 2 o el 5 del conector. */
export function pulsoDelCajon(
  pin: PinDelCajon,
  encendidoMs = PULSO_ENCENDIDO_MS,
  apagadoMs = PULSO_APAGADO_MS,
): Uint8Array {
  const unidades = (ms: number, nombre: string): number =>
    enRango(Math.round(ms / MS_POR_UNIDAD), 1, 255, nombre);
  return bytes(
    ESC,
    0x70,
    pin === 2 ? 0 : 1,
    unidades(encendidoMs, 'El pulso encendido (en unidades de 2 ms)'),
    unidades(apagadoMs, 'El pulso apagado (en unidades de 2 ms)'),
  );
}

/** `DLE DC4 1 m t`: el pulso en tiempo real (la impresora lo atiende aunque esté ocupada). */
export function pulsoEnTiempoReal(pin: PinDelCajon, decimasDeSegundo = 2): Uint8Array {
  return bytes(
    DLE,
    0x14,
    1,
    pin === 2 ? 0 : 1,
    enRango(decimasDeSegundo, 1, 8, 'El tiempo del pulso'),
  );
}

export type PreguntaDeEstado = 1 | 2 | 3 | 4;

/** `DLE EOT n`: 1 la impresora, 2 por qué está fuera de línea, 3 el error, 4 el papel. */
export function pedirEstado(pregunta: PreguntaDeEstado): Uint8Array {
  return bytes(DLE, 0x04, pregunta);
}

export interface EstadoLeido {
  readonly enLinea?: boolean;
  readonly cajonAbierto?: boolean;
  readonly tapaAbierta?: boolean;
  readonly sinPapel?: boolean;
}

/** Lo que dice el byte con que la impresora contesta a `DLE EOT n`. */
export function leerEstado(pregunta: PreguntaDeEstado, respuesta: number): EstadoLeido {
  switch (pregunta) {
    case 1:
      // Bit 2: el pin 3 del conector del cajón (bajo = abierto en la mayoría). Bit 3: fuera de línea.
      return { cajonAbierto: (respuesta & 0x04) === 0, enLinea: (respuesta & 0x08) === 0 };
    case 2:
      return { tapaAbierta: (respuesta & 0x04) !== 0, sinPapel: (respuesta & 0x20) !== 0 };
    case 4:
      return { sinPapel: (respuesta & 0x60) !== 0 };
    case 3:
      return {};
  }
}
