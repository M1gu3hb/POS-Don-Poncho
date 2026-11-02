'use client';

import { Aviso } from '@morphiqpos/ui/sistema';
import { Users } from 'lucide-react';

import { personasConectadas, type EstadoDelCarrito } from './carrito-de-la-mesa';

/**
 * Arriba del portal (DP-9.5): cuántos teléfonos tienen abierto el pedido de la mesa y, si son
 * dos o más —o la mesa se abrió para dos o más—, que esperen a que todos agreguen antes de
 * enviar. Con uno solo, sólo el conteo.
 */
export function AvisoDeLaMesa({
  estado,
  sinConexion = false,
}: {
  readonly estado: EstadoDelCarrito | null;
  /** DP-12.2 · La última lectura falló: se dice, y el sondeo sigue intentando. */
  readonly sinConexion?: boolean;
}) {
  const conexion = sinConexion ? (
    <Aviso tono="atencion" titulo="Sin conexión, reintentando…" />
  ) : null;
  if (estado === null || estado.conectados === 0) return conexion;
  return (
    <div className="flex flex-col gap-(--espacio-2)" data-pedido-compartido>
      {conexion}
      <p className="flex items-center gap-(--espacio-2) text-sm text-texto-sutil" role="status">
        <Users className="size-4" aria-hidden />
        {personasConectadas(estado.conectados)}
      </p>
      {estado.esperarATodos ? (
        <Aviso tono="atencion" titulo="Esperen a que todos agreguen su pedido antes de enviarlo." />
      ) : null}
    </div>
  );
}
