'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { puenteDeLaApp, type Ajustes, type MorphiqApp } from './puente/contrato.ts';
import { leerPerfil, type PerfilDeImpresion } from './termico/perfil.ts';
import { perfilParaLaApp } from './termico/perfil-para-la-app.ts';

/**
 * ¿ESTA PÁGINA CORRE DENTRO DE LA APP? (DP-20 · Parte 2)
 *
 * Si `window.MorphiqApp` existe, se imprime directo y se abre el cajón; si no (navegador o PWA),
 * todo sigue con el diálogo del navegador. En Android el puente puede llegar un instante después
 * de la página: se vuelve a mirar un par de veces.
 */

const REVISAR_A_LOS_MS = [300, 1200, 4000];

function suscribir(avisar: () => void): () => void {
  const relojes = REVISAR_A_LOS_MS.map((ms) => setTimeout(avisar, ms));
  return () => {
    for (const reloj of relojes) clearTimeout(reloj);
  };
}

const enElNavegador = (): MorphiqApp | null => puenteDeLaApp(window);
const enElServidor = (): MorphiqApp | null => null;

export function useApp(): MorphiqApp | null {
  return useSyncExternalStore(suscribir, enElNavegador, enElServidor);
}

export const CLAVE_DE_LOS_AJUSTES = ['app', 'ajustes'] as const;

export interface PerfilDelAparato {
  readonly app: MorphiqApp | null;
  /** `undefined` mientras se lee; `null` si este aparato no tiene impresora configurada. */
  readonly perfil: PerfilDeImpresion | null | undefined;
  readonly ajustes: Ajustes | undefined;
  /** Guarda el perfil EN EL APARATO, con el pulso del cajón ya armado para la app. */
  guardarPerfil(perfil: PerfilDeImpresion | null): Promise<void>;
}

export function usePerfilDelAparato(): PerfilDelAparato {
  const app = useApp();
  const consultas = useQueryClient();
  const consulta = useQuery({
    queryKey: CLAVE_DE_LOS_AJUSTES,
    queryFn: async () => (app === null ? null : app.ajustes()),
    enabled: app !== null,
    staleTime: Infinity,
  });

  const guardarPerfil = useCallback(
    async (perfil: PerfilDeImpresion | null): Promise<void> => {
      if (app === null) throw new Error('Esto sólo se puede guardar dentro de la app.');
      const guardados = await app.guardarAjustes({ perfil: perfilParaLaApp(perfil) });
      consultas.setQueryData(CLAVE_DE_LOS_AJUSTES, guardados);
    },
    [app, consultas],
  );

  const ajustes = consulta.data ?? undefined;
  const perfil =
    app === null ? null : ajustes === undefined ? undefined : leerPerfil(ajustes.perfil);
  return { app, perfil, ajustes, guardarPerfil };
}
