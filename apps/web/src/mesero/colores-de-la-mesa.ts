import { MESA_STATUS_CONFIG } from '../../heredado/lib/constants.js';
import { MESA_STATUS_DARK } from '../../heredado/lib/darkPalettes.js';

/**
 * LOS COLORES DE UNA MESA SEGÚN SU ESTADO.
 *
 * Los colores de los estados son DATOS del negocio —los dan `MESA_STATUS_CONFIG` y, en oscuro,
 * `MESA_STATUS_DARK`, y los comparten el editor de Configuración y la prueba de contraste—, no
 * decisiones de esta pantalla. Aquí sólo se eligen y se les da el fondo de la etiqueta, que es
 * lo que decide si el estado SE LEE: sin degradado ni pastilla translúcida, para que la razón
 * de contraste sea una cuenta y no una captura (ver `colores-de-la-mesa.test.ts`).
 */

interface ColoresDelEstado {
  readonly label: string;
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
}
interface ColoresEnOscuro {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
  readonly glow: string;
}

const CLARO = MESA_STATUS_CONFIG as unknown as Readonly<Record<string, ColoresDelEstado>>;
const OSCURO = MESA_STATUS_DARK as unknown as Readonly<Record<string, ColoresEnOscuro>>;

export interface PaletaDeLaMesa {
  /** La palabra del estado, siempre la de la paleta clara. */
  readonly etiqueta: string;
  readonly relleno: string;
  readonly borde: string;
  /** El color del número y de lo que va escrito sobre la mesa. */
  readonly texto: string;
  /** Sobre qué color va la etiqueta del estado. */
  readonly fondoDeLaEtiqueta: string;
  /** El halo del estado (sólo en oscuro): asegura que se distinga sobre el suelo oscuro. */
  readonly brillo: string | null;
}

/** La paleta de un estado; «libre» si falta, y un error claro si ni «libre» está declarada. */
function delEstado<T>(paleta: Readonly<Record<string, T>>, clave: string): T {
  const colores = paleta[clave] ?? paleta['libre'];
  if (colores === undefined)
    throw new Error('La paleta de los estados de mesa no declara «libre».');
  return colores;
}

/** Blanco como número (los colores de los estados vienen como «#RRGGBB»). */
const BLANCO = 0xffffff;
const esBlanco = (color: string): boolean => Number.parseInt(color.replace('#', ''), 16) === BLANCO;

/**
 * Los colores de una mesa. Un estado desconocido se pinta como «libre», igual que antes.
 *
 * En claro, con texto blanco la etiqueta va sobre el tono oscuro de la misma familia (el borde):
 * sobre el relleno vivo, el blanco de 8-9 px bajaba a 3.3:1 (cierre del 21-10) y así queda arriba
 * de 5.4:1. Con texto oscuro va sobre el relleno. En oscuro todo va sobre el relleno profundo.
 */
export function paletaDeLaMesa(estado: string | undefined, oscuro: boolean): PaletaDeLaMesa {
  const clave = estado !== undefined && Object.hasOwn(CLARO, estado) ? estado : 'libre';
  const claro = delEstado(CLARO, clave);
  if (oscuro) {
    const noche = delEstado(OSCURO, clave);
    return {
      etiqueta: claro.label,
      relleno: noche.fill,
      borde: noche.stroke,
      texto: noche.text,
      fondoDeLaEtiqueta: noche.fill,
      brillo: noche.glow,
    };
  }
  return {
    etiqueta: claro.label,
    relleno: claro.fill,
    borde: claro.stroke,
    texto: claro.text,
    fondoDeLaEtiqueta: esBlanco(claro.text) ? claro.stroke : claro.fill,
    brillo: null,
  };
}

export interface EstadoDeLaLeyenda {
  readonly clave: string;
  readonly etiqueta: string;
  readonly relleno: string;
  readonly borde: string;
}

/** `pagada` y `cancelada` existen en la paleta pero ningún comando las deja en la mesa. */
const SIN_LEYENDA = new Set(['pagada', 'cancelada']);

export const ESTADOS_DE_LA_LEYENDA: readonly EstadoDeLaLeyenda[] = Object.entries(CLARO)
  .filter(([clave]) => !SIN_LEYENDA.has(clave))
  .map(([clave, c]) => ({ clave, etiqueta: c.label, relleno: c.fill, borde: c.stroke }));
