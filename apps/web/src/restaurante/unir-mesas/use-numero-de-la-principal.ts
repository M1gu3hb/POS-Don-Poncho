'use client';

import { useEffect, useState } from 'react';

import { consultarPuente } from '~/cliente/api';

/**
 * DP-25 · P6 — EL NÚMERO DE LA PRINCIPAL de una mesa que ya está unida a otra, para decir «unida a
 * la 3» y «Ir a la 3». `null` mientras se lee, o si no se pudo: la pantalla dice entonces «la
 * principal del grupo» y el botón sigue llevando a ella.
 */
export function useNumeroDeLaPrincipal(principalId: string | null): number | null {
  const [leido, setLeido] = useState<{ readonly id: string; readonly numero: number } | null>(null);
  useEffect(() => {
    if (principalId === null) return undefined;
    const control = new AbortController();
    consultarPuente<{ numero?: number }>('Mesa', {
      filtro: { id: principalId },
      limite: 1,
      signal: control.signal,
    })
      .then((filas) => {
        const numero = filas[0]?.numero;
        if (!control.signal.aborted && typeof numero === 'number') {
          setLeido({ id: principalId, numero });
        }
      })
      .catch(() => {
        // Sin el número se dice «la principal del grupo».
      });
    return () => {
      control.abort();
    };
  }, [principalId]);
  return leido?.id === principalId ? leido.numero : null;
}
