'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';

import { SonidoDelAparato } from './SonidoDelAparato';

/**
 * EL SONIDO DE ESTE APARATO, A LA MANO DE CUALQUIER PUESTO (DP-13.3).
 *
 * El volumen se guarda en el aparato, no en el negocio, pero sólo se llegaba a él por
 * Configuración → Este aparato, que el mesero, la cocina y la caja no abren. Junto a «Salir» se
 * abre el mismo ajuste en un diálogo: cada quien baja o apaga SU aparato sin pedirle a nadie.
 *
 * El botón vive en el menú (`heredado/components/common/Sidebar.jsx`), con el mismo tamaño y tono
 * que «Salir». El diálogo se pinta FUERA del menú: en el teléfono el menú es un cajón que tapa
 * todo (`z-[80]`), y tocar el botón lo cierra antes de abrir esto.
 */
export function DialogoDelSonido({
  abierto,
  alCambiar,
}: {
  readonly abierto: boolean;
  readonly alCambiar: (abierto: boolean) => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
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
  );
}
