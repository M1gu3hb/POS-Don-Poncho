import { minutosTranscurridos, textoDeEspera } from '../cocina/espera';

/**
 * DP-D177 · CUÁNTO LLEVA ABIERTA UNA MESA.
 *
 * El plano del mesero decía el estado de cada mesa y no cuánto tiempo llevaba así de ocupada. La
 * hora es la de la cuenta (`abierta_desde`, que el puente deriva de `ordenes.created_at` de la
 * cuenta activa de la mesa) y el «ahora» es el reloj de la pantalla (`useAhora`, el mismo de la
 * cocina). Aquí vive sólo la cuenta, sin pantalla, para probarla sin navegador.
 */

export interface MesaConCuenta {
  readonly estado?: string | null | undefined;
  readonly venta_activa_id?: string | null | undefined;
  readonly abierta_desde?: string | null | undefined;
}

/** Sin cuenta que medir: una mesa en estos estados no lleva tiempo, aunque conserve una fecha vieja. */
const SIN_CUENTA: readonly string[] = ['libre', 'limpieza', 'pagada', 'cancelada'];

export interface TiempoDeLaMesa {
  readonly minutos: number;
  /** Lo que se pinta: «< 1 min», «35 min», «1 h 5 min». */
  readonly texto: string;
  /** Lo que se lee en voz alta: «Abierta hace 35 min». */
  readonly etiqueta: string;
}

/** Los minutos de la mesa, o `null` si no hay cuenta, fecha legible o reloj todavía. */
export function tiempoDeLaMesa(mesa: MesaConCuenta, ahora: number): TiempoDeLaMesa | null {
  if (ahora === 0) return null;
  if (mesa.estado === null || mesa.estado === undefined || SIN_CUENTA.includes(mesa.estado)) {
    return null;
  }
  if (mesa.venta_activa_id === null || mesa.venta_activa_id === undefined) return null;
  const minutos = minutosTranscurridos(mesa.abierta_desde, ahora);
  if (minutos === null) return null;
  if (minutos < 1) return { minutos, texto: '< 1 min', etiqueta: 'Abierta hace menos de 1 min' };
  const texto = textoDeEspera(minutos);
  return { minutos, texto, etiqueta: `Abierta hace ${texto}` };
}
