import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { DoorOpen, Landmark, Lock, Scissors } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * LA CABECERA DE LA CAJA · el título, cómo va el día y las tres acciones de la caja.
 *
 * «Abrir caja», «Corte de turno» y «Cierre diario» son lo único que la cabecera puede hacer, y
 * en el teléfono se acortan a «Abrir», «Turno» y «Cierre» para caber las tres en una fila. El
 * rótulo largo y el corto son dos `span` y uno se esconde: el nombre accesible es el que se ve,
 * que es el que buscan las pruebas de navegador en cada tamaño.
 *
 * Sólo hay UN acento a la vez: «Abrir caja» cuando la caja se puede abrir. Cerrar el día es una
 * acción seria, no la más llamativa de la pantalla: pide su confirmación en otro diálogo.
 */

export interface CabeceraDeCajaProps {
  readonly hayCaja: boolean;
  /** Sin sala (no hay módulo de mesas) no hay cobros pendientes que contar. */
  readonly esCajaDirecta: boolean;
  readonly cobrosPendientes: number;
  /** La caja todavía no dijo si hay una abierta: «Abrir caja» no se puede pulsar aún. */
  readonly cargandoCaja: boolean;
  readonly puedoAbrir: boolean;
  /** Se está comprobando que no queden mesas abiertas antes del cierre. */
  readonly verificandoMesas: boolean;
  readonly alAbrirCaja: () => void;
  readonly alCorteDeTurno: () => void;
  readonly alCierreDiario: () => void;
}

function cuentaDelDia(hayCaja: boolean, esCajaDirecta: boolean, pendientes: number): string {
  if (!hayCaja) return 'Caja cerrada';
  return esCajaDirecta ? 'Punto de venta directo' : `${String(pendientes)} cobros pendientes`;
}

export function CabeceraDeCaja({
  hayCaja,
  esCajaDirecta,
  cobrosPendientes,
  cargandoCaja,
  puedoAbrir,
  verificandoMesas,
  alAbrirCaja,
  alCorteDeTurno,
  alCierreDiario,
}: CabeceraDeCajaProps): ReactElement {
  const sePuedeAbrir = !hayCaja && !cargandoCaja && puedoAbrir;

  return (
    <div className="flex flex-col gap-(--espacio-3) sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-(--espacio-3)">
        <Superficie radio="md" relleno={3} className="shrink-0">
          <Landmark aria-hidden className="size-5" />
        </Superficie>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Caja</h1>
          <p className="truncate text-xs text-texto-sutil">
            {cuentaDelDia(hayCaja, esCajaDirecta, cobrosPendientes)}
          </p>
        </div>
      </div>

      {/* Las tres acciones: una fila de tres en el teléfono, para que se vean enteras. */}
      <div className="grid w-full grid-cols-3 gap-(--espacio-2) sm:flex sm:w-auto">
        <Button
          size="sm"
          variant={sePuedeAbrir ? 'default' : 'outline'}
          disabled={!sePuedeAbrir}
          title={
            hayCaja || !puedoAbrir
              ? 'Ya hay una caja abierta'
              : 'Abrir caja para comenzar operación'
          }
          className="px-(--espacio-2)"
          onClick={alAbrirCaja}
        >
          <DoorOpen aria-hidden />
          <span className="hidden sm:inline">Abrir caja</span>
          <span className="sm:hidden">Abrir</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!hayCaja}
          title={hayCaja ? 'Corte parcial de turno' : 'Necesitas una caja abierta'}
          className="px-(--espacio-2)"
          onClick={alCorteDeTurno}
        >
          <Scissors aria-hidden />
          <span className="hidden sm:inline">Corte de turno</span>
          <span className="sm:hidden">Turno</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!hayCaja || verificandoMesas}
          title={hayCaja ? 'Cierre final del día' : 'Necesitas una caja abierta'}
          className="px-(--espacio-2)"
          onClick={alCierreDiario}
        >
          <Lock aria-hidden />
          <span className="hidden sm:inline">
            {verificandoMesas ? 'Verificando…' : 'Cierre diario'}
          </span>
          <span className="sm:hidden">{verificandoMesas ? '…' : 'Cierre'}</span>
        </Button>
      </div>
    </div>
  );
}
