'use client';

import type { ReactElement } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@morphiqpos/ui/primitivas/alert-dialog';

import { textoDelAviso, type PropinaDeOtraPantalla } from './propina-en-la-caja';

/**
 * «LOS COMENSALES ELIGIERON 10 % DE PROPINA ($52.00)» (DP-21 · Bloque 4 · M11).
 *
 * Un aviso que INTERRUMPE a quien cobra, no un toast: mientras la Caja tenía el cobro abierto,
 * otra pantalla decidió la propina. Dos salidas y ninguna en silencio:
 *
 *   · «Usar ésa», la principal: la propina de la otra pantalla pasa a ser la del cobro;
 *   · «Cambiarla»: la Caja elige otra a propósito, y queda en la auditoría como un cambio suyo.
 *
 * No se cierra tocando fuera ni con Escape: hay que decidir.
 */
export function AvisoDePropina({
  aviso,
  alUsarEsa,
  alCambiarla,
}: {
  readonly aviso: PropinaDeOtraPantalla | null;
  readonly alUsarEsa: () => void;
  readonly alCambiarla: () => void;
}): ReactElement {
  return (
    <AlertDialog open={aviso !== null}>
      <AlertDialogContent
        data-aviso-de-propina
        onEscapeKeyDown={(evento) => {
          evento.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{aviso === null ? '' : textoDelAviso(aviso)}</AlertDialogTitle>
          <AlertDialogDescription>
            La eligieron mientras tenías el cobro abierto. Si la usas, el cobro sale con esa
            propina. Si la cambias, queda registrado que la cambió la caja.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={alCambiarla}>Cambiarla</AlertDialogCancel>
          <AlertDialogAction onClick={alUsarEsa}>Usar ésa</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
