import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Dinero } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { TecladoDeCobro } from '~/teclados/TecladoDeCobro';
import { cambioDelCobro, limpiarImporte } from '~/teclados/teclado-de-cobro';

/**
 * LO RECIBIDO Y SU CAMBIO · el efectivo del cobro, con el campo Y el teclado.
 *
 * El campo «Recibido» sigue siendo un campo de texto (el teclado físico, pegar), con el mismo
 * filtro de siempre: sólo dígitos y un punto, hasta siete cifras y dos decimales. Lo recibido
 * es el TEXTO que la caja lee al cobrar; el teclado de la pantalla (`TecladoDeCobro`) edita ese
 * mismo texto, al lado del campo y no en su lugar. Por eso este componente no tiene estado: lo
 * recibido vive en la caja.
 *
 * El cambio es el número que el cajero saca del cajón: va grande, con su palabra («Cambio») y
 * no sólo en color. Aparece cuando ya se tecleó algo, y nunca es negativo.
 */

export interface RecibidoDelCobroProps {
  /** Lo recibido, como texto. Vacío significa «pagó exacto». */
  readonly recibido: string;
  readonly alCambiarRecibido: (recibido: string) => void;
  /** Lo que se cobra, en centavos. */
  readonly totalCentavos: number;
  /** La caja está cobrando: el teclado de la pantalla no hace nada. */
  readonly procesando: boolean;
}

export function RecibidoDelCobro({
  recibido,
  alCambiarRecibido,
  totalCentavos,
  procesando,
}: RecibidoDelCobroProps): ReactElement {
  return (
    <div className="grid gap-(--espacio-3) sm:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="cobro-recibido">Recibido</Label>
        <Input
          id="cobro-recibido"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={recibido}
          onChange={(evento) => {
            const limpio = limpiarImporte(evento.target.value);
            if (limpio !== null) alCambiarRecibido(limpio);
          }}
          className="h-[calc(var(--altura-control)*1.4)] text-right font-numeros text-xl font-bold tabular-nums"
        />
        {recibido === '' ? null : (
          <p className="flex items-baseline justify-between gap-(--espacio-2)">
            <span className="text-sm text-texto-sutil">Cambio</span>
            <Dinero
              centavos={cambioDelCobro(recibido, totalCentavos)}
              tamano="xl"
              className="text-exito"
            />
          </p>
        )}
      </div>
      <TecladoDeCobro
        importe={recibido}
        totalCentavos={totalCentavos}
        alCambiar={alCambiarRecibido}
        deshabilitado={procesando}
      />
    </div>
  );
}
