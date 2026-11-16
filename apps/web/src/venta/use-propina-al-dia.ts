'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  alUsarEsa,
  propinaDeOtraPantalla,
  type PropinaALaVista,
  type PropinaDeOtraPantalla,
} from './propina-en-la-caja';

/**
 * LA PROPINA DE LA CUENTA QUE SE ESTÁ COBRANDO, AL DÍA (DP-21 · Bloque 4 · O8).
 *
 * Mientras la Caja tiene un cobro abierto, relee esa cuenta cada dos segundos y medio. Si la
 * propina la decidió otra pantalla (los comensales en el portal, el mesero), entrega un aviso
 * para interrumpir a quien cobra; si sólo cambió la versión, la actualiza sin molestar. Lo que
 * se decide con lo leído vive en `propina-en-la-caja.ts`, que es puro y tiene sus pruebas.
 */

const CADA_MS = 2_500;

interface CuentaEnCobro extends PropinaALaVista {
  readonly id?: string | null | undefined;
}

/** El aviso, con la cuenta a la que pertenece: el de una cuenta no se le enseña a otra. */
interface AvisoDeUnaCuenta {
  readonly ordenId: string;
  readonly propina: PropinaDeOtraPantalla;
}

function firma(ordenId: string, propina: PropinaDeOtraPantalla): string {
  return [ordenId, propina.origen, propina.tipo, propina.porcentaje, propina.version].join('|');
}

export function usePropinaAlDia(opciones: {
  /** La cuenta abierta en el cobro; `null` si no hay ninguna. */
  readonly cuenta: CuentaEnCobro | null | undefined;
  /** `true` mientras se cobra o se elige la propina: no se relee encima. */
  readonly pausada: boolean;
  readonly leer: (ordenId: string) => Promise<CuentaEnCobro | null | undefined>;
  /** Mezcla el parche en la cuenta que la Caja tiene a la vista. */
  readonly alCambiar: (parche: Readonly<Record<string, unknown>>) => void;
}): {
  readonly aviso: PropinaDeOtraPantalla | null;
  /** «Usar ésa»: la propina de la otra pantalla pasa a ser la del cobro. */
  readonly usarEsa: () => void;
  /** «Cambiarla»: se quita el aviso y no vuelve a salir por esa misma propina. */
  readonly cambiarla: () => void;
  /** Para enseñar la vigente que devolvió un 409 del servidor. */
  readonly avisar: (propina: PropinaDeOtraPantalla) => void;
} {
  const { cuenta, pausada, leer, alCambiar } = opciones;
  const [guardado, setGuardado] = useState<AvisoDeUnaCuenta | null>(null);
  const ordenId = cuenta?.id ?? null;
  // El aviso de otra cuenta no cuenta: al cambiar de cuenta deja de verse sin tocar el estado.
  const aviso = guardado !== null && guardado.ordenId === ordenId ? guardado.propina : null;

  // Lo último, sin que cada render reinicie el reloj. `descartada` es la firma (con su cuenta)
  // del aviso que la Caja quitó con «Cambiarla».
  const vivo = useRef({ cuenta, leer, alCambiar, descartada: '' });
  useEffect(() => {
    vivo.current = { ...vivo.current, cuenta, leer, alCambiar };
  });

  const hayAviso = aviso !== null;
  useEffect(() => {
    if (ordenId === null || pausada || hayAviso) return undefined;
    let vigente = true;
    const releer = async (): Promise<void> => {
      let releida: CuentaEnCobro | null | undefined;
      try {
        releida = await vivo.current.leer(ordenId);
      } catch {
        // Sin red no hay nada nuevo que enseñar: el siguiente intento vuelve a leer, y el cobro
        // sigue protegido por el servidor, que rechaza una cuenta que cambió.
        return;
      }
      if (!vigente || releida === null || releida === undefined) return;
      const aLaVista = vivo.current.cuenta;
      const otra = propinaDeOtraPantalla(aLaVista, releida);
      if (otra !== null) {
        if (firma(ordenId, otra) !== vivo.current.descartada) {
          setGuardado({ ordenId, propina: otra });
        }
        return;
      }
      if (typeof releida.version === 'number' && releida.version !== aLaVista?.version) {
        vivo.current.alCambiar({ version: releida.version });
      }
    };
    const reloj = window.setInterval(() => {
      void releer();
    }, CADA_MS);
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, [ordenId, pausada, hayAviso]);

  const usarEsa = useCallback(() => {
    if (aviso === null) return;
    vivo.current.alCambiar(alUsarEsa(aviso));
    setGuardado(null);
  }, [aviso]);

  const cambiarla = useCallback(() => {
    if (aviso === null || ordenId === null) return;
    vivo.current.descartada = firma(ordenId, aviso);
    // La Caja va a escribir sobre ESA versión: la toma para que el servidor la acepte.
    if (aviso.version !== null) vivo.current.alCambiar({ version: aviso.version });
    setGuardado(null);
  }, [aviso, ordenId]);

  const avisar = useCallback(
    (propina: PropinaDeOtraPantalla) => {
      if (ordenId !== null) setGuardado({ ordenId, propina });
    },
    [ordenId],
  );

  return { aviso, usarEsa, cambiarla, avisar };
}
