'use client';
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import { CheckCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatearCantidadVariable } from '@/utils/tipoVentaUtils';
import {
  contadorDeEntregados,
  contadorDeListos,
  hayQueEntregar,
  resumenPorEstacion,
} from '~/restaurante/avance-por-estacion';

/**
 * DP-24 · 4.2 · «Listo para recoger» dentro de la mesa activa, una tarjeta POR ESTACIÓN.
 *
 * Cada tarjeta lleva contadores que se van sumando («Listos 1 de 4», «Entregados 1 de 4»), lo que
 * ya está en la ventana y su propio botón «Marcar entregado», que entrega SÓLO lo que ya está
 * listo de esa estación. Si luego sale otro platillo, la MISMA tarjeta vuelve a ofrecer entregar:
 * no hay una tarjeta por cada platillo. La cuenta sale del mismo cálculo que las nubecitas del
 * mapa (`~/restaurante/avance-por-estacion`).
 *
 * NO toca inventario, caja, cobro, tickets ni finanzas. El estado al que queda la mesa lo decide
 * y lo escribe el servidor en la misma transacción que entrega los platillos.
 */

/** Los platillos de la estación que esperan en la ventana, con su cantidad en palabras. */
function platillosListos(comandas, comandaIds) {
  const ids = new Set(comandaIds);
  const salida = [];
  comandas
    .filter((c) => ids.has(c.id))
    .forEach((c) => {
      (Array.isArray(c.items) ? c.items : [])
        .filter((it) => it?.estado === 'listo')
        .forEach((it) => {
          salida.push({
            id: it.id,
            nombre: it.producto_nombre || '—',
            texto: formatearCantidadVariable(it),
            cantidad: Number(it.cantidad) || 0,
          });
        });
    });
  return salida;
}

