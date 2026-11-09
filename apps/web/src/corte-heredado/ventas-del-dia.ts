import { invocarComando } from '~/cliente/api';

/**
 * LAS VENTAS DEL DÍA EN EL CORTE HEREDADO (DP-15, QA de la jornada J-H6).
 *
 * Con dos cajas, el Cierre del día es el corte de la última caja y su resumen es SÓLO el de esa
 * caja (DP-D50): la dueña que lo leía creía que el día vendió la mitad. El corte que cierra el día
 * trae además, del servidor (`caja.ventas_del_dia`), las ventas de todas las cajas de su ventana.
 * `null` si el corte no cierra el día, o si no se pudieron leer (entonces el PDF sale como antes,
 * con su resumen de caja, y el fallo se registra).
 */

export interface VentasDelDiaLeidas {
  readonly cajas: number;
  readonly tickets: number;
  readonly totalCentavos: string;
  readonly propinasCentavos: string;
  readonly metodos: readonly { readonly metodo: string; readonly ventasCentavos: string }[];
}

export const TITULO_DEL_DIA = 'Ventas del día · todas las cajas';

function registrarElFallo(error: unknown): void {
  console.error('No se pudieron leer las ventas del día del corte.', error);
}

export async function leerVentasDelDia(
  sesionCajaId: string | null | undefined,
  leer: (id: string) => Promise<VentasDelDiaLeidas | null> = (id) =>
    invocarComando<VentasDelDiaLeidas | null>('/api/caja/ventas-del-dia', { sesionCajaId: id }),
  registrar: (error: unknown) => void = registrarElFallo,
): Promise<VentasDelDiaLeidas | null> {
  if (sesionCajaId === null || sesionCajaId === undefined || sesionCajaId === '') return null;
  try {
    return await leer(sesionCajaId);
  } catch (error: unknown) {
    registrar(error);
    return null;
  }
}

const NOMBRES: Readonly<Record<string, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export interface CeldaDelDia {
  readonly etiqueta: string;
  /** En pesos (el corte heredado formatea pesos), o texto para los conteos. */
  readonly pesos?: number;
  readonly texto?: string;
  readonly fuerte?: boolean;
}

/** Lo que el papel enseña del día, en el orden del resumen de caja. */
export function celdasDelDia(v: VentasDelDiaLeidas): readonly CeldaDelDia[] {
  const pesos = (centavos: string): number => Number(centavos) / 100;
  return [
    { etiqueta: 'Total ventas', pesos: pesos(v.totalCentavos), fuerte: true },
    { etiqueta: 'N° tickets', texto: String(v.tickets) },
    { etiqueta: 'Cajas', texto: String(v.cajas) },
    ...v.metodos.map((m) => ({
      etiqueta: NOMBRES[m.metodo] ?? m.metodo,
      pesos: pesos(m.ventasCentavos),
    })),
    { etiqueta: 'Propinas', pesos: pesos(v.propinasCentavos) },
  ];
}
