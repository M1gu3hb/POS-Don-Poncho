'use client';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DoorOpen, MonitorSmartphone } from 'lucide-react';
import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import { abiertaDesde, dondeEsta, textoDelCupo } from '~/restaurante/cajas-en-otros-aparatos';

/**
 * DP-18 · LAS CAJAS ABIERTAS EN OTROS APARATOS, SIEMPRE A LA VISTA (antes «CajaEnOtraTerminal»).
 *
 * El 11-11 Miguel tenía una caja abierta en la tableta desde las 10:14; en la PC, con cupo de 2, la
 * Caja decía «No hay caja abierta en este aparato · Abrir caja» y callaba la de la tableta (DP-D74):
 * creyó que se había cerrado sola. Ahora se ve cada caja abierta en otro aparato —dónde, quién y
 * desde qué hora—, con «Trasladar aquí» (con confirmación: el otro aparato se queda sin caja) y,
 * si todavía cabe otra, «Abrir otra caja aquí (N de M)». Con caja propia, las demás se enlistan sin
 * botones. Los datos llegan de `caja.estado` (`otrasCajas`), que se relee cada pocos segundos, al
 * volver a la pestaña y al cambiar el cupo.
 */
export default function CajasEnOtrosAparatos({ cajas, hayCaja, puedoAbrir, cupo, abiertas, onAbrir }) {
  const queryClient = useQueryClient();
  const [trayendo, setTrayendo] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const traer = async (caja) => {
    if (trayendo) return;
    setTrayendo(caja.sesionCajaId);
    try {
      await api.comandos.ejecutar('/api/caja/traer', { sesionCajaId: caja.sesionCajaId });
      await queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      toast.success('Listo: la caja ya está en este aparato. Puedes cobrar y hacer el corte.');
    } catch (err) {
      toast.error(err?.message || 'No se pudo trasladar la caja');
    } finally {
      setTrayendo(null);
      setConfirmando(null);
    }
  };

  if (cajas.length === 0) return null;
  return (
    <section
      aria-label="Cajas abiertas en otros aparatos"
      className="flex flex-col gap-2 rounded-xl border-2 border-info/30 bg-info/10 px-4 py-3 text-sm"
    >
      {!hayCaja && <p className="font-bold text-texto">No hay caja abierta en este aparato</p>}
      <p className={hayCaja ? 'font-bold text-texto' : 'text-texto'}>
        {cajas.length === 1
          ? 'Hay una caja abierta en otro aparato:'
          : `Hay ${cajas.length} cajas abiertas en otros aparatos:`}
      </p>
      <ul className="flex flex-col gap-2">
        {cajas.map((caja) => (
          <li key={caja.sesionCajaId} className="flex flex-wrap items-center gap-2">
            <MonitorSmartphone className="size-5 shrink-0 text-info" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{dondeEsta(caja)}</span>
              {' · '}
              {abiertaDesde(caja)}
            </span>
            {!hayCaja && caja.puedoTraerla && confirmando !== caja.sesionCajaId && (
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => setConfirmando(caja.sesionCajaId)}>
                Trasladar aquí
              </Button>
            )}
            {!hayCaja && caja.puedoTraerla && confirmando === caja.sesionCajaId && (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold">{dondeEsta(caja)} se queda sin caja.</span>
                <Button size="sm" className="min-h-11" onClick={() => traer(caja)} disabled={trayendo !== null}>
                  {trayendo === caja.sesionCajaId ? 'Trasladando…' : 'Sí, trasladarla'}
                </Button>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => setConfirmando(null)}>
                  No
                </Button>
              </span>
            )}
            {!hayCaja && !caja.puedoTraerla && (
              <span className="text-xs text-texto-sutil">Sólo quien la abrió o la gerencia la puede trasladar.</span>
            )}
          </li>
        ))}
      </ul>
      {!hayCaja && (
        <p className="text-xs text-texto-sutil">{textoDelCupo({ puedoAbrir, cupo, abiertas })}</p>
      )}
      {!hayCaja && puedoAbrir && (
        <Button size="sm" className="min-h-11 self-start" onClick={onAbrir}>
          <DoorOpen className="mr-1 size-4" aria-hidden /> Abrir otra caja aquí ({String(abiertas + 1)} de {String(cupo)})
        </Button>
      )}
    </section>
  );
}
