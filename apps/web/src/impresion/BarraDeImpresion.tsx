'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Printer } from 'lucide-react';

import { consultarPuente } from '~/cliente/api';

import { CLAVE_DE_LAS_COPIAS, copiasLeidas, recordarCopias } from './copias.ts';
import { enCurso, MESA_DE_TRABAJOS, textoDeLaFase, type TrabajoALaVista } from './trabajos.ts';
import { useModoLigero } from './modo-ligero.ts';
import { useApp } from './use-app.ts';

/**
 * LA BARRA DE IMPRESIÓN (DP-20 · refuerzo §4). Una sola, para toda la app.
 *
 * Cada documento que sale por la app enseña aquí cómo va —«Enviando…» → «Imprimiendo…» →
 * «Impreso ✓» o «Enviado ✓»— y, si falla, qué pasó y qué hacer, con sus tres salidas: reintentar,
 * imprimir con el navegador o ir a Impresión. Las pantallas no cambian: siguen llamando a
 * `printDocument`.
 */

const QUITAR_EL_LISTO_MS = 2500;
const NADA: readonly TrabajoALaVista[] = [];

function Renglon({ trabajo }: { readonly trabajo: TrabajoALaVista }): ReactElement {
  const { clave, estado, salidas } = trabajo;
  const listo = estado.fase === 'impreso' || estado.fase === 'enviado';

  useEffect(() => {
    if (!listo) return undefined;
    const reloj = setTimeout(() => {
      MESA_DE_TRABAJOS.soltar(clave);
    }, QUITAR_EL_LISTO_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [listo, clave]);

  if (estado.fase === 'error' && estado.fallo !== null) {
    const alNavegador = salidas.alNavegador;
    return (
      <Aviso
        tono="peligro"
        titulo={`${salidas.titulo}: ${estado.fallo.titulo}`}
        className="bg-superficie shadow-lg"
      >
        <p>
          {estado.fallo.queHacer}
          {salidas.yaQuedo === undefined ? '' : ` ${salidas.yaQuedo}`}
        </p>
        <div className="mt-(--espacio-3) flex flex-wrap gap-(--espacio-2)">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              MESA_DE_TRABAJOS.reintentar(clave);
            }}
          >
            Reintentar
          </Button>
          {alNavegador === undefined ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                MESA_DE_TRABAJOS.soltar(clave);
                alNavegador();
              }}
            >
              Imprimir con el navegador
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" asChild>
            <a href="/configuracion?tab=impresion">Ir a Impresión</a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              MESA_DE_TRABAJOS.soltar(clave);
            }}
          >
            Cerrar
          </Button>
        </div>
      </Aviso>
    );
  }

  const avance = estado.fase === 'imprimiendo' ? estado.avance : null;
  return (
    <div
      role="status"
      data-fase-de-impresion={estado.fase}
      className="flex items-center gap-(--espacio-3) rounded-lg border border-borde bg-superficie px-(--espacio-4) py-(--espacio-3) text-sm shadow-lg"
    >
      <Printer aria-hidden className="size-4 shrink-0 text-primario" />
      <span className="font-medium">{salidas.titulo}</span>
      <span className="text-texto-sutil">{textoDeLaFase(estado, '')}</span>
      {enCurso(estado) ? (
        <span
          role="progressbar"
          aria-label={`Avance de ${salidas.titulo}`}
          aria-valuemin={0}
          aria-valuemax={100}
          {...(avance === null ? {} : { 'aria-valuenow': Math.round(avance * 100) })}
          className="h-1.5 w-24 overflow-hidden rounded-full bg-fondo-sutil"
        >
          <span
            className="block h-full origin-left rounded-full bg-primario transition-transform duration-150 motion-reduce:transition-none"
            style={{ transform: `scaleX(${String(avance ?? 0.15)})` }}
          />
        </span>
      ) : null}
    </div>
  );
}

export function BarraDeImpresion(): ReactElement | null {
  const app = useApp();
  // DP-20 · Parte 6 · La app dice si este aparato va en modo ligero.
  useModoLigero(app);
  // Las copias del negocio, al alcance de `printDocument` (que no es un componente).
  const copias = useQuery({
    queryKey: CLAVE_DE_LAS_COPIAS,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<{ copias_de_impresion?: unknown }>(
        'ConfiguracionNegocio',
        { limite: 1 },
      );
      return copiasLeidas(configuracion);
    },
    enabled: app !== null,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (copias.data !== undefined) recordarCopias(copias.data);
  }, [copias.data]);

  const trabajos = useSyncExternalStore(
    MESA_DE_TRABAJOS.suscribir,
    MESA_DE_TRABAJOS.aLaVista,
    () => NADA,
  );
  if (trabajos.length === 0) return null;
  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 bottom-(--espacio-4) z-[70] flex flex-col items-center gap-(--espacio-2) px-(--espacio-4)"
      data-barra-de-impresion
    >
      {trabajos.map((trabajo) => (
        <div key={trabajo.clave} className="pointer-events-auto w-full max-w-md">
          <Renglon trabajo={trabajo} />
        </div>
      ))}
    </div>
  );
}
