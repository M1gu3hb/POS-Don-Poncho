/**
 * EL PERFIL DE IMPRESIÓN DE UN APARATO (DP-20 · refuerzo §2). Puro.
 *
 * Lo que funcionó en el laboratorio —conexión, impresora, lenguaje, ancho en puntos, dpi, corte,
 * cajón, bloques— queda como el perfil de ESE punto de venta. Se guarda en el aparato (por el
 * puente de la app), no en el servidor: cada POS tiene su impresora. Se exporta e importa como
 * JSON para dejar listo en un minuto otro POS idéntico.
 */
import { z } from 'zod';

import {
  CORTES,
  FRANJA_MAXIMA,
  FRANJA_POR_OMISION,
  PULSO_APAGADO_MS,
  PULSO_ENCENDIDO_MS,
} from './escpos.ts';
import { UMBRAL_POR_OMISION } from './monocromo.ts';

export const CONEXIONES = ['spooler', 'driver', 'red', 'usb', 'bluetooth', 'serial'] as const;
export type Conexion = (typeof CONEXIONES)[number];

/** Cómo se le habla a la impresora. La imagen es lo de siempre; el texto, el plan B. */
export const LENGUAJES = ['escpos-imagen', 'escpos-columnas', 'escpos-texto', 'driver'] as const;
export type Lenguaje = (typeof LENGUAJES)[number];

export const PAGINAS_DE_CODIGOS = ['cp437', 'cp850', 'cp858', 'windows1252', 'iso88591'] as const;
export type PaginaDeCodigos = (typeof PAGINAS_DE_CODIGOS)[number];

export const esquemaDelDestino = z.object({
  conexion: z.enum(CONEXIONES),
  nombre: z.string().min(1).max(200).optional(),
  host: z.string().min(1).max(200).optional(),
  puerto: z.number().int().min(1).max(65_535).optional(),
  vendorId: z.number().int().min(0).max(65_535).optional(),
  productId: z.number().int().min(0).max(65_535).optional(),
  direccion: z
    .string()
    .regex(/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/)
    .optional(),
  puertoSerie: z
    .string()
    .regex(/^COM\d{1,3}$/)
    .optional(),
  baudios: z.number().int().min(1200).max(921_600).optional(),
});
export type Destino = z.infer<typeof esquemaDelDestino>;

const esquemaDelCajon = z.object({
  pin: z.union([z.literal(2), z.literal(5)]),
  modo: z.enum(['esc-p', 'tiempo-real']),
  encendidoMs: z.number().int().min(2).max(510),
  apagadoMs: z.number().int().min(2).max(510),
  /** «Abrir el cajón al cobrar en efectivo». */
  alCobrarEnEfectivo: z.boolean(),
});
export type CajonDelPerfil = z.infer<typeof esquemaDelCajon>;

export const esquemaDelPerfil = z.object({
  version: z.literal(1),
  nombre: z.string().trim().min(1).max(60),
  destino: esquemaDelDestino,
  lenguaje: z.enum(LENGUAJES),
  papelMm: z.union([z.literal(58), z.literal(80)]),
  /** El ancho imprimible en puntos: 384 en 58 mm; 576 o 512 en 80 mm. Lo dice la regla de calibración. */
  puntos: z.number().int().min(200).max(1200),
  dpi: z.union([z.literal(203), z.literal(180)]),
  umbral: z.number().int().min(1).max(254),
  franjaFilas: z.number().int().min(1).max(FRANJA_MAXIMA),
  bloqueBytes: z.number().int().min(64).max(65_536),
  pausaMs: z.number().int().min(0).max(2_000),
  lineasAntesDelCorte: z.number().int().min(0).max(20),
  corte: z.enum(CORTES),
  paginaDeCodigos: z.enum(PAGINAS_DE_CODIGOS),
  cajon: esquemaDelCajon.nullable(),
  /** Qué imprime este aparato. `estacion`: el nombre de la estación cuyas comandas salen aquí. */
  imprime: z.object({
    ticket: z.boolean(),
    precuenta: z.boolean(),
    corte: z.boolean(),
    cierre: z.boolean(),
    estacion: z.string().trim().min(1).max(60).nullable(),
  }),
});
export type PerfilDeImpresion = z.infer<typeof esquemaDelPerfil>;

