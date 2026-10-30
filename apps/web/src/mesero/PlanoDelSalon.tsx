'use client';

import { Superficie } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { EsqueletoDelSalon, ErrorDelSalon, VacioDelSalon } from './EstadosDelSalon';
import { TeselaDeMesa } from './TeselaDeMesa';
import type { MesaDelSalon, ResponsableDeLaMesa, SolicitudPendiente } from './tipos-del-salon';

/** El alto del lienzo del plano: las mesas se colocan en píxeles dentro de él. */
const ALTO_DEL_PLANO = 600;
/** Una mesa pegada al borde de arriba recortaría la pila de globos: va debajo. */
const POSICION_DONDE_LOS_GLOBOS_VAN_ABAJO = 80;
const POSICION_DE_RESPALDO = 100;

export interface SalonProps {
  readonly mesas: readonly MesaDelSalon[];
  readonly zona: string;
  readonly oscuro: boolean;
  /** La mesa abierta en el diálogo, si hay una. */
  readonly mesaActivaId: string | null;
  readonly cargando: boolean;
  readonly sinLeer: boolean;
  /** Un mesero con la asignación encendida y ninguna mesa suya: el aviso de arriba ya lo dice. */
  readonly sinMesasAsignadas: boolean;
  readonly responsableDe: (mesa: MesaDelSalon) => ResponsableDeLaMesa | null;
  readonly solicitudesDeCadaMesa: ReadonlyMap<string, readonly SolicitudPendiente[]>;
  readonly alTocar: (mesa: MesaDelSalon) => void;
  readonly alAtender: () => void;
  readonly alReintentar: () => void;
}

/**
 * EL PLANO DEL SALÓN (PC y tableta): las mesas en su lugar real sobre un suelo SÓLIDO.
 *
 * El suelo era una madera con puntos, sombras interiores y un degradado por estilo; ahora es una
 * superficie plana del sistema, y el relieve lo ponen las mesas. Cada mesa es una `TeselaDeMesa`
 * memoizada: lo que cambia entre dibujos es la mesa abierta y las que cambiaron de estado.
 */
export function PlanoDelSalon({
  mesas,
  zona,
  oscuro,
  mesaActivaId,
  cargando,
  sinLeer,
  sinMesasAsignadas,
  responsableDe,
  solicitudesDeCadaMesa,
  alTocar,
  alAtender,
  alReintentar,
}: SalonProps): ReactElement {
  const hayMesas = mesas.length > 0;
  return (
    <Superficie
      nivel={0}
      relleno={0}
      radio="lg"
      className="relative overflow-hidden border-2 bg-fondo-sutil"
      style={{ height: ALTO_DEL_PLANO }}
    >
      {mesas.map((mesa) => {
        const responsable = responsableDe(mesa);
        return (
          <TeselaDeMesa
            key={mesa.id}
            forma="plano"
            mesa={mesa}
            oscuro={oscuro}
            activa={mesaActivaId === mesa.id}
            responsableNombre={responsable?.nombre ?? ''}
            responsableColor={responsable?.color ?? null}
            solicitudes={solicitudesDeCadaMesa.get(mesa.id)}
            lugarDeLosGlobos={
              (mesa.posicion_y ?? POSICION_DE_RESPALDO) < POSICION_DONDE_LOS_GLOBOS_VAN_ABAJO
                ? 'abajo'
                : 'arriba'
            }
            alTocar={alTocar}
            alAtender={alAtender}
          />
        );
      })}
      {!hayMesas && sinLeer ? <ErrorDelSalon alReintentar={alReintentar} /> : null}
      {!hayMesas && !sinLeer && cargando ? <EsqueletoDelSalon /> : null}
      {!hayMesas && !sinLeer && !cargando && !sinMesasAsignadas ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <VacioDelSalon zona={zona} conAyuda />
        </div>
      ) : null}
    </Superficie>
  );
}
