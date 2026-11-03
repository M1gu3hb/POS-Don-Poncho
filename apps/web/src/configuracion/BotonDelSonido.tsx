'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Volume2 } from 'lucide-react';
import { useState } from 'react';

import { SonidoDelAparato } from './SonidoDelAparato';

/**
 * EL SONIDO DE ESTE APARATO, A LA MANO DE CUALQUIER PUESTO (DP-13.3).
 *
 * El volumen se guarda en el aparato, no en el negocio, pero sólo se llegaba a él por
 * Configuración → Este aparato, que el mesero, la cocina y la caja no abren. Junto a «Salir» se
 * abre el mismo ajuste en un diálogo: cada quien baja o apaga SU aparato sin pedirle a nadie.
 */
export function BotonDelSonido({ className }: { readonly className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Sonido de este aparato"
        className={className}
        onClick={() => {
          setAbierto(true);
        }}
      >
        <Volume2 aria-hidden />
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sonido de este aparato</DialogTitle>
            <DialogDescription>
              Sólo cambia aquí: los demás aparatos del negocio suenan como estaban.
            </DialogDescription>
          </DialogHeader>
          <SonidoDelAparato />
        </DialogContent>
      </Dialog>
    </>
  );
}
