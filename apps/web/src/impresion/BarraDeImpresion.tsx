'use client';

import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Printer } from 'lucide-react';

import { darPermiso, TEXTO_PERMISO_CONCEDIDO } from './permiso-de-la-impresora.ts';
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
const QUITAR_EL_LISTO_CON_AVISO_MS = 8000;
const NADA: readonly TrabajoALaVista[] = [];

/**
 * DP-24 · 6.2 · «Dar permiso a la impresora»: pide el permiso de USB al sistema (sin pedir la clave
 * del laboratorio), lo dice y reintenta la MISMA impresión —con su mismo id y sus copias—.
 */
function BotonDelPermiso({
  clave,
  pedir,
}: {
  readonly clave: string;
  readonly pedir: NonNullable<TrabajoALaVista['salidas']['darPermiso']>;
}): ReactElement {
  const [pidiendo, setPidiendo] = useState(false);
  const [dicho, setDicho] = useState<string | null>(null);
  return (
    <div className="mt-(--espacio-3) flex flex-col gap-(--espacio-2)">
      <Button
        type="button"
        size="lg"
        className="min-h-[3.5rem] w-full text-base"
        disabled={pidiendo}
        data-dar-permiso-a-la-impresora
        onClick={() => {
          setPidiendo(true);
          setDicho(null);
          void darPermiso(pedir).then((resultado) => {
            setPidiendo(false);
            setDicho(resultado.texto);
            if (resultado.concedido) MESA_DE_TRABAJOS.reintentar(clave);
          });
        }}
      >
        {pidiendo ? 'Pidiendo el permiso…' : 'Dar permiso a la impresora'}
      </Button>
      {dicho === null ? null : (
        <p role="status" className="text-sm font-medium">
          {dicho}
          {dicho === TEXTO_PERMISO_CONCEDIDO ? ' Reintentando la impresión…' : ''}
        </p>
      )}
    </div>
  );
}

function Renglon({ trabajo }: { readonly trabajo: TrabajoALaVista }): ReactElement {
  const { clave, estado, salidas } = trabajo;
  const listo = estado.fase === 'impreso' || estado.fase === 'enviado';

  useEffect(() => {
    if (!listo) return undefined;
    const reloj = setTimeout(
      () => {
        MESA_DE_TRABAJOS.soltar(clave);
      },
      estado.aviso === undefined ? QUITAR_EL_LISTO_MS : QUITAR_EL_LISTO_CON_AVISO_MS,
    );
    return () => {
      clearTimeout(reloj);
    };
  }, [listo, clave, estado.aviso]);

  if (estado.fase === 'error' && estado.fallo !== null) {
    const alNavegador = salidas.alNavegador;
    return (
      <Aviso
        tono="peligro"
        titulo={`${salidas.titulo}: ${estado.fallo.titulo}`}
        className="bg-superficie shadow-3"
      >
        <p>
          {estado.fallo.queHacer}
          {salidas.yaQuedo === undefined ? '' : ` ${salidas.yaQuedo}`}
        </p>
        {estado.fallo.codigo === 'SIN_PERMISO' && salidas.darPermiso !== undefined ? (
          <BotonDelPermiso clave={clave} pedir={salidas.darPermiso} />
        ) : null}
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
    <Superficie
      nivel={3}
      relleno={0}
      role="status"
      data-fase-de-impresion={estado.fase}
      className="flex flex-wrap items-center gap-(--espacio-3) px-(--espacio-4) py-(--espacio-3) text-sm"
    >
      <Printer aria-hidden className="size-4 shrink-0 text-primario" />
      <span className="font-medium">{salidas.titulo}</span>
      <span className="text-texto-sutil">{textoDeLaFase(estado, '')}</span>
      {estado.aviso === undefined ? null : (
        <span className="basis-full text-xs font-medium text-peligro">{estado.aviso}</span>
      )}
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
            className="block h-full origin-left rounded-full bg-primario transition-transform duration-(--duracion-rapida) motion-reduce:transition-none"
            style={{ transform: `scaleX(${String(avance ?? 0.15)})` }}
          />
        </span>
      ) : null}
    </Superficie>
  );
}

export function BarraDeImpresion(): ReactElement | null {
  const app = useApp();
  // DP-20 · Parte 6 · La app dice si este aparato va en modo ligero.
  useModoLigero(app);
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
