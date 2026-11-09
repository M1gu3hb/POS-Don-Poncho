import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { claves } from '~/cliente/claves-de-consulta';
import { ordenDeLaZonaNueva, problemaDelNombreDeZona } from '~/cliente/zonas-del-salon';

/**
 * DP-15 · Las zonas del salón: dar de alta una («Terraza») y renombrar las que hay, desde
 * Configuración → Mesas. La regla del nombre (vacío, largo, repetido) vive en `zonas-del-salon.ts`;
 * se escribe por el puente (`Zona`, la escritura genérica de dueño, administrador y gerente).
 * Las mesas guardan la zona por su id: renombrarla cambia el nombre en todas a la vez.
 */
export default function ZonasDelSalonDialog({ open, onOpenChange, zonas, alRenombrar }) {
  const queryClient = useQueryClient();
  const activas = (Array.isArray(zonas) ? zonas : []).filter((z) => z?.activo !== false);
  const [nombres, setNombres] = useState({});
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(null);

  const releer = () => {
    queryClient.invalidateQueries({ queryKey: ['zonas'] });
    queryClient.invalidateQueries({ queryKey: claves.mesas.todas() });
  };

  const renombrar = async (zona) => {
    const nombre = (nombres[zona.id] ?? zona.nombre ?? '').trim().replace(/\s+/g, ' ');
    if (nombre === zona.nombre) return;
    const problema = problemaDelNombreDeZona(nombre, activas, zona.id);
    if (problema) {
      toast.error(problema);
      return;
    }
    setGuardando(zona.id);
    try {
      await api.entidades.Zona.update(zona.id, { nombre });
      toast.success(`La zona ahora se llama «${nombre}»`);
      alRenombrar?.(zona.nombre, nombre);
      releer();
    } catch (error) {
      toast.error(error?.message || 'No se pudo renombrar la zona.');
    } finally {
      setGuardando(null);
    }
  };

  const agregar = async () => {
    const nombre = nueva.trim().replace(/\s+/g, ' ');
    const problema = problemaDelNombreDeZona(nombre, activas, null);
    if (problema) {
      toast.error(problema);
      return;
    }
    setGuardando('nueva');
    try {
      await api.entidades.Zona.create({ nombre, orden: ordenDeLaZonaNueva(activas), activo: true });
      toast.success(`Zona «${nombre}» creada`);
      setNueva('');
      releer();
    } catch (error) {
      toast.error(error?.message || 'No se pudo crear la zona.');
    } finally {
      setGuardando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Zonas del salón</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {activas.map((zona) => (
            <div key={zona.id} className="flex items-center gap-2">
              <Input
                aria-label={`Nombre de la zona ${zona.nombre}`}
                value={nombres[zona.id] ?? zona.nombre ?? ''}
                maxLength={40}
                onChange={(e) => setNombres((prev) => ({ ...prev, [zona.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={guardando !== null}
                onClick={() => renombrar(zona)}
              >
                Guardar
              </Button>
            </div>
          ))}
          {activas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay zonas dadas de alta: las mesas usan las de siempre.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Input
            aria-label="Nombre de la zona nueva"
            placeholder="Zona nueva (p. ej. Terraza)"
            value={nueva}
            maxLength={40}
            onChange={(e) => setNueva(e.target.value)}
          />
          <Button size="sm" disabled={guardando !== null} onClick={agregar}>
            Agregar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
