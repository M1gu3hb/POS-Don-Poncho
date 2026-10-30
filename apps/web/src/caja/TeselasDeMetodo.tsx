import { Superficie } from '@morphiqpos/ui/sistema';
import { Banknote, Check, CreditCard, Layers, Smartphone, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * LAS CUATRO TESELAS DEL MÉTODO DE PAGO · Efectivo, Tarjeta, Transferencia y Mixto.
 *
 * Es un grupo de una sola elección: la tesela elegida lleva el anillo del acento (`activa`), la
 * palomita y `aria-pressed`, así que el color no es lo único que dice cuál está. Todas son del
 * mismo peso —ningún método es "el de siempre" para esta pieza—, y el nombre de cada una es su
 * palabra exacta: las pruebas de navegador las buscan por ese nombre.
 */

export type MetodoDeCobro = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';

const METODOS: readonly {
  readonly clave: MetodoDeCobro;
  readonly etiqueta: string;
  readonly Icono: LucideIcon;
}[] = [
  { clave: 'efectivo', etiqueta: 'Efectivo', Icono: Banknote },
  { clave: 'tarjeta', etiqueta: 'Tarjeta', Icono: CreditCard },
  { clave: 'transferencia', etiqueta: 'Transferencia', Icono: Smartphone },
  { clave: 'mixto', etiqueta: 'Mixto', Icono: Layers },
];

export function TeselasDeMetodo({
  metodo,
  alElegir,
}: {
  readonly metodo: MetodoDeCobro;
  readonly alElegir: (metodo: MetodoDeCobro) => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <p id="cobro-metodo-rotulo" className="text-xs text-texto-sutil">
        Método de pago
      </p>
      <div
        role="group"
        aria-labelledby="cobro-metodo-rotulo"
        className="grid grid-cols-2 gap-(--espacio-2)"
      >
        {METODOS.map(({ clave, etiqueta, Icono }) => {
          const elegido = metodo === clave;
          return (
            <Superficie
              key={clave}
              como="button"
              type="button"
              interactiva
              activa={elegido}
              aria-pressed={elegido}
              relleno={3}
              radio="md"
              onClick={() => {
                alElegir(clave);
              }}
              className="relative flex min-h-(--area-tactil-minima) w-full items-center gap-(--espacio-2) text-sm font-semibold"
            >
              <Icono aria-hidden="true" className="size-5 shrink-0 text-texto-sutil" />
              {etiqueta}
              {/* La palomita: el anillo no puede ser el único que diga cuál está elegida. */}
              {elegido ? (
                <Check
                  aria-hidden="true"
                  className="absolute top-(--espacio-1) right-(--espacio-1) size-4 text-primario"
                />
              ) : null}
            </Superficie>
          );
        })}
      </div>
    </div>
  );
}
