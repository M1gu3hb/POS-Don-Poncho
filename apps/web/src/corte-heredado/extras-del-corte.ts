import { invocarComando } from '~/cliente/api';

import type { HojaDelServidor, Seccion } from '../corte/hoja.ts';
import { opcionesVendidas } from '../corte/opciones-vendidas.ts';
import { retirosConPin } from '../corte/retiros-con-pin.ts';

/**
 * DP-16 (QA-J, H3) · LO QUE EL VISOR DE REGISTROS NO ARMABA.
 *
 * El documento que sale al cerrar trae «Opciones vendidas · cuánto sumaron» (DP-D104) y «Retiros
 * con PIN de gerente · quién autorizó» (DP-D101); el visor de Registros → Cortes arma su corte
 * aparte y no las tenía. Se leen de la misma hoja del servidor y se pintan con los mismos
 * ayudantes: el papel dice lo mismo desde los dos lados. Como los descuentos, si sólo esto falla
 * el corte sale igual y su aviso lo dice.
 */

export interface ExtrasDelCorte {
  readonly secciones: readonly Seccion[];
  readonly noSePudieronLeer: boolean;
}

export const AVISO_SIN_EXTRAS = 'No se pudieron leer las opciones vendidas ni los retiros con PIN';

export function seccionesDeLaHoja(hoja: HojaDelServidor): readonly Seccion[] {
  return [...opcionesVendidas(hoja), ...retirosConPin(hoja)];
}

function registrarElFallo(error: unknown): void {
  console.error(`${AVISO_SIN_EXTRAS} del corte.`, error);
}

export async function leerExtrasDelCorte(
  sesionCajaId: string,
  leer: (id: string) => Promise<HojaDelServidor> = (id) =>
    invocarComando<HojaDelServidor>('/api/caja/hoja-del-corte', { sesionCajaId: id }),
  registrar: (error: unknown) => void = registrarElFallo,
): Promise<ExtrasDelCorte> {
  try {
    return { secciones: seccionesDeLaHoja(await leer(sesionCajaId)), noSePudieronLeer: false };
  } catch (error: unknown) {
    registrar(error);
    return { secciones: [], noSePudieronLeer: true };
  }
}
