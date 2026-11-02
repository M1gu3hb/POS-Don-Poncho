'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { invocarComando } from '~/cliente/api';
import type { EstadoDelCarrito } from '~/portal/carrito-compartido/carrito-de-la-mesa';

/**
 * EL CARRITO DEL PORTAL EN MODO MESERO (DP-12.2) · las llamadas, dentro de la sesión del mesero.
 * La lectura se sondea (no se audita); cambiar, quitar, borrar y enviar son comandos, auditados con
 * su empleo. Abrir la mesa es el `restaurante.abrir_mesa` de siempre.
 */

export interface MesaDelCarrito {
  readonly id: string;
  readonly numero: number;
  readonly nombre: string | null;
  readonly estado: string;
  readonly ordenId: string | null;
}

export interface CarritoParaElMesero {
  readonly mesa: MesaDelCarrito;
  readonly carrito: EstadoDelCarrito;
}

/** Por la mesa que el mesero tiene abierta, o por el QR que escaneó. */
export type MesaBuscada = { readonly mesaId: string } | { readonly qr: string };

const SONDEO_MS = 3_000;

export function claveDelCarritoDelMesero(buscada: MesaBuscada | null) {
  return ['carrito_del_portal_para_el_mesero', buscada] as const;
}

/** El carrito de la mesa, cada 3 s mientras está a la vista. */
export function useCarritoDelMesero(buscada: MesaBuscada | null) {
  const clienteDeConsultas = useQueryClient();
  const clave = claveDelCarritoDelMesero(buscada);
  const consulta = useQuery({
    queryKey: clave,
    queryFn: ({ signal }) =>
      invocarComando<CarritoParaElMesero>('/api/restaurante/carrito-de-la-mesa', buscada, {
        signal,
      }),
    enabled: buscada !== null,
    refetchInterval: SONDEO_MS,
    staleTime: SONDEO_MS / 2,
  });
  return {
    datos: consulta.data ?? null,
    error: consulta.error,
    cargando: consulta.isPending && buscada !== null,
    sinConexion: consulta.isError && consulta.data !== undefined,
    releer: () => clienteDeConsultas.invalidateQueries({ queryKey: clave }),
  };
}

export function cambiarCantidad(mesaId: string, lineaId: string, cantidad: string) {
  return invocarComando<EstadoDelCarrito>('/api/restaurante/carrito-cambiar', {
    mesaId,
    lineaId,
    cantidad,
  });
}

export function quitarLinea(mesaId: string, lineaId: string) {
  return invocarComando<EstadoDelCarrito>('/api/restaurante/carrito-quitar', { mesaId, lineaId });
}

export function borrarElPedido(mesaId: string) {
  return invocarComando<EstadoDelCarrito>('/api/restaurante/carrito-vaciar', { mesaId });
}

export function enviarACocina(mesaId: string, notaGeneral: string) {
  return invocarComando<{ readonly enviado: boolean; readonly ronda: number }>(
    '/api/restaurante/carrito-enviar',
    { mesaId, notaGeneral },
  );
}

export function abrirLaMesa(mesaId: string, personas: number) {
  return invocarComando<{ readonly ordenId: string }>('/api/restaurante/abrir-mesa', {
    mesaId,
    personas,
  });
}

/** «Ver QR de la mesa»: el token de su QR, para dibujarlo en la pantalla. */
export function qrDeLaMesa(mesaId: string) {
  return invocarComando<{
    readonly mesaId: string;
    readonly numero: number;
    readonly token: string | null;
  }>('/api/restaurante/qr-de-la-mesa', { mesaId });
}
