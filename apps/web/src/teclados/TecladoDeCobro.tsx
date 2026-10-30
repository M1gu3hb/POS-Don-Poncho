import { Button } from '@morphiqpos/ui/primitivas/button';
import { Dinero } from '@morphiqpos/ui/sistema';
import { Delete } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  BILLETES_DE_COBRO,
  importeExacto,
  ponerBillete,
  teclearImporte,
  type TeclaDeCobro,
} from './teclado-de-cobro';

/**
 * EL TECLADO DE COBRO · lo recibido, con el dedo.
 *
 * Va AL LADO del campo «Recibido», no en su lugar: el campo sigue aceptando el teclado físico y
 * pegar un importe, y este teclado edita el MISMO texto con las reglas de `teclado-de-cobro`.
 * Cuatro columnas: el teclado numérico (con «00» y el punto) y, en la cuarta, los billetes que
 * el cliente pone en la mano. Debajo, borrar y «Exacto» (la cuenta justa, sin cambio).
 *
 * Cada tecla es grande —el área táctil mínima de la densidad, y un cuarto más— porque se toca de
 * pie, con prisa, con la otra mano ocupada. `data-tacto` es el relieve que se hunde al apretar
 * y `data-sonido="tecla"` el sonido de teclado del negocio; el color y la profundidad los pone
 * el sistema, no esta pieza.
 *
 * Sin estado: lo recibido vive en la caja, que lo lee para cobrar.
 */

export interface TecladoDeCobroProps {
  /** Lo recibido, como está en el campo. */
  readonly importe: string;
  /** El total a cobrar, en centavos: es lo que «Exacto» deja en el campo. */
  readonly totalCentavos: number;
  readonly alCambiar: (importe: string) => void;
  /** La caja está cobrando: ninguna tecla hace nada. */
  readonly deshabilitado?: boolean | undefined;
}

type Celda = TeclaDeCobro | { readonly billete: number };

/** De izquierda a derecha y de arriba abajo: la cuarta columna son los billetes. */
const DISPOSICION: readonly Celda[] = [
  '7',
  '8',
  '9',
  { billete: BILLETES_DE_COBRO[0] },
  '4',
  '5',
  '6',
  { billete: BILLETES_DE_COBRO[1] },
  '1',
  '2',
  '3',
  { billete: BILLETES_DE_COBRO[2] },
  '0',
  '00',
  '.',
  { billete: BILLETES_DE_COBRO[3] },
];

const CENTAVOS_POR_PESO = 100;
const CLASES_DE_TECLA = 'h-[calc(var(--area-tactil-minima)*1.25)] px-0 font-numeros text-xl';

export function TecladoDeCobro({
  importe,
  totalCentavos,
  alCambiar,
  deshabilitado = false,
}: TecladoDeCobroProps): ReactElement {
  // Cada tecla lleva `type`, `data-tacto` y `data-sonido="tecla"` escritos en ella, y no en un
  // objeto compartido: el contrato de sonidos busca el atributo en el código de la tecla.
  return (
    <div
      role="group"
      aria-label="Teclado de importe"
      className="grid grid-cols-4 gap-(--espacio-2)"
    >
      {DISPOSICION.map((celda) =>
        typeof celda === 'string' ? (
          <Button
            key={celda}
            type="button"
            data-tacto
            data-sonido="tecla"
            variant="outline"
            disabled={deshabilitado}
            aria-label={celda === '.' ? 'Punto decimal' : undefined}
            className={`${CLASES_DE_TECLA} font-semibold`}
            onClick={() => {
              alCambiar(teclearImporte(importe, celda));
            }}
          >
            {celda}
          </Button>
        ) : (
          <Button
            key={celda.billete}
            type="button"
            data-tacto
            data-sonido="tecla"
            variant="secondary"
            disabled={deshabilitado}
            className={CLASES_DE_TECLA}
            onClick={() => {
              alCambiar(ponerBillete(celda.billete));
            }}
          >
            <Dinero centavos={celda.billete * CENTAVOS_POR_PESO} tamano="sm" />
          </Button>
        ),
      )}
      <Button
        type="button"
        data-tacto
        data-sonido="tecla"
        variant="ghost"
        disabled={deshabilitado || importe === ''}
        className={`${CLASES_DE_TECLA} col-span-2 text-base`}
        onClick={() => {
          alCambiar(teclearImporte(importe, 'borrar'));
        }}
      >
        <Delete aria-hidden />
        Borrar
      </Button>
      <Button
        type="button"
        data-tacto
        data-sonido="tecla"
        variant="secondary"
        disabled={deshabilitado || totalCentavos <= 0}
        className={`${CLASES_DE_TECLA} col-span-2 text-base`}
        onClick={() => {
          alCambiar(importeExacto(totalCentavos));
        }}
      >
        Exacto
      </Button>
    </div>
  );
}
