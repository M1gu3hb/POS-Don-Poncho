import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { claves } from '~/cliente/claves-de-consulta';
import {
  fijarZonaActiva,
  ordenDeLaZonaNueva,
  problemaDelNombreDeZona,
  zonasApagadas,
} from '~/cliente/zonas-del-salon';

/**
 * DP-15 · Las zonas del salón: dar de alta una («Terraza») y renombrar las que hay, desde
 * Configuración → Mesas. La regla del nombre (vacío, largo, repetido) vive en `zonas-del-salon.ts`;
 * se escribe por el puente (`Zona`, la escritura genérica de dueño, administrador y gerente). DP-15.1: desactivar y
 * reactivar una zona va por su comando (`restaurante.fijar_zona_activa`), que cuida las mesas.
 * Las mesas guardan la zona por su id: renombrarla cambia el nombre en todas a la vez.
 */
export default function ZonasDelSalonDialog({ open, onOpenChange, zonas, alRenombrar }) {
  const queryClient = useQueryClient();
  const activas = (Array.isArray(zonas) ? zonas : []).filter((z) => z?.activo !== false);
  const [nombres, setNombres] = useState({});
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(null);

  const apagadas = zonasApagadas(Array.isArray(zonas) ? zonas : []);

  const releer = () => {
    queryClient.invalidateQueries({ queryKey: ['zonas'] });
    // Apagar o encender una zona apaga o enciende sus mesas: se relee el salón entero.
    queryClient.invalidateQueries({ queryKey: claves.mesas.raiz() });
  };

  // DP-15.1 · El servidor decide si se puede (mesas ocupadas, con cuenta o unidas no) y dice por qué.
  const cambiarActiva = async (zona, activa) => {
    setGuardando(zona.id);
    try {
      const r = await fijarZonaActiva(zona.id, activa);
      toast.success(
        activa
          ? `Zona «${zona.nombre}» reactivada (${r.mesasAfectadas} mesas vuelven)`
          : `Zona «${zona.nombre}» desactivada (${r.mesasAfectadas} mesas dejan de mostrarse)`,
      );
      if (r.aviso) toast.warning(r.aviso);
      releer();
    } catch (error) {
      toast.error(
        error?.message || `No se pudo ${activa ? 'reactivar' : 'desactivar'} la zona.`,
      );
    } finally {
      setGuardando(null);
    }
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
      await api.entidades.Zona.create({ nombre, orden: ordenDeLaZonaNueva(activas) });
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
              <Button
                size="sm"
                variant="ghost"
                disabled={guardando !== null}
                onClick={() => cambiarActiva(zona, false)}
              >
                Desactivar
              </Button>
            </div>
          ))}
          {activas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay zonas dadas de alta: las mesas usan las de siempre.
            </p>
          )}
        </div>
        {apagadas.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-muted-foreground">
              Desactivadas (sus mesas no se muestran):
            </p>
            {apagadas.map((zona) => (
              <div key={zona.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{zona.nombre}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={guardando !== null}
                  onClick={() => cambiarActiva(zona, true)}
                >
                  Reactivar
                </Button>
              </div>
            ))}
          </div>
        )}
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
