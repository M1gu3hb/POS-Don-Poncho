/**
 * LOS NOMBRES QUE LEE UNA PERSONA (DP-20 · laboratorio). Puro.
 *
 * Cortes, conexiones y lenguajes dichos con sus nombres claros, y lo que todavía no llegó con su
 * razón: lo que no está disponible se ve desactivado y diciendo por qué, nunca escondido.
 */
import type { Corte } from '../termico/escpos.ts';
import { describirDestino, type Conexion, type Destino, type Lenguaje } from '../termico/perfil.ts';

export const NOMBRES_DE_CORTES: Readonly<Record<Corte, string>> = {
  'parcial-con-avance': 'Parcial con avance (GS V 66)',
  'completo-con-avance': 'Completo con avance (GS V 65)',
  parcial: 'Parcial (GS V 1)',
  completo: 'Completo (GS V 0)',
  ninguno: 'Sin cortador',
};

/** Qué hace cada corte, en una frase. */
export function ayudaDelCorte(corte: Corte): string {
  switch (corte) {
    case 'ninguno':
      return 'La impresora avanza y se corta a mano.';
    case 'parcial-con-avance':
      return 'Avanza hasta la cuchilla y corta dejando una pestaña: el ticket no se cae.';
    case 'completo-con-avance':
      return 'Avanza hasta la cuchilla y corta todo el papel.';
    case 'parcial':
      return 'Corta donde está el papel, dejando una pestaña. Puede comerse el final.';
    case 'completo':
      return 'Corta donde está el papel, todo. Puede comerse el final.';
  }
}

export const NOMBRES_DE_CONEXIONES: Readonly<Record<Conexion, string>> = {
  spooler: 'Directo a la impresora de Windows (RAW)',
  driver: 'Driver de Windows (imagen)',
  red: 'Red (IP y puerto)',
  usb: 'USB',
  bluetooth: 'Bluetooth',
  serial: 'Puerto serie (COM)',
};

export interface OpcionDeLenguaje {
  readonly valor: Lenguaje;
  readonly nombre: string;
  readonly disponible: boolean;
  /** Por qué no se puede elegir. */
  readonly nota?: string;
}

export const OPCIONES_DE_LENGUAJE: readonly OpcionDeLenguaje[] = [
  { valor: 'escpos-imagen', nombre: 'ESC/POS por imagen (recomendado)', disponible: true },
  { valor: 'escpos-columnas', nombre: 'ESC/POS por columnas (ESC *)', disponible: true },
  { valor: 'driver', nombre: 'Driver de Windows', disponible: true },
  {
    valor: 'escpos-texto',
    nombre: 'ESC/POS por texto',
    disponible: false,
    nota: 'Plan B · todavía no disponible',
  },
];

export interface Pendiente {
  readonly titulo: string;
  readonly motivo: string;
}

/** Lo que el encargo nombra y todavía no llegó: se enseña, desactivado, con su razón. */
export const TODAVIA_NO_DISPONIBLE: readonly Pendiente[] = [
  {
    titulo: 'Texto ESC/POS por página de códigos (CP437, CP850, CP858, Windows-1252, ISO 8859-1)',
    motivo:
      'Necesita su hoja de acentos para comprobar cada página de códigos. Hoy el ticket sale por ' +
      'imagen, que no depende de ellas.',
  },
  {
    titulo: 'Star (Line y StarPRNT)',
    motivo: 'Las impresoras Star hablan otro lenguaje y falta su codificador.',
  },
  {
    titulo: 'Código de barras y QR nativos de la impresora',
    motivo: 'Hoy salen dentro de la imagen; los nativos llegan con el texto ESC/POS.',
  },
  {
    titulo: 'SDK de Sunmi y de iMin',
    motivo: 'Piden el SDK del fabricante dentro de la app de Android y todavía no está incluido.',
  },
];

/** ¿Es la misma impresora? Misma conexión y mismo «dónde» (nombre, USB, MAC…). */
export function mismoDestino(a: Destino | null, b: Destino): boolean {
  return a !== null && a.conexion === b.conexion && describirDestino(a) === describirDestino(b);
}
