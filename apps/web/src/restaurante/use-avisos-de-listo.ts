'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { invocarComando } from '~/cliente/api';

import {
  avisosPendientes,
  idsDePlatillos,
  platillosNuevos,
  quitadosVigentes,
  type AvisoDeListo,
} from './avisos-de-listo.ts';

/**
 * DP-24 · 4.3 · LOS AVISOS DE «LISTO» DE ESTE MESERO, leídos del servidor y recordados en el aparato.
 *
 * Qué avisos hay lo dice el servidor —sólo las mesas de este mesero— cada pocos segundos. Qué
 * avisos YA QUITÓ el mesero lo recuerda el aparato (por su empleo), porque quitar un aviso no es
 * entregar el plato: es decir «ya lo vi». Un platillo quitado no vuelve a avisar; uno que sale
 * después, sí. Mientras el platillo siga listo y sin quitar, el aviso sigue ahí: no se pierde en
 * silencio.
 */

export const RUTA_AVISOS_DE_LISTO = '/api/restaurante/avisos-de-listo';
const CADA_CUANTO_SE_LEE = 3_000;
const MEMORIA = 'mh_avisos_quitados_';

interface Respuesta {
  readonly avisos: readonly AvisoDeListo[];
}

function recordados(empleoId: string): ReadonlySet<string> {
  try {
    const crudo = localStorage.getItem(`${MEMORIA}${empleoId}`);
    const lista: unknown = crudo === null ? [] : JSON.parse(crudo);
    return new Set(
      Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function recordar(empleoId: string, ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(`${MEMORIA}${empleoId}`, JSON.stringify([...ids]));
  } catch {
    // Sin almacenamiento el aviso sólo reaparece al recargar: nunca se pierde uno por esto.
  }
}

export interface AvisosDelMesero {
  /** Los avisos con lo que todavía no se quitó, el que más lleva esperando primero. */
  readonly pendientes: readonly AvisoDeListo[];
  /** Quita un aviso (todos sus platillos de ahora). */
  readonly quitar: (aviso: AvisoDeListo) => void;
  readonly quitarTodos: () => void;
  readonly falloDeLectura: boolean;
}

export function useAvisosDeListo(
  activo: boolean,
  empleoId: string | null,
  alLlegarNuevos: (nuevos: readonly AvisoDeListo[]) => void,
): AvisosDelMesero {
  const consulta = useQuery({
    queryKey: ['avisos_de_listo', empleoId],
    queryFn: ({ signal }) => invocarComando<Respuesta>(RUTA_AVISOS_DE_LISTO, {}, { signal }),
    enabled: activo && empleoId !== null,
    refetchInterval: CADA_CUANTO_SE_LEE,
    staleTime: 1_000,
    placeholderData: (previo) => previo,
  });
  // Lo que ESTE aparato recuerda haber quitado, por empleo: se lee de la memoria al primer uso y
  // desde entonces vive en el estado.
  const [propios, setPropios] = useState<{
    readonly empleoId: string;
    readonly ids: ReadonlySet<string>;
  } | null>(null);
  const quitados = useMemo<ReadonlySet<string>>(() => {
    if (empleoId === null) return new Set();
    return propios?.empleoId === empleoId ? propios.ids : recordados(empleoId);
  }, [empleoId, propios]);

  const delServidor = useMemo(() => consulta.data?.avisos ?? [], [consulta.data]);
  const pendientes = useMemo(
    () => avisosPendientes(delServidor, quitados),
    [delServidor, quitados],
  );

  const conocidos = useRef<ReadonlySet<string> | null>(null);
  const alLlegar = useRef(alLlegarNuevos);
  useEffect(() => {
    alLlegar.current = alLlegarNuevos;
  });
  useEffect(() => {
    if (consulta.data === undefined) return;
    const nuevos = new Set(platillosNuevos(pendientes, conocidos.current));
    conocidos.current = new Set(idsDePlatillos(pendientes));
    if (nuevos.size === 0) return;
    alLlegar.current(
      pendientes
        .map((a) => ({ ...a, platillos: a.platillos.filter((p) => nuevos.has(p.id)) }))
        .filter((a) => a.platillos.length > 0),
    );
  }, [consulta.data, pendientes]);

  const quitarIds = useCallback(
    (ids: readonly string[]) => {
      if (empleoId === null) return;
      // Al guardar se olvida lo que el servidor ya no trae (entregado, cancelado): la memoria del
      // aparato no crece sin fin.
      const siguientes = quitadosVigentes(new Set([...quitados, ...ids]), delServidor);
      setPropios({ empleoId, ids: siguientes });
      recordar(empleoId, siguientes);
    },
    [empleoId, quitados, delServidor],
  );
  const quitar = useCallback(
    (aviso: AvisoDeListo) => {
      quitarIds(aviso.platillos.map((p) => p.id));
    },
    [quitarIds],
  );
  const quitarTodos = useCallback(() => {
    quitarIds(idsDePlatillos(pendientes));
  }, [quitarIds, pendientes]);

  return { pendientes, quitar, quitarTodos, falloDeLectura: consulta.isError };
}
