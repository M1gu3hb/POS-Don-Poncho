'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Trash2 } from 'lucide-react';

import { cantidadParaMostrar } from '~/restaurante/peso';

import type { LineaDelCarrito } from './carrito-de-la-mesa';

/** Un renglón del pedido de la mesa en el teléfono: «Quitar» sólo en lo propio (DP-9.5). */
export function RenglonDelCarrito({
  linea,
  quitando,
  alQuitar,
}: {
  readonly linea: LineaDelCarrito;
  readonly quitando: boolean;
  readonly alQuitar?: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-(--espacio-3) border-b border-borde py-(--espacio-2)">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {cantidadParaMostrar({
            cantidad: linea.cantidad,
            tipo_venta: linea.tipoVenta,
            unidad_variable: linea.unidad,
          })}{' '}
          × {linea.nombre}
        </span>
        {linea.notas === '' ? null : (
          <span className="block text-xs text-texto-sutil">«{linea.notas}»</span>
        )}
        {linea.esMia ? null : (
          <span className="block text-xs text-texto-sutil">De otro teléfono</span>
        )}
        {linea.disponible === false ? (
          <span className="block text-xs font-semibold text-peligro">
            Ya no está disponible: no se enviará
          </span>
        ) : null}
      </span>
      {linea.esMia && alQuitar !== undefined ? (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-peligro"
          disabled={quitando}
          onClick={() => {
            alQuitar(linea.id);
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Quitar
        </Button>
      ) : null}
    </li>
  );
}
