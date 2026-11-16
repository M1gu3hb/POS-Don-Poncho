'use client';

import { SI_NO_SALIO_DE_LA_CAJA, fraseDeDondeSale } from '@morphiqpos/domain/gastos';
import { Aviso } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import type { LecturaDelCajon } from './cajon-para-pagar.ts';

/**
 * LO QUE SE VE AL PAGAR UN GASTO O UNA COMPRA (DP-21 · Bloque 11 · A11 y H4).
 *
 *   · en EFECTIVO: de qué caja sale («Sale del cajón de Caja principal»; la de este aparato o, si no
 *     tiene, la otra abierta) y, a la mano, qué hacer si no salió de ahí; sin caja abierta, lo dice
 *     (el servidor tampoco lo registraría);
 *   · con otro método: que no sale del cajón;
 *   · el aviso de «la caja sólo tiene $X», si el pago la dejaría en negativo y aún no se confirmó.
 *
 * La usan la Caja, el gasto y la compra de Compras y gastos: una sola forma de decirlo.
 */
export function PagoDeLaCaja({
  metodo,
  lectura,
  aviso,
}: {
  readonly metodo: string;
  readonly lectura: LecturaDelCajon;
  /** El aviso de efectivo negativo que espera confirmación, o `null`. */
  readonly aviso: string | null;
}): ReactElement {
  return (
    <div data-pago-de-la-caja className="flex flex-col gap-(--espacio-2)">
      {metodo === 'efectivo' ? <DeDondeSale lectura={lectura} /> : <NoSaleDelCajon />}
      {aviso === null ? null : <Aviso tono="atencion" titulo={aviso} />}
    </div>
  );
}

function NoSaleDelCajon(): ReactElement {
  return (
    <p className="text-sm text-texto-sutil">No sale del cajón: no mueve el efectivo del corte.</p>
  );
}

function DeDondeSale({ lectura }: { readonly lectura: LecturaDelCajon }): ReactElement | null {
  if (lectura.estado !== 'listo') return null;
  const { caso, caja } = lectura.cajon;
  const dice =
    caso === 'una' && caja !== null
      ? fraseDeDondeSale(caja.nombre, caja.esDeEsteAparato)
      : caso === 'ninguna'
        ? 'No hay una caja abierta: el efectivo no se puede registrar.'
        : 'Hay varias cajas abiertas: registra desde la terminal de la caja de la que salió.';
  return (
    <div data-de-donde-sale className="flex flex-col gap-(--espacio-1) text-sm">
      <p className="font-medium">{dice}</p>
      <p className="text-texto-sutil">{SI_NO_SALIO_DE_LA_CAJA}</p>
    </div>
  );
}
