'use client';

/**
 * PANTALLA · componente · configuración · ver el PIN de una persona (el ojito del dueño)
 *
 * DP-25 · Parte 7. Al personal se le olvida el PIN y cambiarlo a cada rato es un problema: en
 * Configuración → Personas el DUEÑO ve el PIN de cada quien con un ojito.
 *
 *   · Pide SU propio PIN para confirmar (la firma `para: 'ver_pin'`, de un solo uso).
 *   · El PIN se ve 10 segundos y se oculta solo.
 *   · Cada vista queda en la auditoría del servidor (quién vio el de quién y cuándo).
 *   · El PIN de antes no tiene copia: «No disponible: asígnalo de nuevo una vez», con el botón para
 *     asignarlo ahí mismo.
 *
 * La pantalla sólo enseña el ojito al dueño y con la función encendida; el servidor lo rechaza para
 * cualquier otro puesto aunque alguien mande el comando a mano.
 */

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { invocarComando } from '~/cliente/api';
import { PinDeSupervisor, type Autorizada, type QuienAutoriza } from '~/venta/PinDeSupervisor';

/** Cuánto se queda el PIN a la vista. */
export const SEGUNDOS_A_LA_VISTA = 10;

type PinVisto =
  | { readonly disponible: true; readonly pin: string }
  | { readonly disponible: false; readonly motivo: 'sin_copia' | 'apagada' };

export interface VerElPinProps {
  readonly empleado: { readonly id: string; readonly nombre: string };
  /** Si hay copia de su PIN; sin ella, «No disponible» sin pedir el PIN de nadie. */
  readonly conCopia: boolean;
  /** El dueño mismo: es quien teclea su PIN. */
  readonly yo: QuienAutoriza;
  /** Abre la edición de esa persona para asignarle el PIN otra vez. */
  readonly alAsignar: () => void;
}

export function VerElPin({ empleado, conCopia, yo, alAsignar }: VerElPinProps) {
  const [abierto, setAbierto] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [restan, setRestan] = useState(0);
  const [sinCopia, setSinCopia] = useState(!conCopia);
  const [error, setError] = useState<string | null>(null);

  // El PIN se oculta solo: cuenta atrás de un segundo en un segundo y, en cero, se cierra.
  useEffect(() => {
    if (pin === null) return undefined;
    if (restan <= 0) {
      setPin(null);
      setAbierto(false);
      return undefined;
    }
    const reloj = setTimeout(() => setRestan((r) => r - 1), 1000);
    return () => clearTimeout(reloj);
  }, [pin, restan]);

  const cerrar = () => {
    setPin(null);
    setRestan(0);
    setError(null);
    setAbierto(false);
  };

  const ver = async (autorizada: Autorizada) => {
    setError(null);
    try {
      const visto = await invocarComando<PinVisto>('/api/identidad/ver-pin', {
        empleado: empleado.id,
        autorizacion: autorizada.token,
      });
      if (visto.disponible) {
        setPin(visto.pin);
        setRestan(SEGUNDOS_A_LA_VISTA);
      } else {
        setSinCopia(true);
      }
    } catch (fallo: unknown) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo ver el PIN.');
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="any-pointer-coarse:min-h-(--altura-tactil) any-pointer-coarse:min-w-(--altura-tactil)"
        aria-label={`Ver el PIN de ${empleado.nombre}`}
        data-ver-pin={empleado.id}
        onClick={() => {
          setSinCopia(!conCopia);
          setAbierto(true);
        }}
      >
        <Eye aria-hidden className="size-4" />
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>El PIN de {empleado.nombre}</DialogTitle>
            <DialogDescription>
              Sólo el dueño lo ve, con su propio PIN. Queda anotado.
            </DialogDescription>
          </DialogHeader>
          {pin !== null ? (
            <div className="space-y-(--espacio-2) text-center" data-pin-a-la-vista>
              <p className="font-mono text-display font-bold tracking-[0.3em]" aria-live="polite">
                {pin}
              </p>
              <p className="text-sm text-texto-sutil">Se oculta en {restan} s.</p>
              <Button type="button" variant="outline" onClick={cerrar}>
                Ocultar ya
              </Button>
            </div>
          ) : sinCopia ? (
            <Aviso
              tono="atencion"
              titulo="No disponible: asígnalo de nuevo una vez."
              accion={
                <Button
                  type="button"
                  onClick={() => {
                    cerrar();
                    alAsignar();
                  }}
                >
                  Asignar PIN
                </Button>
              }
            >
              Este PIN se puso antes de que se guardara su copia. Asígnalo una vez más y desde
              entonces se podrá ver aquí.
            </Aviso>
          ) : (
            <div className="space-y-(--espacio-2)">
              <p className="text-sm">Teclea tu PIN para verlo.</p>
              <PinDeSupervisor
                para="ver_pin"
                quienesAutorizan={[yo]}
                idDelCampo={`ver-pin-${empleado.id}`}
                alAutorizar={(autorizada) => {
                  void ver(autorizada);
                }}
              />
            </div>
          )}
          {error !== null && <Aviso tono="peligro" titulo={error} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VerElPin;
