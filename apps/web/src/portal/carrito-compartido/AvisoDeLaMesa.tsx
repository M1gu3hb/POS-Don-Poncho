'use client';

import { Aviso } from '@morphiqpos/ui/sistema';
import { Users } from 'lucide-react';

import {
  AVISO_DEL_CADUCADO,
  AVISO_DEL_VACIADO,
  personasConectadas,
  type EstadoDelCarrito,
} from './carrito-de-la-mesa';

/**
 * Arriba del portal (DP-9.5): cuántos teléfonos tienen abierto el pedido de la mesa y, si son
 * dos o más —o la mesa se abrió para dos o más—, que esperen a que todos agreguen antes de
 * enviar. Con uno solo, sólo el conteo.
 */
export function AvisoDeLaMesa({
  estado,
  sinConexion = false,
  vaciadoPorElMesero = null,
  alCerrarElVaciado,
}: {
  readonly estado: EstadoDelCarrito | null;
  /** DP-12.2 · La última lectura falló: se dice, y el sondeo sigue intentando. */
  readonly sinConexion?: boolean;
  /** DP-14.6 · El mesero vació el pedido: fijo hasta que el comensal lo cierra. */
  readonly vaciadoPorElMesero?: string | null;
  readonly alCerrarElVaciado?: () => void;
}) {
  const conexion = sinConexion ? (
    <Aviso tono="atencion" titulo="Sin conexión, reintentando…" />
  ) : null;
  const vaciado =
    vaciadoPorElMesero === null ? null : (
      <Aviso
        tono="info"
        titulo={AVISO_DEL_VACIADO}
        accion={
          <button
            type="button"
            data-cerrar-aviso-vaciado
            onClick={alCerrarElVaciado}
            className="h-(--altura-control) rounded-md border border-borde px-(--espacio-4) text-sm focus-visible:ring-2 focus-visible:ring-anillo focus-visible:outline-none"
          >
            Entendido
          </button>
        }
      />
    );
  const caducado =
    estado?.caducado === true ? (
      <Aviso tono="atencion" titulo={AVISO_DEL_CADUCADO} anuncio="ninguno" />
    ) : null;
  if (estado === null || estado.conectados === 0) {
    return conexion === null && vaciado === null && caducado === null ? null : (
      <div className="flex flex-col gap-(--espacio-2)" data-pedido-compartido>
        {conexion}
        {vaciado}
        {caducado}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-(--espacio-2)" data-pedido-compartido>
      {conexion}
      {vaciado}
      {caducado}
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
