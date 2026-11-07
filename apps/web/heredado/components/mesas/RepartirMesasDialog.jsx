'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { ROLES } from '@/lib/constants';
import { claves } from '~/cliente/claves-de-consulta';

/**
 * «Repartir mesas» (DP-14, ronda 2): asigna varias mesas a un mesero de una vez.
 *
 * Es lo mismo que el editor de una mesa (su mesero asignado) pero para varias, en UNA transacción
 * del servidor (`restaurante.repartir_mesas`): o quedan todas con su mesero o no cambia ninguna, y
 * la auditoría dice quién repartió qué. «Sin asignar» las suelta: las ve todo el salón.
 */

const SIN_ASIGNAR = '__sin_asignar__';

export default function RepartirMesasDialog({ open, mesas, asignacionActiva, onClose }) {
  const queryClient = useQueryClient();
  const [mesero, setMesero] = useState(null);
  const [elegidas, setElegidas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Sólo meseros ACTIVOS: la lectura no filtra por puesto, así que se filtra aquí.
  const { data: usuarios = [] } = useQuery({
    queryKey: claves.usuarios.meseros(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true, rol: ROLES.WAITER }),
    initialData: [],
    enabled: open,
  });
  const meseros = (Array.isArray(usuarios) ? usuarios : []).filter((u) => u?.rol === ROLES.WAITER);
  const lista = Array.isArray(mesas) ? mesas : [];

  useEffect(() => {
    if (open) {
      setMesero(null);
      setElegidas([]);
    }
  }, [open]);

  const alternar = (id) =>
    setElegidas((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    );

  const sinAsignar = lista.filter((m) => !m.mesero_asignado_id).map((m) => m.id);
  const nombreDelMesero =
    mesero === SIN_ASIGNAR ? 'sin asignar' : meseros.find((u) => u.id === mesero)?.nombre || '';

  const repartir = async () => {
    if (guardando || mesero === null || elegidas.length === 0) return;
    setGuardando(true);
    try {
      await api.comandos.ejecutar('/api/restaurante/repartir-mesas', {
        mesero: mesero === SIN_ASIGNAR ? null : mesero,
        mesaIds: elegidas,
      });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      toast.success(
        mesero === SIN_ASIGNAR
          ? `${elegidas.length} mesa(s) quedaron sin asignar`
          : `${elegidas.length} mesa(s) para ${nombreDelMesero}`,
      );
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'No se pudieron repartir las mesas');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !guardando && onClose?.()}>
      <DialogContent className="sm:max-w-md w-[calc(100%-1.5rem)] max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Repartir mesas
          </DialogTitle>
          <DialogDescription>
            Elige al mesero y marca las mesas que le tocan. Una mesa sin asignar la ven todos los
            meseros.
          </DialogDescription>
        </DialogHeader>

        {!asignacionActiva && (
          <p className="text-xs rounded-md border border-advertencia/30 bg-advertencia/10 text-advertencia px-2 py-1.5">
            La asignación de mesas está apagada (Configuración → Operación): se guardan, pero
            mientras siga apagada todos los meseros ven todas las mesas.
          </p>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium mb-2">1 · Mesero</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mesero">
              {meseros.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={mesero === u.id}
                  onClick={() => setMesero(u.id)}
                  className={`min-h-11 px-3 rounded-full border text-sm ${mesero === u.id ? 'bg-primary text-primario-texto border-primary' : 'bg-superficie'}`}
                >
                  <span
                    aria-hidden
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ background: u.color || '#94a3b8' }}
                  />
                  {u.nombre}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={mesero === SIN_ASIGNAR}
                onClick={() => setMesero(SIN_ASIGNAR)}
                className={`min-h-11 px-3 rounded-full border text-sm ${mesero === SIN_ASIGNAR ? 'bg-primary text-primario-texto border-primary' : 'bg-superficie'}`}
              >
                Sin asignar
              </button>
            </div>
            {meseros.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No hay meseros activos. Da de alta uno en Usuarios POS.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium">2 · Mesas ({elegidas.length} elegidas)</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setElegidas(sinAsignar)}
                >
                  Las sin asignar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setElegidas([])}
                >
                  Ninguna
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {lista.map((m) => {
                const marcada = elegidas.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    aria-label={`Mesa ${m.numero}`}
                    onClick={() => alternar(m.id)}
                    className={`min-h-12 rounded-lg border p-2 text-left ${marcada ? 'border-primary bg-primary/10' : 'bg-superficie'}`}
                  >
                    <span className="block text-sm font-semibold">Mesa {m.numero}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {m.mesero_asignado_nombre || 'Sin asignar'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={repartir}
            disabled={guardando || mesero === null || elegidas.length === 0}
          >
            {guardando ? 'Repartiendo…' : 'Repartir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
