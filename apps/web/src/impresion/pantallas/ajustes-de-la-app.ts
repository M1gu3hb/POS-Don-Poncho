/**
 * LOS AJUSTES DE ESTE APARATO, EN SU LENGUAJE (DP-20 · Impresión). Puro.
 *
 * El modo ligero se guarda como `null` (automático), `true` o `false`; la actualización llega
 * como un estado de la app. Aquí se vuelven opciones y frases.
 */
import type { Actualizacion, ModoLigero } from '../puente/contrato.ts';

export type OpcionDelModoLigero = 'automatico' | 'encendido' | 'apagado';

export const OPCIONES_DEL_MODO_LIGERO: readonly {
  readonly valor: OpcionDelModoLigero;
  readonly nombre: string;
}[] = [
  { valor: 'automatico', nombre: 'Automático' },
  { valor: 'encendido', nombre: 'Encendido' },
  { valor: 'apagado', nombre: 'Apagado' },
];

export function opcionDelModoLigero(guardado: boolean | null | undefined): OpcionDelModoLigero {
  if (guardado === true) return 'encendido';
  if (guardado === false) return 'apagado';
  return 'automatico';
}

export function valorDelModoLigero(opcion: OpcionDelModoLigero): boolean | null {
  return opcion === 'automatico' ? null : opcion === 'encendido';
}

/** «Ahora está encendido (automático): este aparato tiene poca memoria». */
export function fraseDelModoLigero(modo: ModoLigero): string {
  const como = modo.origen === 'auto' ? 'automático' : 'a mano';
  const motivo = modo.motivo.trim();
  const estado = modo.activo ? 'encendido' : 'apagado';
  return `Ahora está ${estado} (${como})${motivo === '' ? '.' : `: ${motivo}`}`;
}

export interface TextoDeActualizacion {
  readonly titulo: string;
  readonly detalle: string | null;
  /** `true` si se puede instalar. */
  readonly instalable: boolean;
  /** De 0 a 100 mientras descarga. */
  readonly avance: number | null;
  readonly fallo: boolean;
}

const SIN_DETALLE = { detalle: null, avance: null, fallo: false } as const;

export function textoDeLaActualizacion(a: Actualizacion): TextoDeActualizacion {
  const mensaje = a.mensaje?.trim() ?? '';
  const nueva = a.versionNueva ?? 'nueva';
  switch (a.estado) {
    case 'al-dia':
      return { ...SIN_DETALLE, titulo: 'Tienes la última versión', instalable: false };
    case 'disponible':
      return { ...SIN_DETALLE, titulo: `Hay una versión nueva: ${nueva}`, instalable: true };
    case 'descargando':
      return {
        ...SIN_DETALLE,
        titulo: `Descargando la versión ${nueva}…`,
        instalable: false,
        avance:
          a.avance === undefined ? null : Math.round(Math.max(0, Math.min(1, a.avance)) * 100),
      };
    case 'lista':
      return {
        ...SIN_DETALLE,
        titulo: `La versión ${nueva} está lista para instalar`,
        instalable: true,
      };
    case 'error':
      return {
        ...SIN_DETALLE,
        titulo: 'No se pudo buscar la actualización',
        detalle: mensaje === '' ? 'Revisa la conexión a internet y reintenta.' : mensaje,
        instalable: false,
        fallo: true,
      };
  }
}

const ESTADOS: readonly string[] = ['al-dia', 'disponible', 'descargando', 'lista', 'error'];

/** El evento `actualizacion` trae un `unknown`: sólo se acepta lo que tiene la forma. */
export function comoActualizacion(datos: unknown): Actualizacion | null {
  if (typeof datos !== 'object' || datos === null) return null;
  const { estado, versionActual } = datos as { estado?: unknown; versionActual?: unknown };
  if (typeof estado !== 'string' || !ESTADOS.includes(estado)) return null;
  if (typeof versionActual !== 'string') return null;
  return datos as Actualizacion;
}
