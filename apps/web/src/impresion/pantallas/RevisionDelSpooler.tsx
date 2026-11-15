'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { Aviso, Esqueleto } from '@morphiqpos/ui/sistema';

import type { MorphiqApp } from '../puente/contrato.ts';
import { mensajeDe } from '../trabajos.ts';
import { CLAVE_DE_LOS_AJUSTES } from '../use-app.ts';
import { Casilla } from './campos';
import { AJUSTE_DE_LA_REVISION, revisaElSpooler } from './revision-del-spooler.ts';

/**
 * «PREGUNTAR A WINDOWS SI LA IMPRESORA ESTÁ LISTA» (DP-20 · laboratorio, sección de conexiones).
 *
 * Un ajuste del APARATO, no del perfil: se guarda al tocarlo. Sólo se ofrece con la impresora
 * instalada en Windows. Ver `revision-del-spooler.ts`.
 */
export function RevisionDelSpooler({ app }: { readonly app: MorphiqApp }): ReactElement {
  const consultas = useQueryClient();
  const ajustes = useQuery({
    queryKey: CLAVE_DE_LOS_AJUSTES,
    queryFn: () => app.ajustes(),
    staleTime: Infinity,
  });
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function cambiar(encendida: boolean): Promise<void> {
    if (guardando) return;
    setGuardando(true);
    setFallo(null);
    try {
      const nuevos = await app.guardarAjustes({ [AJUSTE_DE_LA_REVISION]: encendida });
      consultas.setQueryData(CLAVE_DE_LOS_AJUSTES, nuevos);
    } catch (error: unknown) {
      setFallo(mensajeDe(error) ?? 'No se pudo guardar el ajuste en este aparato.');
    } finally {
      setGuardando(false);
    }
  }

  if (ajustes.data === undefined) {
    return ajustes.isError ? (
      <Aviso tono="peligro" titulo="La app no dijo sus ajustes." />
    ) : (
      <Esqueleto className="h-(--altura-control) w-full max-w-md rounded-lg" />
    );
  }
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <Casilla
        etiqueta="Preguntar a Windows si la impresora está lista antes de imprimir"
        marcada={revisaElSpooler(ajustes.data)}
        deshabilitada={guardando}
        ayuda="Así «sin papel» o «desconectada» se dicen en la pantalla. Apágalo sólo si Windows dice «fuera de línea» de una impresora que sí está conectada: hay drivers que lo dicen mal y entonces no saldría nada."
        alCambiar={(encendida) => {
          void cambiar(encendida);
        }}
      />
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}
