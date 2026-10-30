import { Superficie } from '@morphiqpos/ui/sistema';
import { PartyPopper, TriangleAlert, UtensilsCrossed, Users } from 'lucide-react';
import type { ReactElement } from 'react';

import { MESA_STATUS_CONFIG, insigniaDeEstadoDeMesa } from '../../heredado/lib/constants.js';

import { primeroConTexto } from './texto';

/**
 * LA CABECERA DE LA MESA ABIERTA: «Mesa 5», su estado, cuántos son, a nombre de quién y si hay
 * una celebración o una alergia que cocina y mesero no pueden olvidar.
 *
 * Son DOS piezas y no una porque el diálogo y su título (`DialogTitle`, que le da su nombre
 * accesible «Mesa 5 Ocupada 4…») son los del heredado y viven en `Mesero.jsx`:
 *
 *   · `TituloDeLaMesa` es el CONTENIDO de ese título. Sus hijos son elementos sueltos y el título
 *     es un `flex`, por eso el nombre del diálogo sale con espacios entre «Mesa 5» y el estado.
 *   · `IndicacionesDeLaMesa` es el renglón con el detalle de la alergia, debajo; nunca encima del
 *     bloque de «Listo para recoger».
 *
 * Los dos emoji de siempre (🎉 y ⚠️) son iconos: un emoji lo dibuja cada sistema operativo a su
 * manera y no hereda el color, y en una alergia eso no es una discusión estética.
 */

interface MesaDeLaCabecera {
  readonly numero?: number | null | undefined;
  readonly estado?: string | null | undefined;
  readonly celebracion_especial?: boolean | null | undefined;
  readonly tipo_celebracion?: string | null | undefined;
  readonly notas_alergias?: string | null | undefined;
}
interface VentaDeLaCabecera {
  readonly personas?: number | null | undefined;
  readonly cliente_nombre?: string | null | undefined;
  readonly celebracion_especial?: boolean | null | undefined;
  readonly tipo_celebracion?: string | null | undefined;
  readonly notas_alergias?: string | null | undefined;
}

const ESTADOS = MESA_STATUS_CONFIG as unknown as Readonly<
  Record<string, { readonly label: string }>
>;

/** Lo que dice la mesa o, si no, la cuenta: la apertura escribe en las dos. */
function alergiaDe(mesa: MesaDeLaCabecera | null, venta: VentaDeLaCabecera | null): string {
  return primeroConTexto(mesa?.notas_alergias, venta?.notas_alergias);
}

export function TituloDeLaMesa({
  mesa,
  venta,
}: {
  readonly mesa: MesaDeLaCabecera | null;
  readonly venta: VentaDeLaCabecera | null;
}): ReactElement {
  const estado = mesa?.estado ?? undefined;
  const alergia = alergiaDe(mesa, venta);
  const hayCelebracion =
    mesa?.celebracion_especial === true || venta?.celebracion_especial === true;
  const celebracion = primeroConTexto(
    mesa?.tipo_celebracion,
    venta?.tipo_celebracion,
    'Celebración',
  );
  const personas = Number(venta?.personas) || 0;
  return (
    <>
      <UtensilsCrossed aria-hidden="true" className="size-5 text-primario" />
      Mesa {mesa?.numero}
      <span
        className="rounded-full px-2 py-0.5 text-xs font-normal"
        style={insigniaDeEstadoDeMesa(estado === undefined ? undefined : ESTADOS[estado])}
      >
        {estado === undefined ? undefined : ESTADOS[estado]?.label}
      </span>
      {personas > 0 ? (
        <span className="flex items-center gap-1 text-xs font-normal text-texto-sutil">
          <Users aria-hidden="true" className="size-3" />
          {personas}
        </span>
      ) : null}
      {venta?.cliente_nombre ? (
        <span className="text-xs font-normal text-texto-sutil">· {venta.cliente_nombre}</span>
      ) : null}
      {hayCelebracion ? (
        <Superficie
          como="span"
          nivel={0}
          relleno={0}
          radio="completo"
          className="inline-flex items-center gap-1 border-acento/30 bg-acento/10 px-2 py-0.5 text-xs font-bold text-acento"
          title={celebracion}
        >
          <PartyPopper aria-hidden="true" className="size-3" />
          {celebracion}
        </Superficie>
      ) : null}
      {alergia ? (
        <Superficie
          como="span"
          nivel={0}
          relleno={0}
          radio="completo"
          className="inline-flex items-center gap-1 border-advertencia/30 bg-advertencia/10 px-2 py-0.5 text-xs font-bold text-advertencia"
          title={alergia}
        >
          <TriangleAlert aria-hidden="true" className="size-3" />
          Alergia
        </Superficie>
      ) : null}
    </>
  );
}

export function IndicacionesDeLaMesa({
  mesa,
  venta,
}: {
  readonly mesa: MesaDeLaCabecera | null;
  readonly venta: VentaDeLaCabecera | null;
}): ReactElement | null {
  const alergia = alergiaDe(mesa, venta);
  if (!alergia) return null;
  return (
    <p className="mt-1 text-xs leading-snug text-advertencia">
      <span className="font-semibold">Alergia / indicaciones:</span> {alergia}
    </p>
  );
}
