'use client';

import { Dinero } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { centavosDe } from '~/cliente/dinero-del-puente';

import { cantidadParaMostrar, esPorPeso } from './peso.ts';
import {
  datosDelEstado,
  estadoDeLaLinea,
  estadosPorLinea,
  renglonesDelPlatillo,
  type ComandaParaElEstado,
  type EstadoDelPlatillo,
  type LineaConOpciones,
  type LineaParaElEstado,
} from './estado-del-platillo.ts';

/**
 * DP-25 · Parte 3 · 3.1 y 3.2 · LO QUE YA SE MANDÓ A COCINA, platillo por platillo.
 *
 * Cada renglón dice en qué va el platillo —Nuevo, En preparación, Listo o Entregado— con un
 * glifo y su palabra (el color nunca va solo) y debajo trae lo que el mesero eligió: las opciones
 * («Extras: Michelado») y la nota, igual que en cocina, Caja y ticket. Los estados los mueve la
 * cocina por platillo: la lista se repinta con la lectura de las comandas de la cuenta.
 */

export interface RenglonEnviado extends LineaConOpciones, LineaParaElEstado {
  readonly producto_nombre?: string | null;
  readonly cantidad?: number | string | null;
  readonly tipo_venta_snapshot?: string | null;
  readonly cantidad_variable_snapshot?: number | string | null;
  readonly unidad_variable_snapshot?: string | null;
  readonly subtotal?: number | string | null;
}

export interface LoEnviadoDeLaMesaProps {
  readonly renglones: readonly RenglonEnviado[];
  readonly comandas: readonly ComandaParaElEstado[];
  readonly className?: string;
}

const CLASE_DEL_ESTADO: Readonly<Record<EstadoDelPlatillo, string>> = {
  nuevo: 'border-borde bg-superficie text-texto',
  en_preparacion: 'border-advertencia bg-advertencia/15 text-texto',
  listo: 'border-exito bg-exito/15 text-texto',
  entregado: 'border-info bg-info/10 text-texto',
};

export function IndicadorDelPlatillo({ estado }: { readonly estado: EstadoDelPlatillo }) {
  const datos = datosDelEstado(estado);
  return (
    <span
      data-estado-del-platillo={estado}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-xs leading-tight font-semibold whitespace-nowrap ${CLASE_DEL_ESTADO[estado]}`}
    >
      <span aria-hidden="true">{datos.glifo}</span>
      {datos.etiqueta}
    </span>
  );
}

function cantidadDelRenglon(r: RenglonEnviado): string {
  const texto = cantidadParaMostrar({
    cantidad: r.cantidad ?? 0,
    tipo_venta_snapshot: r.tipo_venta_snapshot ?? null,
    cantidad_variable_snapshot: r.cantidad_variable_snapshot ?? null,
    unidad_variable_snapshot: r.unidad_variable_snapshot ?? null,
  });
  return esPorPeso({ tipo_venta_snapshot: r.tipo_venta_snapshot ?? null })
    ? `· ${texto}`
    : `×${texto}`;
}

function importeDe(r: RenglonEnviado): number {
  return centavosDe('DetalleVenta', 'subtotal', r.subtotal) ?? 0;
}

function RenglonDelPlatillo({
  renglon,
  estado,
}: {
  readonly renglon: RenglonEnviado;
  readonly estado: EstadoDelPlatillo;
}): ReactElement {
  const { opciones, nota } = renglonesDelPlatillo(renglon);
  return (
    <li data-renglon-enviado className="text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 font-medium text-texto">
          {renglon.producto_nombre ?? '—'} {cantidadDelRenglon(renglon)}
        </span>
        <span className="shrink-0 font-medium text-texto">
          <Dinero centavos={importeDe(renglon)} tamano="sm" />
        </span>
      </div>
      <div className="mt-0.5">
        <IndicadorDelPlatillo estado={estado} />
      </div>
      {opciones.map((texto) => (
        <p key={texto} data-opciones-del-platillo className="pl-2 text-texto-sutil">
          + {texto}
        </p>
      ))}
      {nota !== '' && (
        <p data-nota-del-platillo className="pl-2 text-texto-sutil italic">
          » {nota}
        </p>
      )}
    </li>
  );
}

export function LoEnviadoDeLaMesa({
  renglones,
  comandas,
  className,
}: LoEnviadoDeLaMesaProps): ReactElement {
  const porLinea = estadosPorLinea(comandas);
  return (
    <ul data-lo-enviado-de-la-mesa className={`space-y-2 ${className ?? ''}`}>
      {renglones.map((r, i) => (
        <RenglonDelPlatillo
          key={r.id ?? `renglon-${String(i)}`}
          renglon={r}
          estado={estadoDeLaLinea(r, porLinea)}
        />
      ))}
    </ul>
  );
}
