'use client';

import { useEffect, useSyncExternalStore, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Printer } from 'lucide-react';

import {
  enCurso,
  MESA_DE_TRABAJOS,
  textoDeLaFase,
  type ControlesDelTrabajo,
  type EstadoDelTrabajo,
  type FinDelTrabajo,
} from './trabajos.ts';
import { nuevoIdDeTrabajo } from './termico/trabajo.ts';

/**
 * EL BOTÓN DE IMPRIMIR (DP-20 · refuerzo §4).
 *
 * Con la app y una impresora configurada imprime directo y dice en el mismo botón cómo va:
 * «Enviando…» → «Imprimiendo…» → «Impreso ✓» (o «Enviado ✓» si la impresora no confirma).
 * Mientras hay un trabajo en curso no acepta otro toque: es lo que evita los tickets repetidos.
 * Al terminar se puede volver a imprimir. Sin la app, hace lo de siempre: el diálogo del navegador.
 *
 * El error no se pinta aquí sino en `<AvisoDeImpresion>`, con la misma `clave`: así cabe arriba
 * del pie de la ventana, con sus salidas.
 */

const QUITAR_EL_LISTO_MS = 2500;
const LIBRE: EstadoDelTrabajo = { fase: 'libre', avance: null, fallo: null, idPendiente: null };

export function useTrabajo(clave: string): EstadoDelTrabajo {
  return useSyncExternalStore(
    MESA_DE_TRABAJOS.suscribir,
    () => MESA_DE_TRABAJOS.leer(clave),
    () => LIBRE,
  );
}

export interface ImpresionDelBoton {
  /** Única por documento: `ticket:<id de la venta>`. La comparten el botón y su aviso. */
  readonly clave: string;
  /** ¿Hay app e impresora para este documento? Si no, se usa el navegador. */
  readonly directo: boolean;
  /** Imprime por la app. */
  readonly alImprimir: (controles: ControlesDelTrabajo) => Promise<FinDelTrabajo>;
  /** Lo de siempre: el diálogo del navegador. */
  readonly alNavegador: () => void;
}

/** Lanza el trabajo si el botón está libre; un toque de más no hace nada. */
export function lanzarImpresion(impresion: ImpresionDelBoton): void {
  if (!impresion.directo) {
    impresion.alNavegador();
    return;
  }
  void MESA_DE_TRABAJOS.lanzar(
    impresion.clave,
    () => nuevoIdDeTrabajo(impresion.clave),
    impresion.alImprimir,
  );
}

export function BotonDeImprimir({
  impresion,
  etiqueta = 'Imprimir',
  size,
  variant,
  className,
  disabled = false,
}: {
  readonly impresion: ImpresionDelBoton;
  readonly etiqueta?: string;
  readonly size?: 'default' | 'sm' | 'lg';
  readonly variant?: 'default' | 'outline' | 'secondary';
  readonly className?: string;
  readonly disabled?: boolean;
}): ReactElement {
  const estado = useTrabajo(impresion.clave);
  const ocupado = enCurso(estado);
  const listo = estado.fase === 'impreso' || estado.fase === 'enviado';

  useEffect(() => {
    if (!listo) return undefined;
    const reloj = setTimeout(() => {
      MESA_DE_TRABAJOS.soltar(impresion.clave);
    }, QUITAR_EL_LISTO_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [listo, impresion.clave]);

  const avance = estado.fase === 'imprimiendo' && estado.avance !== null ? estado.avance : null;
  return (
    <Button
      type="button"
      {...(size === undefined ? {} : { size })}
      {...(variant === undefined ? {} : { variant })}
      className={className}
      disabled={disabled}
      cargando={ocupado}
      data-fase-de-impresion={estado.fase}
      onClick={() => {
        lanzarImpresion(impresion);
      }}
    >
      {ocupado ? null : <Printer aria-hidden className="mr-1 size-4" />}
      <span aria-live="polite">{textoDeLaFase(estado, etiqueta)}</span>
      {avance === null ? null : (
        <span
          role="progressbar"
          aria-label="Avance de la impresión"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(avance * 100)}
          className="ml-2 inline-block h-1.5 w-12 overflow-hidden rounded-full bg-current/25"
        >
          <span
            className="block h-full origin-left rounded-full bg-current transition-transform duration-(--duracion-rapida)"
            style={{ transform: `scaleX(${String(avance)})` }}
          />
        </span>
      )}
    </Button>
  );
}

/**
 * EL ERROR DE IMPRESIÓN, CON SALIDA: qué pasó («Sin papel»), qué hacer, y tres caminos:
 * reintentar, imprimir con el navegador o ir a Impresión. Un error nunca deshace el cobro.
 */
export function AvisoDeImpresion({
  impresion,
  yaQuedo,
}: {
  readonly impresion: ImpresionDelBoton;
  /** Lo que ya está hecho aunque el papel falle: «La venta ya quedó cobrada». */
  readonly yaQuedo?: string;
}): ReactElement | null {
  const estado = useTrabajo(impresion.clave);
  if (estado.fase !== 'error' || estado.fallo === null) return null;
  return (
    <Aviso
      tono="peligro"
      titulo={estado.fallo.titulo}
      accion={
        <div className="flex flex-wrap gap-(--espacio-2)">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              lanzarImpresion(impresion);
            }}
          >
            Reintentar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              MESA_DE_TRABAJOS.soltar(impresion.clave);
              impresion.alNavegador();
            }}
          >
            Imprimir con el navegador
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href="/configuracion?tab=impresion">Ir a Impresión</a>
          </Button>
        </div>
      }
    >
      <p>
        {estado.fallo.queHacer}
        {yaQuedo === undefined ? '' : ` ${yaQuedo}`}
      </p>
    </Aviso>
  );
}
