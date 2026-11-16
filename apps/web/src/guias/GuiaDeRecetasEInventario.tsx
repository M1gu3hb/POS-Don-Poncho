'use client';

import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@morphiqpos/ui/primitivas/sheet';
import { Superficie } from '@morphiqpos/ui/sistema';
import { CircleHelp } from 'lucide-react';

import {
  INTRO_DE_LA_GUIA,
  SECCIONES_DE_LA_GUIA,
  TITULO_DE_LA_GUIA,
} from './guia-de-recetas-e-inventario.ts';

/**
 * «¿CÓMO FUNCIONA?» (DP-21 · Bloque 17 · M19): la guía de recetas e inventario, dentro de la app.
 *
 * Un botón que abre un panel con los pasos tal como funcionan HOY. El contenido sale de una sola
 * fuente (`guia-de-recetas-e-inventario.ts`), la misma que escribe `docs/cliente/GUIA-RECETAS-E-INVENTARIO.md`,
 * y un contrato ata cada afirmación a lo que hace el servidor.
 *
 * El panel es el `Sheet` del sistema: en el teléfono ocupa casi toda la pantalla y se desplaza; con
 * el dedo el foco se queda en el panel (no sale el teclado), que es lo que ya resuelve `focoAlAbrir`.
 */
export function BotonComoFunciona({
  enLaFicha = false,
}: {
  /** En la ficha del producto va debajo del título, no a la derecha del encabezado. */
  readonly enLaFicha?: boolean;
}): ReactElement {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={enLaFicha ? 'mt-(--espacio-2) w-fit' : undefined}
        onClick={() => {
          setAbierto(true);
        }}
      >
        <CircleHelp aria-hidden className="size-4" />
        ¿Cómo funciona?
      </Button>
      <GuiaDeRecetasEInventario abierto={abierto} alCambiar={setAbierto} />
    </>
  );
}

export function GuiaDeRecetasEInventario({
  abierto,
  alCambiar,
}: {
  readonly abierto: boolean;
  readonly alCambiar: (abierto: boolean) => void;
}): ReactElement {
  const base = useId();
  return (
    <Sheet open={abierto} onOpenChange={alCambiar}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{TITULO_DE_LA_GUIA}</SheetTitle>
          <SheetDescription>{INTRO_DE_LA_GUIA}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-(--espacio-4) px-(--espacio-4) pb-(--espacio-6)">
          {SECCIONES_DE_LA_GUIA.map((seccion, indice) => (
            <Superficie
              key={seccion.id}
              como="section"
              relleno={0}
              aria-labelledby={`${base}-${seccion.id}`}
              className="flex flex-col gap-(--espacio-3) p-(--espacio-4)"
            >
              <h3 id={`${base}-${seccion.id}`} className="text-base font-semibold">
                {String(indice + 1)}. {seccion.titulo}
              </h3>
              <p className="text-sm">{seccion.en_corto}</p>
              <ol className="flex list-decimal flex-col gap-(--espacio-2) pl-(--espacio-5) text-sm">
                {seccion.pasos.map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ol>
              {seccion.ejemplo === undefined ? null : (
                <p className="text-sm text-texto-sutil">
                  <strong className="font-semibold text-texto">Ejemplo.</strong> {seccion.ejemplo}
                </p>
              )}
            </Superficie>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
