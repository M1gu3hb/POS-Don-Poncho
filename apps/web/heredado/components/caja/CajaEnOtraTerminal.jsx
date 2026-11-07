'use client';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, MonitorSmartphone } from 'lucide-react';
import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';

/**
 * LA CAJA ESTÁ ABIERTA EN OTRA TERMINAL (21-10-2026).
 *
 * La caja es de una terminal —la cookie de un navegador—. Quien la abrió en la
 * computadora y entra desde el teléfono veía «No hay caja abierta» y un «Abrir caja»
 * que fallaba con «ya hay una abierta en Caja 20»: parecía que la caja se había cerrado
 * sola. Este aviso dice dónde está, quién la abrió y desde cuándo, y la trae a este
 * dispositivo (`/api/caja/traer`) para cobrar y hacer su corte aquí. Si la abrió otra
 * persona y quien mira no es de la gerencia, sólo lo explica.
 */
export default function CajaEnOtraTerminal({ caja, cupo = null }) {
  const queryClient = useQueryClient();
  const [trayendo, setTrayendo] = useState(false);
  // DP-14 (ronda 2, medio 3): traerla deja SIN caja a la otra terminal: se confirma antes.
  const [confirmando, setConfirmando] = useState(false);

  const desde = new Date(caja.abiertaEn).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const donde = caja.terminalNombre ? `«${caja.terminalNombre}»` : 'otra terminal';
  const quien = caja.abiertaPor ? ` La abrió ${caja.abiertaPor}` : ' Se abrió';

  const traer = async () => {
    if (trayendo) return;
    setTrayendo(true);
    try {
      await api.comandos.ejecutar('/api/caja/traer', { sesionCajaId: caja.sesionCajaId });
      await queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      toast.success('Listo: la caja ya está en este dispositivo. Puedes cobrar y hacer el corte.');
    } catch (err) {
      toast.error(err?.message || 'No se pudo traer la caja');
    } finally {
      setTrayendo(false);
    }
  };

  return (
    <div
      role="status"
      className="px-4 py-3 rounded-xl bg-advertencia/10 border-2 border-advertencia/30 text-sm text-advertencia flex items-start gap-3"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-advertencia" />
      <div className="flex-1">
        <p className="font-bold">La caja está abierta en {donde}</p>
        <p className="text-xs opacity-90">
          {quien} el {desde}
          {desde.endsWith('.') ? ' ' : '. '}
          {caja.puedoTraerla
            ? 'Úsala aquí para cobrar y hacer su corte desde este dispositivo.'
            : 'Pide a quien la abrió o a la gerencia que la traiga a este dispositivo, o que haga su corte.'}
        </p>
        <p className="text-xs opacity-90">
          Ya hay {cupo ?? 2} cajas abiertas: cierra una para abrir otra aquí, o trae esta.
        </p>
        {confirmando && (
          <p className="text-xs font-bold">
            {donde} se queda sin caja: quien cobra ahí tendrá que abrir otra o traerla de vuelta.
          </p>
        )}
      </div>
      {caja.puedoTraerla && !confirmando && (
        <Button size="sm" onClick={() => setConfirmando(true)} className="shrink-0">
          <MonitorSmartphone className="w-4 h-4 mr-1" />
          Traer esta caja aquí
        </Button>
      )}
      {caja.puedoTraerla && confirmando && (
        <div className="flex shrink-0 flex-col gap-1">
          <Button size="sm" onClick={traer} disabled={trayendo}>
            {trayendo ? 'Trayendo…' : 'Sí, traerla'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmando(false)}>
            No
          </Button>
        </div>
      )}
    </div>
  );
}
