'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';

import { nombreDeLaEstacion, platillosEnPalabras } from './avisos-de-listo.ts';
import type { GrupoPendiente, PendientesDeLaCuenta } from './pendientes-de-la-cuenta.ts';

/**
 * DP-25 · Parte 2 · EL AVISO DE «A ESTA MESA LE FALTAN PLATILLOS».
 *
 * Se abre cuando el servidor rechaza pedir la cuenta porque hay platillos que no se han
 * entregado (`CUENTA_CON_PENDIENTES`), venga el pedido de la tableta del mesero o del mapa del
 * administrador. Dice, por estación, lo que no se ha preparado y lo que está listo sin entregar,
 * y deja dos salidas: «Regresar» (no cambia nada) o «Pedir la cuenta
 * de todos modos», que reintenta con la confirmación explícita.
 *
 * Grande y legible a un brazo de distancia: el texto del platillo en `text-base`, objetivos de
 * 44 px por los botones del sistema, y el color nunca va solo (cada bloque lleva su palabra).
 */

export interface AvisoDePendientesDeLaCuentaProps {
  readonly pendientes: PendientesDeLaCuenta;
  /** Mientras la cuenta se está pidiendo: los dos botones esperan. */
  readonly pidiendo: boolean;
  readonly alPedirDeTodosModos: () => void;
  readonly alRegresar: () => void;
}

function Estaciones({ grupos }: { readonly grupos: readonly GrupoPendiente[] }) {
  return (
    <ul className="flex flex-col gap-(--espacio-2)">
      {grupos.map((grupo) => (
        <li key={grupo.estacion ?? 'sin-estacion'}>
          <Superficie relleno={3} radio="md" conBorde className="flex flex-col gap-(--espacio-1)">
            <p className="text-base font-semibold">
              {nombreDeLaEstacion({ estacionNombre: grupo.estacion })}
            </p>
            <ul className="flex flex-col gap-(--espacio-1) text-base">
              {grupo.platillos.map((platillo) => (
                <li key={platillo.id}>{platillosEnPalabras([platillo])}</li>
              ))}
            </ul>
          </Superficie>
        </li>
      ))}
    </ul>
  );
}

export function AvisoDePendientesDeLaCuenta({
  pendientes,
  pidiendo,
  alPedirDeTodosModos,
  alRegresar,
}: AvisoDePendientesDeLaCuentaProps) {
  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !pidiendo) alRegresar();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>A esta mesa todavía le faltan platillos</DialogTitle>
          <DialogDescription>
            Revisa antes de pedir la cuenta: si la pides ahora, la mesa pagará con platillos que aún
            no han llegado.
          </DialogDescription>
        </DialogHeader>
        {pendientes.sinPreparar.length === 0 ? null : (
          <Aviso tono="atencion" titulo="Estos platillos no se han preparado:">
            <Estaciones grupos={pendientes.sinPreparar} />
          </Aviso>
        )}
        {pendientes.listos.length === 0 ? null : (
          <Aviso tono="info" titulo="Estos están listos pero no se han entregado:">
            <Estaciones grupos={pendientes.listos} />
          </Aviso>
        )}
        <DialogFooter className="sm:grid sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pidiendo}
            onClick={alRegresar}
          >
            Regresar
          </Button>
          <Button
            type="button"
            size="lg"
            cargando={pidiendo}
            disabled={pidiendo}
            onClick={alPedirDeTodosModos}
          >
            Pedir la cuenta de todos modos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