export default function ListosParaRecogerCard({ ventaId, onAfterEntregar }) {
  const queryClient = useQueryClient();
  const [entregando, setEntregando] = useState(false);
  // El motivo del último fallo, escrito en la tarjeta hasta el siguiente intento.
  const [falloDeEntrega, setFalloDeEntrega] = useState(null);

  // Las comandas de ESTA cuenta, con sus platillos. Refetch corto: la cocina marca desde otra
  // pantalla y el mesero tiene que verlo en seguida. Sin `catch { return [] }`: el fallo sube.
  const { data: pedidos = [], isFetched } = useQuery({
    queryKey: ['pedidos_listos_mesero', ventaId || 'none'],
    queryFn: async () => {
      if (!ventaId) return [];
      const arr = await api.entidades.PedidoPreparacion.filter({ venta_id: ventaId });
      return Array.isArray(arr) ? arr : [];
    },
    enabled: !!ventaId,
    refetchInterval: 1500,
    staleTime: 1500,
    placeholderData: (prev) => prev,
  });

  const comandas = useMemo(() => (Array.isArray(pedidos) ? pedidos : []), [pedidos]);
  // Una estación se enseña mientras algo haya salido de ella y no todo se haya entregado.
  const estaciones = useMemo(
    () =>
      resumenPorEstacion(comandas).filter((e) => e.salidos > 0 && e.entregados < e.total),
    [comandas],
  );

  if (!ventaId || !isFetched || estaciones.length === 0) return null;

  const hayVarias = estaciones.filter(hayQueEntregar).length > 1;
  const nombres = estaciones.map((g) => g.nombre);
  const titulo =
    nombres.length === 1
      ? `Listo para recoger: ${nombres[0]}`
      : `Listo para recoger: ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

  const refrescarTodo = () => {
    queryClient.invalidateQueries({ queryKey: ['pedidos_listos_mesero'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos_cocina'] });
    queryClient.invalidateQueries({ queryKey: ['avisos_de_listo'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos_del_mapa'] });
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
    queryClient.refetchQueries({ queryKey: ['pedidos_listos_mesero'], type: 'active' }).catch(() => {});
  };

  // Lo listo de esas comandas se pinta ya como entregado, sin esperar a la lectura.
  const optimisticEntregar = (comandaIds) => {
    const key = ['pedidos_listos_mesero', ventaId || 'none'];
    const ids = comandaIds ? new Set(comandaIds) : null;
    queryClient.setQueryData(key, (prev) =>
      (Array.isArray(prev) ? prev : []).map((c) =>
        c && (ids === null || ids.has(c.id))
          ? {
              ...c,
              items: (Array.isArray(c.items) ? c.items : []).map((it) =>
                it?.estado === 'listo' ? { ...it, estado: 'entregado' } : it,
              ),
            }
          : c,
      ),
    );
  };

  // `grupo` es una estación, o `null` para entregar lo listo de todas.
  const entregar = async (grupo) => {
    if (entregando) return;
    setEntregando(true);
    setFalloDeEntrega(null);
    const comandaIds = grupo ? [...grupo.comandaIds] : null;
    optimisticEntregar(comandaIds);
    try {
      const r = await api.comandos.ejecutar('/api/restaurante/entregar-pedidos', {
        ordenId: ventaId,
        ...(comandaIds ? { comandaIds } : {}),
      });
      const entregados = Number(r?.platillos) || 0;
      if (entregados === 0) {
        toast.message('No había nada listo para entregar.');
      } else {
        const nombresEntregados = Array.isArray(r?.estaciones) ? r.estaciones.filter(Boolean) : [];
        toast.success(
          nombresEntregados.length > 0 ? `Entregado: ${nombresEntregados.join(' y ')}.` : 'Entregado.',
        );
      }
      refrescarTodo();
      if (typeof onAfterEntregar === 'function') {
        try {
          onAfterEntregar({
            ...r,
            mesaCambiada: r?.estadoMesa != null,
            estadoMesa: r?.estadoMesa ?? null,
          });
        } catch (e) {
          console.warn('[ListosCard] cb', e);
        }
      }
    } catch (e) {
      // El comando ya traduce el fallo: dice qué ocurrió.
      const motivo = e?.message || 'No se pudo entregar. Intenta de nuevo.';
      toast.error(motivo);
      setFalloDeEntrega(motivo);
      refrescarTodo();
    } finally {
      setEntregando(false);
    }
  };

  return (
    <div
      className="mx-4 mt-3 shrink-0 rounded-xl border-2
        bg-gradient-to-b from-exito/10 to-exito/15
        border-exito"
      style={{
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 3px 10px rgba(22,163,74,0.18)',
      }}
    >
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 2px 6px rgba(22,163,74,0.4)',
          }}
        >
          <CheckCheck className="w-5 h-5 text-exito-texto" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-black text-sm text-exito leading-tight">{titulo}</p>
          <p className="text-[11px] text-exito/80 leading-tight">Recoge y entrega al cliente</p>
        </div>
      </div>

      {/* Una tarjeta por estación, con sus contadores y su propio «Marcar entregado». */}
      <div className="px-3 pb-3 space-y-1.5">
        {estaciones.map((g) => (
            <div
              key={g.clave}
              data-estacion={g.nombre}
              className="rounded-lg border bg-superficie/80 px-2.5 py-1.5 flex items-start gap-2"
              style={{ borderLeft: `3px solid ${g.color || '#4A5568'}` }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] font-bold leading-tight"
                  style={{ color: g.color || '#4A5568' }}
                >
                  {g.nombre}
                </p>
                <p className="text-[11px] font-semibold leading-tight text-texto">
                  <span>{contadorDeListos(g)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{contadorDeEntregados(g)}</span>
                </p>
                {hayQueEntregar(g) && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {platillosListos(comandas, g.comandaIds)
                      .map((it) => `${it.texto ? `${it.texto} ×` : `${it.cantidad}×`} ${it.nombre}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              {hayQueEntregar(g) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => entregar(g)}
                  disabled={entregando}
                  className="h-11 px-3 text-xs gap-1 shrink-0 border-exito/30 text-exito hover:bg-exito/10"
                  title={`Marcar entregado: ${g.nombre}`}
                >
                  Marcar entregado
                </Button>
              )}
            </div>
        ))}
      </div>

      {/* El botón principal, a todo lo ancho y de 48 px como mínimo (dedo, no puntero): sólo cuando
          hay listos en más de una estación; con una sola, su propia tarjeta ya tiene el botón. */}
      {hayVarias && (
        <div className="px-3 pb-3 space-y-2">
          <Button
            size="lg"
            onClick={() => entregar(null)}
            disabled={entregando}
            className="w-full min-h-12 gap-2 text-base font-bold text-exito-texto"
            style={{
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 2px 6px rgba(22,163,74,0.3)',
            }}
          >
            {entregando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCheck className="w-5 h-5" />
            )}
            Entregar listos
          </Button>
        </div>
      )}
      {falloDeEntrega && (
        <div className="px-3 pb-3">
          <p
            role="alert"
            className="rounded-lg border border-peligro/40 bg-peligro/5 px-3 py-2 text-sm font-semibold text-peligro"
          >
            {falloDeEntrega} No se marcó nada como entregado: lo de la ventana sigue ahí.
          </p>
        </div>
      )}
    </div>
  );
}
