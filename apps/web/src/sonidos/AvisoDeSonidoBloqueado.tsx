'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { VolumeX } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { desbloquearSonidos, sonidoBloqueado, suscribirAlBloqueo } from './gestor';

/**
 * «SONIDO APAGADO · TOCA PARA ACTIVAR» (DP-13.2). Mientras algo quiso sonar o hablar —la comanda
 * nueva, el aviso de una mesa— y el navegador no lo dejó porque nadie ha tocado la pantalla, un
 * botón pequeño lo dice. Tocarlo (o tocar cualquier cosa) desbloquea, suena lo pendiente y la
 * voz lo dice. No es el sistema viejo («Activar sonidos» siempre a la vista): sólo aparece cuando
 * de verdad se perdió algo.
 */
export function AvisoDeSonidoBloqueado() {
  const bloqueado = useSyncExternalStore(suscribirAlBloqueo, sonidoBloqueado, () => false);
  if (!bloqueado) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-(--espacio-4) z-50 flex justify-center">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="pointer-events-auto gap-(--espacio-2) shadow-2"
        aria-live="polite"
        onClick={() => {
          desbloquearSonidos();
        }}
      >
        <VolumeX className="size-4" aria-hidden />
        Sonido apagado · toca para activar
      </Button>
    </div>
  );
}
