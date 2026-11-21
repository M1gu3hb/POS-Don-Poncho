'use client';

import { useEffect, useState, type ReactElement } from 'react';

import { AnularLineaDialog } from '~/restaurante/AnularLineaDialog';
import { loQueYaSalio } from '~/restaurante/cancelar-del-mesero-lecturas';

/**
 * QUITAR UN PLATILLO DESDE LA TARJETA DE COBRO (DP-24 · «la Caja manda»).
 *
 * Quitar lo que ya se mandó a cocina es de la Caja y de la gerencia; el mesero ya no puede. Aquí la
 * cajera toca el bote de basura del renglón y sale el MISMO diálogo de siempre (`AnularLineaDialog`):
 * el motivo es obligatorio, la cajera teclea el PIN de un gerente, administrador o dueño, y la
 * gerencia no teclea nada. El servidor es quien decide (`restaurante.anular_linea`).
 *
 * Antes de abrirlo se lee la cocina: si el platillo ya salió, el diálogo lo dice ANTES de quitarlo
 * (queda como pérdida en el corte). Si la cocina no se puede leer, cuenta como ya preparado: es lo
 * prudente, y es lo que el servidor va a asumir.
 */
export function QuitarDeLaCuenta({
  ordenId,
  lineaId,
  nombre,
  alCerrar,
  alQuitar,
}: {
  readonly ordenId: string;
  readonly lineaId: string;
  readonly nombre: string;
  readonly alCerrar: () => void;
  readonly alQuitar: () => void;
}): ReactElement | null {
  const [yaSalieron, setYaSalieron] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let vigente = true;
    loQueYaSalio(ordenId).then(
      (nombres) => {
        if (vigente) setYaSalieron(nombres);
      },
      () => {
        if (vigente) setYaSalieron(new Set([nombre]));
      },
    );
    return () => {
      vigente = false;
    };
  }, [ordenId, nombre]);

  if (yaSalieron === null) return null;
  return (
    <AnularLineaDialog
      abierto
      ordenId={ordenId}
      lineaId={lineaId}
      nombreDelPlatillo={nombre}
      yaSePreparo={yaSalieron.has(nombre)}
      onCerrar={alCerrar}
      onAnulada={alQuitar}
    />
  );
}
