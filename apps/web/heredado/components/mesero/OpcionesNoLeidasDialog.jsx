'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * DP-14.1-4 · La lectura de las opciones de un platillo que SÍ las tiene falló o venció (8 s).
 *
 * No bloquea lo demás: el mesero cierra esto y sigue agregando lo que no pide opciones y enviando.
 *
 * Props:
 *  - lectura: { producto, estado: 'leyendo' | 'fallo' } | null
 *  - onReintentar(): vuelve a leer y agrega el platillo si llega
 *  - onCerrar(): cerrar sin agregar
 */
export default function OpcionesNoLeidasDialog({ lectura, onReintentar, onCerrar }) {
  const leyendo = lectura?.estado === 'leyendo';
  const nombre = lectura?.producto?.nombre || 'el platillo';
  return (
    <Dialog open={!!lectura} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-sm" data-testid="opciones-no-leidas">
        <DialogHeader>
          <DialogTitle>{leyendo ? 'Leyendo las opciones…' : 'No se pudieron leer las opciones'}</DialogTitle>
          <DialogDescription>
            {leyendo
              ? `Un momento: se leen las opciones de ${nombre}.`
              : `No se pudieron leer las opciones de ${nombre}, y sin ellas no se agrega. Lo demás sigue funcionando.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button onClick={onReintentar} disabled={leyendo}>
            Reintentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