export const PUNTOS_POR_PAPEL: Readonly<Record<58 | 80, readonly number[]>> = {
  58: [384],
  80: [576, 512],
};

/** El perfil con que arranca el laboratorio: lo más común en una térmica de ese rollo. */
export function perfilPorOmision(papelMm: 58 | 80, destino: Destino): PerfilDeImpresion {
  return {
    version: 1,
    nombre: destino.nombre ?? `Impresora de ${String(papelMm)} mm`,
    destino,
    lenguaje: destino.conexion === 'driver' ? 'driver' : 'escpos-imagen',
    papelMm,
    puntos: PUNTOS_POR_PAPEL[papelMm][0] ?? 576,
    dpi: 203,
    umbral: UMBRAL_POR_OMISION,
    franjaFilas: FRANJA_POR_OMISION,
    bloqueBytes: 4096,
    pausaMs: 0,
    lineasAntesDelCorte: 4,
    corte: 'parcial-con-avance',
    paginaDeCodigos: 'cp858',
    cajon: null,
    imprime: { ticket: true, precuenta: true, corte: true, cierre: true, estacion: null },
  };
}

export function cajonPorOmision(): CajonDelPerfil {
  return {
    pin: 2,
    modo: 'esc-p',
    encendidoMs: PULSO_ENCENDIDO_MS,
    apagadoMs: PULSO_APAGADO_MS,
    alCobrarEnEfectivo: true,
  };
}

/** Lee lo guardado en el aparato. `null` si no hay perfil o si lo guardado ya no es válido. */
export function leerPerfil(guardado: unknown): PerfilDeImpresion | null {
  const leido = esquemaDelPerfil.safeParse(guardado);
  return leido.success ? leido.data : null;
}

const SOBRE = 'morphiq-perfil-de-impresion';

/** El archivo que se lleva a otro POS. */
export function exportarPerfil(perfil: PerfilDeImpresion): string {
  return `${JSON.stringify({ tipo: SOBRE, perfil }, null, 2)}\n`;
}

export type PerfilImportado =
  | { readonly ok: true; readonly perfil: PerfilDeImpresion }
  | { readonly ok: false; readonly motivo: string };

export function importarPerfil(texto: string): PerfilImportado {
  let leido: unknown;
  try {
    leido = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'Ese archivo no es un perfil de impresión (no es JSON).' };
  }
  if (typeof leido !== 'object' || leido === null || (leido as { tipo?: unknown }).tipo !== SOBRE) {
    return { ok: false, motivo: 'Ese archivo no es un perfil de impresión.' };
  }
  const perfil = esquemaDelPerfil.safeParse((leido as { perfil?: unknown }).perfil);
  if (!perfil.success) {
    const primero = perfil.error.issues[0];
    const donde = primero === undefined ? '' : ` (${primero.path.join('.')})`;
    return { ok: false, motivo: `El perfil trae un dato que no se entiende${donde}.` };
  }
  return { ok: true, perfil: perfil.data };
}

/** La impresora, dicha para una persona: «EPSON TM-T20 · por red 192.168.1.50». */
export function describirDestino(destino: Destino): string {
  switch (destino.conexion) {
    case 'spooler':
      return `${destino.nombre ?? 'Impresora'} · directo (RAW)`;
    case 'driver':
      return `${destino.nombre ?? 'Impresora'} · driver de Windows`;
    case 'red':
      return `Red ${destino.host ?? '—'}:${String(destino.puerto ?? 9100)}`;
    case 'usb':
      return `USB ${String(destino.vendorId ?? 0)}:${String(destino.productId ?? 0)}`;
    case 'bluetooth':
      return `Bluetooth ${destino.direccion ?? '—'}`;
    case 'serial':
      return `Serie ${destino.puertoSerie ?? '—'} a ${String(destino.baudios ?? 9600)}`;
  }
}
