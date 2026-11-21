'use client';

/**
 * PANTALLA · componente · venta · cada pago por separado
 *
 * DP-25 · Una venta cobrada con varias tarjetas y efectivo se leía como «Mixto» con un total por
 * método. Aquí se lee cada pago: «Tarjeta 1», «Tarjeta 2», «Efectivo» (con lo recibido y el
 * cambio) y la propina de cada uno. Va en el detalle de la venta (Registros y Ventas) y en el corte.
 * Recibe las filas de `PagoDeVenta` tal como las da el puente (en pesos) y no recalcula dinero: sólo
 * lo ordena y lo nombra (`pagos-por-separado.ts`).
 */

import { Dinero, Tabla, type ColumnaDeTabla } from '@morphiqpos/ui/sistema';

import { renglonesDePagos, type PagoLeido, type RenglonDePago } from './pagos-por-separado';

/** El puente da pesos; `<Dinero>` pide centavos enteros. */
const enCentavos = (pesos: number): number => Math.round(pesos * 100);

const SIN_DATO = '—';

const COLUMNAS: readonly ColumnaDeTabla<RenglonDePago>[] = [
  {
    clave: 'pago',
    titulo: 'Pago',
    celda: (r) => (r.devuelto ? `${r.rotulo} · devuelto` : r.rotulo),
  },
  {
    clave: 'monto',
    titulo: 'Monto',
    numerica: true,
    celda: (r) => <Dinero centavos={enCentavos(r.monto)} />,
  },
  {
    clave: 'propina',
    titulo: 'Propina',
    numerica: true,
    celda: (r) => <Dinero centavos={enCentavos(r.propina)} />,
  },
  {
    clave: 'recibido',
    titulo: 'Recibido',
    numerica: true,
    celda: (r) => (r.recibido === null ? SIN_DATO : <Dinero centavos={enCentavos(r.recibido)} />),
  },
  {
    clave: 'cambio',
    titulo: 'Cambio',
    numerica: true,
    celda: (r) => (r.recibido === null ? SIN_DATO : <Dinero centavos={enCentavos(r.cambio)} />),
  },
];

export interface PagosDeLaVentaProps {
  readonly pagos: readonly PagoLeido[];
  readonly titulo?: string;
}

export function PagosDeLaVenta({ pagos, titulo = 'Pagos, uno por uno' }: PagosDeLaVentaProps) {
  const renglones = renglonesDePagos(pagos);
  if (renglones.length === 0) return null;
  return (
    <section aria-label={titulo} data-pagos-de-la-venta className="space-y-(--espacio-1)">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{titulo}</h3>
      <Tabla columnas={COLUMNAS} filas={renglones} claveDe={(r) => r.id} />
    </section>
  );
}

export default PagosDeLaVenta;
