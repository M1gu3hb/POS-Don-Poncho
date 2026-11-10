import type { HojaDelServidor, Seccion } from './hoja.ts';
import { tablaDeOpciones } from './opciones-vendidas.ts';
import { tablaDeRetirosConPin } from './retiros-con-pin.ts';

/**
 * DP-17 (QA de DP-16, H5) · LO DEL DÍA QUE EL CIERRE NO DECÍA.
 *
 * Bajo «Ventas del día · todas las cajas», las opciones vendidas y los retiros con PIN de TODAS las
 * cajas del día (el servidor los suma en `ventasDelDia`). Las de la caja que cierra siguen en sus
 * secciones de siempre. El documento al cerrar y el visor de Registros usan este mismo armado.
 */
export function seccionesExtraDelDia(
  dia: Pick<NonNullable<HojaDelServidor['ventasDelDia']>, 'opciones' | 'retirosConPin'> | null,
): readonly Seccion[] {
  if (dia === null) return [];
  return [
    ...tablaDeOpciones(dia.opciones ?? [], 'Opciones vendidas del día · todas las cajas'),
    ...tablaDeRetirosConPin(
      dia.retirosConPin ?? [],
      'Retiros con PIN de gerente del día · todas las cajas',
    ),
  ];
}
