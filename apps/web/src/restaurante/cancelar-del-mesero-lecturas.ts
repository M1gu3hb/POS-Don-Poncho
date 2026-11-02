import { consultarPuente } from '~/cliente/api';

import type { DetalleDeLaCuenta } from './cancelar-del-mesero.ts';
import { lineasQueSigueCobrando, soloLasVivas } from './lineas-vivas.ts';
import { nombresQueYaSalieron, type ItemDeComandaLeido } from './listos-de-la-mesa.ts';

/**
 * LAS DOS LECTURAS de «Cancelar» en la pantalla del mesero (DP-12.4).
 *
 * Cada `consultarPuente<Tipo>` declara su tipo AQUÍ, en este mismo archivo: el contrato de lecturas
 * del puente lo lee de aquí para comprobar que cada campo obligatorio lo sirve el puente.
 */

interface VentaLeida {
  readonly id: string;
  readonly total: number;
}

interface RenglonLeido {
  readonly id: string;
  readonly producto_nombre: string;
  /** El puente sirve la cantidad ya convertida a número (`conversion: decimal`). */
  readonly cantidad: number;
}

interface ComandaDeLaCuenta {
  readonly id: string;
  readonly estado: string;
  readonly items: readonly ItemDeComandaLeido[];
}

/** La cuenta como la deja una cancelación: la venta al día y SÓLO los renglones que se cobran. */
export interface CuentaViva {
  readonly venta: VentaLeida;
  readonly detalles: readonly DetalleDeLaCuenta[];
}

/**
 * Relee la cuenta después de quitar un platillo. El puente sirve también los renglones anulados
 * (no expone `anulada_en`), y se descartan con la lectura del servidor de cuáles siguen en la
 * cuenta (`lineas-vivas.ts`): si no contesta bien NO se adivina, se lanza.
 */
export async function releerLaCuenta(ordenId: string): Promise<CuentaViva> {
  const [ventas, renglones, vivas] = await Promise.all([
    consultarPuente<VentaLeida>('Venta', { filtro: { id: ordenId }, limite: 1 }),
    consultarPuente<RenglonLeido>('DetalleVenta', { filtro: { venta_id: ordenId }, limite: 300 }),
    lineasQueSigueCobrando(ordenId),
  ]);
  const venta = ventas[0];
  if (venta === undefined) throw new Error('No se pudo releer la cuenta de la mesa.');
  return { venta, detalles: soloLasVivas(renglones, vivas) };
}

/** Los nombres de lo que cocina ya dejó listo o entregado en esta cuenta. */
export async function loQueYaSalio(ordenId: string): Promise<ReadonlySet<string>> {
  const comandas = await consultarPuente<ComandaDeLaCuenta>('PedidoPreparacion', {
    filtro: { venta_id: ordenId },
    limite: 20,
  });
  return nombresQueYaSalieron(comandas);
}
