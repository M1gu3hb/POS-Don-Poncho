'use client';

import type { PapelATuGusto, PapelDeVenta } from '@morphiqpos/domain/venta';
import { Superficie } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import PreCuentaTicket from '@/components/tickets/PreCuentaTicket';

import {
  CODIGO_DE_EJEMPLO,
  detallesDeEjemplo,
  MESA_DE_EJEMPLO,
  RENGLONES_DEL_TICKET_CORTO,
  ventaDeEjemplo,
} from '~/impresion/pantallas/datos-de-ejemplo';

/**
 * LA VISTA PREVIA DEL PAPEL A TU GUSTO (DP-21 · Bloque 12).
 *
 * El MISMO `PreCuentaTicket` que imprime la app (y de cuyo HTML sale la imagen ESC/POS), con una
 * cuenta de ejemplo que lleva TODO (cliente, descuento, propina, opciones, nota, pago en efectivo
 * con cambio) y con lo que se está eligiendo ahora mismo, sin guardar. Datos inventados: nada de
 * esto toca una cuenta ni un folio.
 */
const DETALLES = detallesDeEjemplo(RENGLONES_DEL_TICKET_CORTO);

const VENTA = (() => {
  const base = ventaDeEjemplo(DETALLES);
  const descuentos = 40;
  const total = Math.round((base.subtotal - descuentos) * 100) / 100;
  return {
    ...base,
    descuentos,
    total,
    propina_tipo: 'porcentaje',
    propina_porcentaje: 10,
    metodo_pago: 'efectivo',
    monto_efectivo: Math.ceil(total / 100) * 100,
    cambio: Math.ceil(total / 100) * 100 - total,
  };
})();

export function VistaPreviaDelPapel({
  papel,
  elegido,
  configuracion,
}: {
  readonly papel: PapelDeVenta;
  readonly elegido: PapelATuGusto;
  /** La configuración del negocio: nombre, dirección, teléfono, logo, ancho del rollo, mensaje. */
  readonly configuracion: Readonly<Record<string, unknown>>;
}): ReactElement {
  return (
    <Superficie
      como="div"
      relleno={0}
      data-vista-previa-del-papel={papel}
      className="max-h-[32rem] overflow-auto bg-fondo-sutil p-(--espacio-2)"
    >
      <PreCuentaTicket
        venta={VENTA}
        detalles={DETALLES}
        mesa={MESA_DE_EJEMPLO}
        config={{ ...configuracion, papel_a_tu_gusto: elegido }}
        codigo={CODIGO_DE_EJEMPLO}
        puntos={undefined}
        pie={undefined}
        reimpresion={undefined}
        esFinal={papel === 'ticket'}
      />
    </Superficie>
  );
}
