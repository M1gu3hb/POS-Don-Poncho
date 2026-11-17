'use client';

import { useCallback } from 'react';

import { useApp } from '../../impresion/use-app.ts';
import type { ArchivosDeCortes } from '../../impresion/puente/contrato.ts';

import {
  abrirLaCarpetaDeCortes,
  archivosDeLaApp,
  type SalidaDeAbrir,
} from './archivos-de-la-app.ts';

/** Lo que las pantallas dicen de la carpeta de cortes (DP-D153). Una sola fuente para que no se desfasen. */
export const CARPETA_DE_CORTES_TEXTO = 'Documentos\\POS Don Poncho\\Cortes';
export const AYUDA_DE_LA_CARPETA = `Los PDF de los cortes se guardan en ${CARPETA_DE_CORTES_TEXTO}, una carpeta por mes.`;

export interface CarpetaDeCortes {
  /** `null` en un navegador y con la app 1.0.1: ahí no hay botones nuevos y todo sigue como hoy. */
  readonly archivos: ArchivosDeCortes | null;
  abrirCarpeta(): Promise<SalidaDeAbrir>;
}

export function useCarpetaDeCortes(): CarpetaDeCortes {
  const archivos = archivosDeLaApp(useApp());
  const abrirCarpeta = useCallback(
    async (): Promise<SalidaDeAbrir> =>
      archivos === null
        ? { ok: false, mensaje: 'Esto sólo funciona dentro de la app de Windows.' }
        : abrirLaCarpetaDeCortes(archivos),
    [archivos],
  );
  return { archivos, abrirCarpeta };
}
