/**
 * DP-25 · Parte 8 · DP-D227 · DÓNDE SE VE CADA PLATILLO.
 *
 * Un platillo puede verse en el portal QR (`visible_en_menu_digital`) y en el POS —el mesero y la
 * Caja— (`visible_en_pos`), cada uno por separado. Aquí está lo que la pantalla de «El orden del
 * menú» dice y ofrece, sin tocar la red: el texto de dónde se ve y las acciones posibles, con el
 * cambio que cada una le manda al comando `catalogo.mostrar_en_menu`.
 */

export interface Visibilidad {
  readonly portal: boolean;
  readonly pos: boolean;
}

export type AccionDeVisibilidad =
  | 'ocultar-portal'
  | 'mostrar-portal'
  | 'ocultar-pos'
  | 'mostrar-pos'
  | 'ocultar-todo'
  | 'mostrar-todo';

/** Lo que el comando recibe: sólo el lugar que cambia (`visible` es el portal). */
export interface CambioDeVisibilidad {
  readonly visible?: boolean;
  readonly visibleEnPos?: boolean;
}

export interface OpcionDeVisibilidad {
  readonly accion: AccionDeVisibilidad;
  readonly texto: string;
}

/** Lo que no dice nada se ve: es el valor de fábrica de las dos columnas. */
export function visibilidadDe(platillo: {
  readonly visible_en_menu_digital?: boolean | null;
  readonly visible_en_pos?: boolean | null;
}): Visibilidad {
  return {
    portal: platillo.visible_en_menu_digital !== false,
    pos: platillo.visible_en_pos !== false,
  };
}

export function textoDeDondeSeVe({ portal, pos }: Visibilidad): string {
  if (portal && pos) return 'Se ve en: POS y portal QR';
  if (pos) return 'Se ve en: POS';
  if (portal) return 'Se ve en: portal QR';
  return 'Oculto en todo';
}

const CAMBIOS: Readonly<Record<AccionDeVisibilidad, CambioDeVisibilidad>> = {
  'ocultar-portal': { visible: false },
  'mostrar-portal': { visible: true },
  'ocultar-pos': { visibleEnPos: false },
  'mostrar-pos': { visibleEnPos: true },
  'ocultar-todo': { visible: false, visibleEnPos: false },
  'mostrar-todo': { visible: true, visibleEnPos: true },
};

export const cambioDe = (accion: AccionDeVisibilidad): CambioDeVisibilidad => CAMBIOS[accion];

/** Lo que se puede hacer desde el estado de hoy, en el orden en que se muestra. */
export function accionesDe({ portal, pos }: Visibilidad): readonly OpcionDeVisibilidad[] {
  return [
    portal
      ? { accion: 'ocultar-portal', texto: 'Ocultar del portal QR' }
      : { accion: 'mostrar-portal', texto: 'Mostrar en el portal QR' },
    pos
      ? { accion: 'ocultar-pos', texto: 'Ocultar del POS (mesero y Caja)' }
      : { accion: 'mostrar-pos', texto: 'Mostrar en el POS (mesero y Caja)' },
    portal || pos
      ? { accion: 'ocultar-todo', texto: 'Ocultar de todo' }
      : { accion: 'mostrar-todo', texto: 'Mostrar en todo' },
  ];
}

/** El aviso al guardar: qué quedó y dónde. */
export const avisoDeVisibilidad = (nombre: string, ahora: Visibilidad): string =>
  `«${nombre}» · ${textoDeDondeSeVe(ahora)}`;
