'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';

import type { MesaBuscada } from './api-del-carrito-del-mesero';
import { CarritoDelPortalParaElMesero } from './CarritoDelPortalParaElMesero';

/**
 * EL PORTAL DE LA MESA EN MODO MESERO (DP-12.2), en un diálogo: lo abre el QR que el mesero
 * escanea desde «Mesas y pedidos», o el aviso «Pedido listo para confirmar» de una mesa.
 */
export function DialogoDelPortalModoMesero({
  buscada,
  alCerrar,
}: {
  readonly buscada: MesaBuscada | null;
  readonly alCerrar: () => void;
}) {
  return (
    <Dialog
      open={buscada !== null}
      onOpenChange={(abierto) => {
        if (!abierto) alCerrar();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Portal de la mesa · modo mesero</DialogTitle>
          <DialogDescription>
            Lo que armaron los teléfonos de la mesa. Confírmalo y mándalo a cocina a tu nombre.
          </DialogDescription>
        </DialogHeader>
        {buscada === null ? null : (
          <CarritoDelPortalParaElMesero buscada={buscada} alEnviar={alCerrar} />
        )}
      </DialogContent>
    </Dialog>
  );
}
