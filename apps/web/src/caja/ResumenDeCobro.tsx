import { Button } from '@morphiqpos/ui/primitivas/button';
import { Dinero, Superficie } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { avisoDePropinaPendiente } from './cuentas-pendientes';

/**
 * EL RESUMEN DEL COBRO · lo que se va a cobrar, y lo que falta decidir.
 *
 * La jerarquía del diálogo: 1 el total, 2 el método, 3 el desglose. El total es el número más
 * grande de la pantalla —cifras tabulares y la fuente de display—, en una superficie levantada
 * un nivel sobre el resto para que se lea desde el otro lado del mostrador. Arriba de él, el
 * desglose en chico: la venta, y la propina si la hay.
 *
 * La propina sin decidir (el mesero no la acordó, el comensal no eligió en el QR o delegó en la
 * caja) es un botón y no un dato: abre su diálogo, y el cobro no sigue sin ella.
 */

export interface ResumenDeCobroProps {
  /** La venta sin propina, en centavos. */
  readonly subtotalCentavos: number;
  /** La propina ya decidida, en centavos (cero si no hay). */
  readonly propinaCentavos: number;
  /** El porcentaje de esa propina (10, 12.5), o cero si fue un monto. */
  readonly propinaPorcentaje: number;
  /** Lo que se cobra: la venta más la propina, en centavos. */
  readonly totalCentavos: number;
  /** El ajuste del negocio: el total en el color del acento, o en el del texto. */
  readonly colorearImportes: boolean;
  /** `propina_tipo` de la cuenta: dice si la propina quedó sin decidir. */
  readonly propinaTipo: string | null | undefined;
  readonly alDefinirPropina: () => void;
}

export function ResumenDeCobro({
  subtotalCentavos,
  propinaCentavos,
  propinaPorcentaje,
  totalCentavos,
  colorearImportes,
  propinaTipo,
  alDefinirPropina,
}: ResumenDeCobroProps): ReactElement {
  const porDefinir = avisoDePropinaPendiente(propinaTipo);

  return (
    <Superficie nivel={2} relleno={4} className="flex flex-col gap-(--espacio-3)">
      <dl className="flex flex-col gap-(--espacio-1) text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-texto-sutil">Subtotal</dt>
          <dd>
            <Dinero centavos={subtotalCentavos} tamano="sm" />
          </dd>
        </div>
        {propinaCentavos > 0 ? (
          <div className="flex items-baseline justify-between">
            <dt className="text-texto-sutil">
              Propina {propinaPorcentaje > 0 ? `(${String(propinaPorcentaje)}%)` : ''}
            </dt>
            <dd>
              <Dinero centavos={propinaCentavos} tamano="sm" conSigno />
            </dd>
          </div>
        ) : null}
      </dl>
      {porDefinir === null ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-(--area-tactil-minima) w-full justify-start py-(--espacio-2) text-left whitespace-normal"
          onClick={alDefinirPropina}
        >
          {porDefinir}
        </Button>
      )}
      <div className="flex flex-col items-center gap-(--espacio-1) border-t border-borde pt-(--espacio-3) text-center">
        {/* El color va en el envoltorio, no en `<Dinero className>`: `text-display` (el tamaño del
            total) no lo conoce el fusionador de clases y lo tomaría por un color a quitar. */}
        <p className={colorearImportes ? 'text-primario' : 'text-texto'}>
          <Dinero centavos={totalCentavos} tamano="total" />
        </p>
        <p className="text-xs font-medium tracking-wide text-texto-sutil">TOTAL A COBRAR</p>
      </div>
    </Superficie>
  );
}
