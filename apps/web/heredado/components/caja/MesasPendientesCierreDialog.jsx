'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/cliente';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { MESA_STATUS_CONFIG, insigniaDeEstadoDeMesa } from '@/lib/constants';
import { sufijoDelNombreDeLaMesa } from '~/restaurante/nombre-de-la-mesa';
import { liberarConDecision } from '~/restaurante/unir-mesas/liberar-mesa';
import { obtenerMesasPendientesCierre } from '@/utils/mesasPendientesCierre';
import { sePuedeMarcarLibre, tieneVentaPorCobrar } from '~/restaurante/mesas-pendientes-del-cierre';

/**
 * 6A — Dialog que bloquea el cierre diario cuando hay mesas pendientes.
 *
 * Lista las mesas que no están en "libre" y le pide al cajero que las cierre/libere/cobre antes de
 * intentar de nuevo. DP-14.6: las que NO tienen dinero pendiente (en limpieza, o sin cuenta) se
 * sueltan desde aquí con «Marcar libre» (`restaurante.liberar_mesa`, que se niega si hubiera
 * consumo sin cobrar). Lo demás no se toca: se cobra o se cancela en su pantalla.
 */
export default function MesasPendientesCierreDialog({ open, onClose, mesas = [] }) {
  // Tras liberar se vuelve a leer: al separar mesas unidas también quedan libres las demás.
  const [relectura, setRelectura] = useState(null);
  const arr = Array.isArray(relectura) ? relectura : Array.isArray(mesas) ? mesas : [];
  const queryClient = useQueryClient();
  const [liberadas, setLiberadas] = useState(() => new Set());
  const [liberando, setLiberando] = useState(null);
  const [fallo, setFallo] = useState(null);
  // DP-16 (QA-J, H2): la mesa unida se decide AQUÍ, en su renglón. Un diálogo aparte encima de
  // éste lo cerraba el atrapafoco de éste y la cajera sólo veía el error.
  const [porDecidir, setPorDecidir] = useState(null);
  const decisionPendiente = useRef(null);
  const decidir = (decision) => {
    const resolver = decisionPendiente.current;
    decisionPendiente.current = null;
    setPorDecidir(null);
    resolver?.(decision);
  };

  const marcarLibre = async (m) => {
    setLiberando(m.id);
    setFallo(null);
    try {
      const hecho = await liberarConDecision(
        m.id,
        (entrada) => api.comandos.ejecutar('/api/restaurante/liberar-mesa', entrada),
        () =>
          new Promise((resolver) => {
            decisionPendiente.current = resolver;
            setPorDecidir(m.id);
          }),
      );
      if (hecho) {
        setLiberadas((previas) => new Set(previas).add(m.id));
        queryClient.invalidateQueries({ queryKey: ['mesas'] });
        setRelectura(await obtenerMesasPendientesCierre().catch(() => null));
      }
    } catch (err) {
      setFallo(err?.message || 'No se pudo marcar libre la mesa.');
    } finally {
      setLiberando(null);
    }
  };
  // Cada apertura parte de la lectura nueva del padre: lo liberado en la anterior ya no cuenta.
  useEffect(() => {
    if (!open) {
      setLiberadas(new Set());
      setFallo(null);
      decisionPendiente.current?.(null);
      decisionPendiente.current = null;
      setPorDecidir(null);
      setRelectura(null);
    }
  }, [open]);
  const pendientes = arr.filter((m) => !liberadas.has(m.id));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose?.();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-advertencia" />
            No puedes cerrar caja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border-2 border-advertencia/30 bg-advertencia/10 p-3 text-sm text-advertencia">
            <p className="font-semibold">Hay mesas pendientes.</p>
            <p className="text-xs mt-0.5">
              Cierra, cobra o libera estas mesas antes de hacer el corte.
            </p>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {fallo && (
              <p role="alert" className="text-xs text-peligro">
                {fallo}
              </p>
            )}
            {arr.length > 0 && pendientes.length === 0 && (
              <p role="status" className="text-sm text-center py-2">
                Listo: ya puedes intentar el cierre otra vez.
              </p>
            )}
            {arr.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin mesas pendientes.
              </p>
            ) : (
              pendientes.map((m) => {
                const cfg = MESA_STATUS_CONFIG[m?.estado] || MESA_STATUS_CONFIG.libre;
                return (
                  <div key={m.id} className="rounded-lg border bg-card">
                  <div className="flex items-center gap-3 p-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-heading font-black text-xs"
                      style={{
                        ...insigniaDeEstadoDeMesa(cfg),
                        border: `1.5px solid ${cfg.stroke}`,
                      }}
                    >
                      {m?.numero ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Mesa {m?.numero ?? '—'}
                        {sufijoDelNombreDeLaMesa(m)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Estado: {cfg.label}
                        {tieneVentaPorCobrar(m) ? ' · Con venta activa' : ''}
                      </p>
                    </div>
                    {sePuedeMarcarLibre(m) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        data-marcar-libre={m.id}
                        disabled={liberando !== null}
                        onClick={() => marcarLibre(m)}
                      >
                        {liberando === m.id ? 'Liberando…' : 'Marcar libre'}
                      </Button>
                    ) : (
                      <UtensilsCrossed className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {porDecidir === m.id && (
                    <div
                      ref={(nodo) => nodo?.scrollIntoView({ block: 'nearest' })}
                      role="group"
                      aria-label={`Mesa ${m?.numero ?? ''} unida a otras`}
                      className="border-t p-2.5 space-y-2"
                    >
                      <p className="text-sm font-medium">¿Separar mesas o dejarlas unidas?</p>
                      <p className="text-xs text-muted-foreground">
                        Separadas, cada mesa vuelve a su lugar y a su número. Unidas, el siguiente
                        cliente las encuentra juntas.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => decidir('separar')}>
                          Separar mesas
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decidir('mantener')}>
                          Dejarlas unidas
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decidir(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
