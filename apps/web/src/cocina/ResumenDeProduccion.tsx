import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { ChefHat, Rows3 } from 'lucide-react';

import { textoDelResumen, type RenglonDelResumen } from './resumen-de-produccion';

/**
 * DP-16 · 2.2 · LA TIRA DE «RESUMEN DE PRODUCCIÓN».
 *
 * Cuánto hay que sacar de cada platillo, sumando todas las mesas, sólo de lo pendiente de ESTA
 * estación. Va arriba, de un vistazo; con muchas variedades se parte en renglones (o corre de lado
 * en el modo compacto) y no empuja a las columnas fuera de la pantalla. Junto va el interruptor del
 * modo compacto, que cada aparato recuerda.
 */

export interface ResumenDeProduccionProps {
  readonly renglones: readonly RenglonDelResumen[];
  readonly compacto: boolean;
  readonly onCompacto: (valor: boolean) => void;
}

export function ResumenDeProduccion({ renglones, compacto, onCompacto }: ResumenDeProduccionProps) {
  return (
    <Superficie
      como="section"
      nivel={0}
      radio="md"
      relleno={0}
      aria-label="Resumen de producción"
      className="flex items-start gap-(--espacio-2) bg-fondo-sutil px-(--espacio-2) py-(--espacio-1)"
    >
      <p className="flex shrink-0 items-center gap-1.5 py-1 text-sm font-black uppercase tracking-wide">
        <ChefHat aria-hidden="true" className="size-4 shrink-0" />
        <span className="max-sm:sr-only">Resumen de producción</span>
      </p>
      {renglones.length === 0 ? (
        <p className="min-w-0 flex-1 py-1 text-sm text-texto-sutil">Nada pendiente por preparar.</p>
      ) : (
        <ul
          className={`flex min-w-0 flex-1 gap-1.5 py-0.5 ${compacto ? 'overflow-x-auto' : 'max-h-[4.75rem] flex-wrap overflow-y-auto'}`}
        >
          {renglones.map((renglon) => (
            <Superficie
              como="li"
              nivel={1}
              radio="md"
              relleno={0}
              key={renglon.clave}
              className="shrink-0 bg-fondo px-(--espacio-2) py-0.5 text-sm font-bold tabular-nums xl:text-base"
            >
              {textoDelResumen(renglon)}
            </Superficie>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant={compacto ? 'default' : 'outline'}
        aria-pressed={compacto}
        title="Más comandas a la vez en la pantalla"
        onClick={() => {
          onCompacto(!compacto);
        }}
      >
        <Rows3 /> Modo compacto
      </Button>
    </Superficie>
  );
}
