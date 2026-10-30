import { Cifra, Dinero, Superficie } from '@morphiqpos/ui/sistema';
import { cn } from '@morphiqpos/ui/utilidades';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/**
 * UNA CIFRA DEL TABLERO · reemplaza a `ColoredStatCard` y a `PaymentCard` (DP-11.4).
 *
 * Las dos viejas pintaban cada tarjeta con un degradado, un hex y una sombra escritos en
 * línea, por tarjeta y por modo. Esta es sólida (`Superficie` de piso) y el color es un TONO
 * con nombre —un token del estilo activo—, no un valor: cambia con el estilo y con el modo sin
 * tocar la pieza.
 *
 * Jerarquía: la cifra `principal` del día (las ventas) es la más grande y se levanta un nivel;
 * el resto va en un escalón menor y al piso. El importe es `Dinero`, con cifras tabulares.
 */

export type TonoDeCifra = 'primario' | 'neutro' | 'exito' | 'peligro';

/**
 * Qué color lleva cada tono: el del icono y, si el negocio lo pidió, el del importe.
 *
 * El importe sólo se tiñe con `exito` y `peligro`, los dos colores de texto que el contrato
 * de contraste mide sobre la tarjeta. El acento se queda en el icono: un solo color de marca
 * por pantalla, y la cifra se lee en el color de texto.
 */
const TONOS: Readonly<Record<TonoDeCifra, { readonly icono: string; readonly importe: string }>> = {
  primario: { icono: 'bg-primario/10 text-primario', importe: '' },
  neutro: { icono: 'bg-fondo-sutil text-texto-sutil', importe: '' },
  exito: { icono: 'bg-exito/15 text-exito', importe: 'text-exito' },
  peligro: { icono: 'bg-peligro/10 text-peligro', importe: 'text-peligro' },
};

export interface CifraDelTableroProps {
  readonly titulo: string;
  readonly icono: LucideIcon;
  readonly tono?: TonoDeCifra;
  /** Un importe, en centavos. */
  readonly centavos?: number;
  /** O una cuenta de cosas («5 ingredientes»): la cantidad y su unidad. */
  readonly cantidad?: number;
  readonly unidad?: string;
  /** La línea de abajo: «12 tickets», «42.5% margen». */
  readonly detalle?: ReactNode;
  /** La cifra más grande del día: un escalón más de tamaño y de nivel. */
  readonly principal?: boolean;
  /** `colorear_importes_monetarios` del negocio: si es `false`, el importe va sin tinte. */
  readonly colorearImporte?: boolean;
  /** Una muestra del color de la gráfica a la que pertenece (`bg-grafico-1`). */
  readonly muestra?: string | undefined;
  readonly className?: string;
}

export function CifraDelTablero({
  titulo,
  icono: Icono,
  tono = 'neutro',
  centavos,
  cantidad,
  unidad,
  detalle,
  principal = false,
  colorearImporte = true,
  muestra,
  className,
}: CifraDelTableroProps): ReactElement {
  const tinte = colorearImporte ? TONOS[tono].importe : '';
  return (
    <Superficie
      nivel={principal ? 2 : 1}
      className={cn('flex items-start justify-between gap-(--espacio-3)', className)}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-texto-sutil uppercase">
          {muestra === undefined ? null : (
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', muestra)} />
          )}
          {titulo}
        </p>
        <p className="mt-1">
          {centavos === undefined ? (
            <Cifra
              valor={cantidad}
              unidad={unidad}
              tamano={principal ? 'xl' : 'lg'}
              className={cn('font-semibold', tinte)}
            />
          ) : (
            <Dinero centavos={centavos} tamano={principal ? 'xl' : 'lg'} className={tinte} />
          )}
        </p>
        {detalle === undefined ? null : <p className="mt-1 text-xs text-texto-sutil">{detalle}</p>}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[calc(var(--altura-control)*0.85)] shrink-0 items-center justify-center rounded-md',
          TONOS[tono].icono,
        )}
      >
        <Icono className="size-4" />
      </span>
    </Superficie>
  );
}
