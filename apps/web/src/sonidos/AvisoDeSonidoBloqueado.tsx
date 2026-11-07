'use client';

import { buttonVariants } from '@morphiqpos/ui/primitivas/button';
import { VolumeX } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { sonidoBloqueado, suscribirAlBloqueo } from './gestor';

/**
 * «SONIDO APAGADO · TOCA PARA ACTIVAR» (DP-13.2). Mientras algo quiso sonar o hablar —la comanda
 * nueva, el aviso de una mesa— y el navegador no lo dejó porque nadie ha tocado la pantalla, un
 * aviso pequeño lo dice. Tocar la pantalla desbloquea (el proveedor escucha cualquier toque o
 * tecla), suena lo pendiente y la voz lo dice. No es el sistema viejo («Activar sonidos» siempre a
 * la vista): sólo aparece cuando de verdad se perdió algo.
 *
 * DP-14.6-8 · Va ARRIBA, no abajo: abajo tapaba la barra del carrito del mesero (el botón de enviar).
 * Y se queda hasta que algo suene: lo quita el gestor al gastar el pendiente con el audio corriendo.
 *
 * Por eso NO es un botón ni se queda con el toque (`pointer-events-none`): arriba hay botones del
 * encabezado («Conectar teléfono» en Cocina, por ejemplo), y en un aparato donde el audio no llega a
 * correr el aviso no se va; si fuera un botón, el que le tocara debajo quedaría tapado para siempre.
 * El toque pasa a lo de abajo y, de paso, desbloquea. Conserva el aspecto del botón de antes.
 *
 * La región viva (`role="status"`) está SIEMPRE montada y el texto entra en ella: un lector de
 * pantalla no anuncia una región que nace ya con su texto (revisión del PR #9).
 */
export function AvisoDeSonidoBloqueado() {
  const bloqueado = useSyncExternalStore(suscribirAlBloqueo, sonidoBloqueado, () => false);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-(--espacio-3) z-50 flex justify-center"
    >
      {bloqueado ? (
        <p
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'gap-(--espacio-2) shadow-2',
          })}
        >
          <VolumeX className="size-4" aria-hidden />
          Sonido apagado · toca para activar
        </p>
      ) : null}
    </div>
  );
}
