'use client';

import type { ForwardRefExoticComponent, ReactElement, Ref, RefAttributes } from 'react';

import MeseroCartFABSinTipos from '../../heredado/components/mesero/MeseroCartFAB.jsx';
import { formatCurrency } from '../../heredado/utils/financialUtils.js';

import type { AlmacenDelBorrador } from './almacen-del-borrador';
import { totalDelCarritoEnCentavos } from './borrador-de-la-mesa';
import { useBorrador } from './use-borrador-de-la-mesa';

/** Lo que el carrito de siempre (JavaScript, sin tipos) recibe: el borrador ya repartido en piezas. */
interface PropiedadesDelCarrito {
  readonly carrito: readonly unknown[];
  readonly totalCarrito: number;
  readonly totalActual: number;
  readonly detallesVenta: readonly unknown[];
  readonly notaMesa: string;
  readonly setNotaMesa: (nota: string) => void;
  readonly cambiarCantidad: (id: string, delta: number) => void;
  readonly enviarPedido: () => void;
  readonly pedirCuenta: () => void;
  readonly loading: boolean;
  readonly estadoMesa: string | null | undefined;
  readonly ventaActiva: unknown;
  readonly formatCurrency: (importe: number) => string;
  readonly config: unknown;
  readonly onUpdateNotas: (id: string, notas: string | null) => void;
  readonly onUpdateExclusiones: (id: string, exclusiones: readonly string[]) => void;
}
const MeseroCartFAB = MeseroCartFABSinTipos as unknown as ForwardRefExoticComponent<
  PropiedadesDelCarrito & RefAttributes<unknown>
>;

export interface CarritoFlotanteProps {
  readonly borrador: AlmacenDelBorrador;
  /** Lo que la mesa ya mandó a cocina, en pesos del puente. */
  readonly detallesVenta: readonly unknown[];
  readonly totalActual: number;
  readonly estadoMesa: string | null | undefined;
  readonly ventaActiva: unknown;
  readonly loading: boolean;
  readonly config: unknown;
  readonly cambiarCantidad: (id: string, delta: number) => void;
  readonly enviarPedido: () => void;
  readonly pedirCuenta: () => void;
  /** `close()` e `isOpen()` del carrito: `cerrarDialog` lo cierra antes de desmontar el diálogo. */
  readonly refDelCarrito: Ref<unknown>;
}

/**
 * EL CARRITO FLOTANTE DEL TELÉFONO (la barra de abajo y su hoja), alimentado por el borrador.
 *
 * El carrito de siempre (`MeseroCartFAB`) recibía el borrador por propiedades de `Mesero`, así que
 * `Mesero` tenía que redibujarse en cada toque a un platillo para que el carrito se enterara. Este
 * adaptador se suscribe al borrador él mismo: se redibuja el carrito, y nadie más.
 */
export function CarritoFlotante({
  borrador,
  detallesVenta,
  totalActual,
  estadoMesa,
  ventaActiva,
  loading,
  config,
  cambiarCantidad,
  enviarPedido,
  pedirCuenta,
  refDelCarrito,
}: CarritoFlotanteProps): ReactElement {
  const carrito = useBorrador(borrador, (e) => e.carrito);
  const nota = useBorrador(borrador, (e) => e.nota);
  return (
    <MeseroCartFAB
      ref={refDelCarrito}
      carrito={carrito}
      totalCarrito={totalDelCarritoEnCentavos(carrito) / 100}
      totalActual={totalActual}
      detallesVenta={detallesVenta}
      notaMesa={nota}
      setNotaMesa={borrador.ponerNota}
      cambiarCantidad={cambiarCantidad}
      enviarPedido={enviarPedido}
      pedirCuenta={pedirCuenta}
      loading={loading}
      estadoMesa={estadoMesa}
      ventaActiva={ventaActiva}
      formatCurrency={formatCurrency}
      config={config}
      onUpdateNotas={borrador.ponerNotasDeLinea}
      onUpdateExclusiones={borrador.ponerExclusionesDeLinea}
    />
  );
}
