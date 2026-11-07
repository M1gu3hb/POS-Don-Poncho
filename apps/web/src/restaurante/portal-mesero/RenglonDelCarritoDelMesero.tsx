'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Cifra, Dinero } from '@morphiqpos/ui/sistema';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { cantidadParaMostrar } from '~/restaurante/peso';
import type { LineaDelCarrito } from '~/portal/carrito-compartido/carrito-de-la-mesa';

/**
 * UNA LÍNEA DEL CARRITO DE LA MESA, en el portal en modo mesero (DP-12.2): el platillo, su nota,
 * si ya no está en el menú, la cantidad con ± (sólo si es entera: lo que se vende por peso no se
 * cuenta de uno en uno), su importe si se ve y «Quitar». Las órdenes las da la lista.
 */

const ENTERO = /^\d+$/;

export function RenglonDelCarritoDelMesero({
  linea,
  ocupado,
  alCambiar,
  alQuitar,
}: {
  readonly linea: LineaDelCarrito;
  readonly ocupado: boolean;
  readonly alCambiar: (cantidad: string) => void;
  readonly alQuitar: () => void;
}) {
  const cantidad = Number(linea.cantidad);
  // DP-14 · 1 kg de barbacoa también es «1» en el carrito: se dice «1 kg» y no se cuenta con ±.
  const porPeso = linea.tipoVenta === 'variable_medida';
  return (
    <li className="flex items-center gap-(--espacio-2) border-b border-borde py-(--espacio-2)">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{linea.nombre}</span>
        {linea.notas === '' ? null : (
          <span className="block text-xs text-texto-sutil">«{linea.notas}»</span>
        )}
        {linea.disponible === false ? (
          <span className="block text-xs font-semibold text-peligro">
            Ya no está en el menú digital
          </span>
        ) : null}
      </span>
      {ENTERO.test(linea.cantidad) && !porPeso ? (
        <span className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label={`Uno menos de ${linea.nombre}`}
            disabled={ocupado || linea.cantidad === '1'}
            onClick={() => {
              alCambiar(String(cantidad - 1));
            }}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="w-8 text-center text-sm font-semibold">
            <Cifra valor={cantidad} />
          </span>
          <Button
            size="icon"
            variant="outline"
            aria-label={`Uno más de ${linea.nombre}`}
            disabled={ocupado}
            onClick={() => {
              alCambiar(String(cantidad + 1));
            }}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </span>
      ) : (
        <span className="text-sm font-semibold tabular-nums">
          {cantidadParaMostrar({
            cantidad: linea.cantidad,
            tipo_venta: linea.tipoVenta,
            unidad_variable: linea.unidad,
          })}
        </span>
      )}
      {linea.precioCentavos === null ? null : (
        <Dinero centavos={Math.round(cantidad * Number(linea.precioCentavos))} />
      )}
      <Button
        size="icon"
        variant="ghost"
        className="text-peligro"
        aria-label={`Quitar ${linea.nombre}`}
        disabled={ocupado}
        onClick={alQuitar}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
