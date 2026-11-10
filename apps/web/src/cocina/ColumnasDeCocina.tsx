import { Esqueleto, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { Check, Clock, Flame } from 'lucide-react';
import { useRef, useState } from 'react';

import { TarjetaDeCocina, type TarjetaDeCocinaProps } from './TarjetaDeCocina';
import type { CuentaEnCocina } from './grupos';
import type { EstadoDeColumna } from './tipos';
import { useAlturaDisponible } from './use-altura-disponible';

/**
 * DP-16 · 2.2 · LAS TRES COLUMNAS QUE NO SE PIERDEN AL DESPLAZARSE.
 *
 * Desde la tableta en vertical (768 px) hacia arriba, el tablero ocupa el alto que queda de la
 * pantalla y CADA columna se desplaza sola, con su encabezado (palabra, icono y conteo) siempre a
 * la vista: bajar por «Nuevos» no se lleva las otras dos. En el teléfono van una debajo de otra
 * (nada se esconde: lo que pasa a «En preparación» sigue a la mano) y unas fichas con los conteos
 * llevan a cada columna.
 */

const COLUMNAS: readonly {
  readonly estado: EstadoDeColumna;
  readonly titulo: string;
  readonly Icono: typeof Clock;
  readonly banda: string;
  readonly tinte: string;
  readonly vacio: string;
}[] = [
  {
    estado: 'nuevo',
    titulo: 'Nuevos',
    Icono: Clock,
    banda: 'bg-info text-info-texto',
    tinte: 'bg-info/10',
    vacio: 'Sin pedidos nuevos',
  },
  {
    estado: 'en_preparacion',
    titulo: 'En preparación',
    Icono: Flame,
    banda: 'bg-advertencia text-advertencia-texto',
    tinte: 'bg-advertencia/10',
    vacio: 'Nada en preparación',
  },
  {
    estado: 'listo',
    titulo: 'Listos',
    Icono: Check,
    banda: 'bg-exito text-exito-texto',
    tinte: 'bg-exito/10',
    vacio: 'Nada listo por recoger',
  },
];

export interface ColumnasDeCocinaProps extends Omit<TarjetaDeCocinaProps, 'cuenta' | 'estado'> {
  readonly cuentas: Readonly<Record<EstadoDeColumna, readonly CuentaEnCocina[]>>;
  readonly cargando: boolean;
}

function contar(cuentas: readonly CuentaEnCocina[]): number {
  return cuentas.reduce((suma, c) => suma + c.comandas.length, 0);
}

export function ColumnasDeCocina({ cuentas, cargando, ...tarjeta }: ColumnasDeCocinaProps) {
  const [visible, setVisible] = useState<EstadoDeColumna>('nuevo');
  const irA = (estado: EstadoDeColumna) => {
    setVisible(estado);
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`columna-${estado}`)
      ?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  };
  const tablero = useRef<HTMLDivElement>(null);
  const alto = useAlturaDisponible(tablero);

  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <nav aria-label="Ir a una columna de la cocina" className="grid grid-cols-3 gap-1 md:hidden">
        {COLUMNAS.map(({ estado, titulo, Icono, banda }) => (
          <button
            key={estado}
            type="button"
            aria-current={visible === estado ? 'true' : undefined}
            onClick={() => {
              irA(estado);
            }}
            className={`flex min-h-(--altura-control) items-center justify-center gap-1 rounded-md px-1 text-sm font-bold ${visible === estado ? banda : 'bg-fondo-sutil text-texto'}`}
          >
            <Icono aria-hidden="true" className="size-4 shrink-0" />
            {titulo} ({contar(cuentas[estado])})
          </button>
        ))}
      </nav>

      <div
        ref={tablero}
        style={alto === null ? undefined : { height: alto }}
        className="grid gap-(--espacio-2) md:min-h-0 md:grid-cols-3 md:grid-rows-1 xl:gap-(--espacio-3)"
      >
        {COLUMNAS.map(({ estado, titulo, Icono, banda, tinte, vacio }) => (
          <Superficie
            key={estado}
            como="section"
            nivel={0}
            relleno={0}
            aria-labelledby={`columna-${estado}`}
            className={`flex min-h-0 flex-col overflow-hidden ${tinte}`}
          >
            <h2
              id={`columna-${estado}`}
              className={`flex shrink-0 items-center justify-between gap-(--espacio-2) px-(--espacio-3) py-(--espacio-2) text-sm font-bold uppercase tracking-wide xl:text-base ${banda}`}
            >
              <span className="inline-flex items-center gap-(--espacio-2)">
                <Icono aria-hidden="true" className="size-4 shrink-0 xl:size-5" />
                {titulo}
              </span>
              <span className="font-numeros tabular-nums">({contar(cuentas[estado])})</span>
            </h2>
            <ol className="flex min-h-0 flex-1 flex-col gap-(--espacio-2) overflow-y-auto overscroll-contain p-(--espacio-2)">
              {cuentas[estado].map((cuenta) => (
                <TarjetaDeCocina key={cuenta.clave} cuenta={cuenta} estado={estado} {...tarjeta} />
              ))}
              {cuentas[estado].length === 0 &&
                (cargando ? (
                  <li
                    aria-busy="true"
                    aria-label="Cargando pedidos"
                    className="flex flex-col gap-(--espacio-2)"
                  >
                    <Esqueleto className="h-24 w-full rounded-lg" />
                    <Esqueleto className="h-[calc(var(--altura-control)*1.4)] w-full rounded-lg" />
                  </li>
                ) : (
                  <li>
                    <Vacio icono={<Icono />} titulo={vacio} tamano="compacto" />
                  </li>
                ))}
            </ol>
          </Superficie>
        ))}
      </div>
    </div>
  );
}
