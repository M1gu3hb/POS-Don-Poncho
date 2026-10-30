'use client';

import { Superficie } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { EsqueletoDelSalon, ErrorDelSalon, VacioDelSalon } from './EstadosDelSalon';
import type { SalonProps } from './PlanoDelSalon';
import { TeselaDeMesa } from './TeselaDeMesa';
import type { MesaDelSalon } from './tipos-del-salon';

/** Por número de orden y, a igualdad, por número de mesa: como las ordenaba la rejilla de siempre. */
function enOrden(mesas: readonly MesaDelSalon[]): readonly MesaDelSalon[] {
  return [...mesas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.numero - b.numero);
}

/**
 * LA REJILLA DE MESAS (teléfono): tarjetas de dos en dos, sin posición. Es el mismo salón que el
 * plano, con las mismas mesas memoizadas; cambia la forma de cada una.
 */
export function RejillaDeMesas({
  mesas,
  oscuro,
  mesaActivaId,
  cargando,
  sinLeer,
  responsableDe,
  solicitudesDeCadaMesa,
  alTocar,
  alAtender,
  alReintentar,
}: Omit<SalonProps, 'zona' | 'sinMesasAsignadas'>): ReactElement {
  const hayMesas = mesas.length > 0;
  return (
    <Superficie nivel={0} relleno={3} radio="lg" className="border-2 bg-fondo-sutil">
      {hayMesas ? (
        <div className="grid grid-cols-2 gap-(--espacio-3) sm:grid-cols-3">
          {enOrden(mesas).map((mesa) => {
            const responsable = responsableDe(mesa);
            return (
              <TeselaDeMesa
                key={mesa.id}
                forma="rejilla"
                mesa={mesa}
                oscuro={oscuro}
                activa={mesaActivaId === mesa.id}
                responsableNombre={responsable?.nombre ?? ''}
                responsableColor={responsable?.color ?? null}
                solicitudes={solicitudesDeCadaMesa.get(mesa.id)}
                lugarDeLosGlobos="arriba"
                alTocar={alTocar}
                alAtender={alAtender}
              />
            );
          })}
        </div>
      ) : sinLeer ? (
        <ErrorDelSalon alReintentar={alReintentar} />
      ) : cargando ? (
        <EsqueletoDelSalon />
      ) : (
        <VacioDelSalon zona={null} conAyuda={false} />
      )}
    </Superficie>
  );
}
