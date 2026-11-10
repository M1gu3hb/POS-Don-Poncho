'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { invocarComando, nuevaClave } from '~/cliente/api';
import { sonar } from '~/sonidos/gestor';

import {
  estadosDe,
  ordenDeLaLista,
  recienListos,
  RUTA_ENTREGAR,
  RUTA_PARA_LLEVAR_DEL_DIA,
  tituloDelPedido,
  type EstadoParaLlevar,
  type PedidoParaLlevar,
} from './pedidos-para-llevar';

/** La cocina avisa al momento; la caja se entera en pocos segundos, sin Realtime. */
const CADA_CUANTO_SE_RELEE = 4_000;
export const CLAVE_PARA_LLEVAR_DEL_DIA = ['para_llevar_del_dia'] as const;

function mensajeDe(error: unknown, siNo: string): string {
  return error instanceof Error && error.message !== '' ? error.message : siNo;
}

/**
 * DP-16 · LOS PEDIDOS PARA LLEVAR DE HOY, en la Caja.
 *
 * Lo listo va arriba, grande, con su botón «Entregado» a todo lo ancho; cuando la cocina termina
 * uno, suena y aparece el aviso «Pedido para llevar N listo». Lo que sigue en cocina se ve abajo,
 * más chico. Lo entregado no estorba: sólo se cuenta.
 */
export function ParaLlevarDeHoy() {
  const clienteDeConsultas = useQueryClient();
  const anteriores = useRef<ReadonlyMap<string, EstadoParaLlevar> | null>(null);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<{ ordenId: string; mensaje: string } | null>(null);

  const lectura = useQuery({
    queryKey: CLAVE_PARA_LLEVAR_DEL_DIA,
    queryFn: () =>
      invocarComando<{ pedidos: readonly PedidoParaLlevar[] }>(RUTA_PARA_LLEVAR_DEL_DIA, {}),
    refetchInterval: CADA_CUANTO_SE_RELEE,
    refetchIntervalInBackground: true,
  });
  const pedidos = lectura.data?.pedidos;

  useEffect(() => {
    if (pedidos === undefined) return;
    for (const listo of recienListos(anteriores.current, pedidos)) {
      sonar('comandaLista');
      toast.success(`${tituloDelPedido(listo)} listo`, {
        description: 'Ya se puede entregar al cliente.',
        duration: 15_000,
      });
    }
    anteriores.current = estadosDe(pedidos);
  }, [pedidos]);

  const entregar = (pedido: PedidoParaLlevar) => {
    setEntregando(pedido.ordenId);
    setFallo(null);
    invocarComando(RUTA_ENTREGAR, { ordenId: pedido.ordenId }, { idempotencyKey: nuevaClave() })
      .then(() => {
        sonar('solicitudAtendida');
        return clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_PARA_LLEVAR_DEL_DIA });
      })
      .catch((error: unknown) => {
        sonar('error');
        setFallo({
          ordenId: pedido.ordenId,
          mensaje: mensajeDe(error, 'No se pudo marcar como entregado. Intenta de nuevo.'),
        });
      })
      .finally(() => {
        setEntregando(null);
      });
  };

  if (pedidos === undefined) {
    return lectura.isError ? (
      <Aviso tono="atencion" titulo="No se pudieron leer los pedidos para llevar">
        Se vuelve a intentar solo en unos segundos.
      </Aviso>
    ) : null;
  }
  const lista = ordenDeLaLista(pedidos);
  const listos = lista.filter((p) => p.estado === 'listo');
  const enCocina = lista.filter((p) => p.estado === 'en_cocina');
  const entregados = lista.length - listos.length - enCocina.length;
  if (listos.length === 0 && enCocina.length === 0 && entregados === 0) return null;

  return (
    <section aria-label="Pedidos para llevar de hoy" className="flex flex-col gap-(--espacio-2)">
      <h2 className="flex items-center gap-(--espacio-2) text-sm font-bold">
        <ShoppingBag aria-hidden="true" className="size-4" />
        Para llevar
        <span className="font-normal text-texto-sutil">
          {entregados > 0 ? ` · ${String(entregados)} entregados hoy` : ''}
        </span>
      </h2>
      {listos.map((pedido) => (
        <Superficie
          key={pedido.ordenId}
          como="article"
          nivel={0}
          radio="md"
          relleno={3}
          aria-label={`${tituloDelPedido(pedido)} listo`}
          className="flex flex-col gap-(--espacio-2) border-acento bg-acento-suave text-acento-suave-texto"
        >
          <div className="flex items-baseline justify-between gap-(--espacio-2)">
            <p className="text-2xl font-black leading-tight">{tituloDelPedido(pedido)}</p>
            <span className="text-sm font-bold uppercase">Listo</span>
          </div>
          <Button
            className="h-[calc(var(--altura-control)*1.5)] w-full text-lg"
            cargando={entregando === pedido.ordenId}
            onClick={() => {
              entregar(pedido);
            }}
          >
            Entregado
          </Button>
          {fallo?.ordenId === pedido.ordenId ? (
            <Aviso tono="peligro" titulo={fallo.mensaje}>
              El pedido sigue como listo: vuelve a tocar «Entregado».
            </Aviso>
          ) : null}
        </Superficie>
      ))}
      {enCocina.length > 0 ? (
        <ul className="flex flex-wrap gap-(--espacio-2)" aria-label="En cocina">
          {enCocina.map((pedido) => (
            <li
              key={pedido.ordenId}
              className="rounded-md border border-borde px-(--espacio-3) py-(--espacio-2) text-sm"
            >
              <span className="font-bold">{tituloDelPedido(pedido)}</span>
              <span className="text-texto-sutil">
                {' · '}
                {pedido.listas > 0 ? 'una parte lista, falta otra' : 'en cocina'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
