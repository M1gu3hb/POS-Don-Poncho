'use client';

import { useEffect, useState } from 'react';

import { inicioDelDiaDelNegocio, msHastaElSiguienteDia } from './dia-del-negocio.ts';

/**
 * DP-15.1 · El inicio del día del negocio, vivo: se recalcula solo al pasar la medianoche de CDMX
 * y al volver a la pantalla (`visibilitychange`; un aparato dormido no dispara el temporizador a
 * tiempo). Sin recargar. Si el día no cambió, el valor es el mismo y React no vuelve a pintar.
 */

/** Un respiro después de la medianoche para no despertar un instante antes del cambio. */
const HOLGURA_MS = 1000;

export function useInicioDelDia(): number {
  const [inicio, setInicio] = useState(() => inicioDelDiaDelNegocio(new Date()));

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const recalcular = (): void => {
      const ahora = new Date();
      setInicio(inicioDelDiaDelNegocio(ahora));
      clearTimeout(temporizador);
      temporizador = setTimeout(recalcular, msHastaElSiguienteDia(ahora) + HOLGURA_MS);
    };
    const alVolver = (): void => {
      if (document.visibilityState === 'visible') recalcular();
    };
    recalcular();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return inicio;
}
