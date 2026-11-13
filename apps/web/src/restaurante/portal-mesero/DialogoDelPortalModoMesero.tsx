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
      {/* A16: el diálogo es una rejilla y su única columna era «auto»: un renglón más ancho que la
          pantalla (a 360 px) la estiraba y el título, los importes y el botón se salían por la
          derecha. `minmax(0,1fr)` deja que la columna se encoja y el contenido se acomode. */}
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
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
