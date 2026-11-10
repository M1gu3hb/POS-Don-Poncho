import { Clock, Hourglass, Siren } from 'lucide-react';

import { textoDeEspera, type NivelDeEspera } from './espera';

/**
 * DP-16 · 2.2 · EL TIEMPO DE ESPERA DE UNA COMANDA.
 *
 * El color es del nivel (verde, ámbar, rojo) y NUNCA va solo: siempre lleva los minutos escritos,
 * un icono distinto por nivel y, para el lector de pantalla, la palabra del nivel. Las parejas de
 * color son las del sistema (`*-texto` sobre el color): contraste AA en claro y en oscuro.
 */

const ESTILO: Readonly<
  Record<NivelDeEspera | 'neutro', { clase: string; Icono: typeof Clock; palabra: string }>
> = {
  verde: { clase: 'bg-exito text-exito-texto', Icono: Clock, palabra: 'a tiempo' },
  ambar: { clase: 'bg-advertencia text-advertencia-texto', Icono: Hourglass, palabra: 'tarda' },
  rojo: { clase: 'bg-peligro text-peligro-texto', Icono: Siren, palabra: 'tarda de más' },
  neutro: { clase: 'bg-fondo-sutil text-texto', Icono: Clock, palabra: '' },
};

export interface EsperaChipProps {
  readonly minutos: number | null;
  /** `neutro` es el de «Listos»: ahí ya no corre el reloj de la cocina. */
  readonly nivel: NivelDeEspera | 'neutro';
  /** Delante del tiempo: «Listo hace», por ejemplo. */
  readonly prefijo?: string;
}

export function EsperaChip({ minutos, nivel, prefijo }: EsperaChipProps) {
  const { clase, Icono, palabra } = ESTILO[nivel];
  const texto = textoDeEspera(minutos);
  return (
    <span
      data-nivel={nivel}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-(--espacio-2) py-0.5 text-sm font-bold tabular-nums xl:text-base ${clase}`}
    >
      <Icono aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {prefijo === undefined ? '' : `${prefijo} `}
        {texto}
      </span>
      {palabra !== '' && <span className="sr-only"> ({palabra})</span>}
    </span>
  );
}
