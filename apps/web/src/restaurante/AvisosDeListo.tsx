'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  fraseDelAviso,
  avisosSegunLaVentana,
  nombreDeLaEstacion,
  repartirAvisos,
  type AvisoDeListo,
} from './avisos-de-listo.ts';

/**
 * DP-24 · 4.3 · EL AVISO DE «LISTO», GRANDE Y CLARO.
 *
 * «Mesa 5 · Listo en Cantina: 2 Coca cola, 1 Jugo · Recoger en Cantina». Se apilan —tres a la
 * vista y el resto contado, nunca escondido—, no se van solos, y el mesero los quita deslizando o
 * tocando (y con el botón «Entendido» de 44 px, para quien no puede arrastrar). Van ARRIBA y EN el
 * flujo de la pantalla (`sticky`, no `fixed`): empujan el contenido en vez de taparlo, así que
 * nunca caen sobre un botón del mapa ni de la mesa. El
 * contenedor es un `status` para que el lector de pantalla los lea; sin animación si el aparato
 * pidió movimiento reducido.
 */

const UMBRAL_DE_DESLIZAMIENTO = 80;
const UMBRAL_DE_TOQUE = 8;

export interface AvisosDeListoProps {
  readonly avisos: readonly AvisoDeListo[];
  readonly alQuitar: (aviso: AvisoDeListo) => void;
  readonly alQuitarTodos: () => void;
}

/** La ventana (diálogo) que el mesero tiene abierta y, si es de una mesa, su número. */
function useVentanaAbierta(): { abierta: boolean; mesaNumero: number | null } {
  const [ventana, setVentana] = useState<{ abierta: boolean; mesaNumero: number | null }>({
    abierta: false,
    mesaNumero: null,
  });
  useEffect(() => {
    const leer = (): void => {
      const dialogo = document.querySelector('[role="dialog"]');
      const titulo = dialogo?.querySelector('h2')?.textContent ?? '';
      const mesa = /^Mesa (\d+)/.exec(titulo.trim())?.[1];
      const siguiente = {
        abierta: dialogo !== null,
        mesaNumero: mesa === undefined ? null : Number(mesa),
      };
      setVentana((previa) =>
        previa.abierta === siguiente.abierta && previa.mesaNumero === siguiente.mesaNumero
          ? previa
          : siguiente,
      );
    };
    leer();
    const observador = new MutationObserver(leer);
    observador.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observador.disconnect();
    };
  }, []);
  return ventana;
}

export function AvisosDeListo({ avisos: todos, alQuitar, alQuitarTodos }: AvisosDeListoProps) {
  const [verTodos, setVerTodos] = useState(false);
  const ventana = useVentanaAbierta();
  const { completos: avisos, enPastilla } = avisosSegunLaVentana(todos, ventana);
  const { visibles, ocultos } = repartirAvisos(avisos);
  const aLaVista = verTodos ? avisos : visibles;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Platillos listos para recoger"
      data-avisos-de-listo={String(avisos.length)}
      className="sticky top-0 z-30 flex flex-col items-center gap-2 empty:hidden pb-2"
    >
      {enPastilla.length > 0 && (
        // Con una ventana abierta los avisos de otras mesas son sólo una pastilla SIN toques.
        <Superficie
          como="p"
          nivel={3}
          radio="completo"
          relleno={0}
          data-avisos-compactos={String(enPastilla.length)}
          className="pointer-events-none bg-exito px-(--espacio-3) py-1 text-sm font-bold text-exito-texto"
        >
          {enPastilla.length} {enPastilla.length === 1 ? 'aviso de listo' : 'avisos de listo'}
        </Superficie>
      )}
      {aLaVista.map((aviso) => (
        <TarjetaDelAviso key={aviso.comandaId} aviso={aviso} alQuitar={alQuitar} />
      ))}
      {!verTodos && ocultos.length > 0 && (
        <Button
          size="lg"
          variant="secondary"
          className="pointer-events-auto w-full max-w-xl font-bold shadow-3"
          onClick={() => {
            setVerTodos(true);
          }}
        >
          Ver {ocultos.length} {ocultos.length === 1 ? 'aviso más' : 'avisos más'}
        </Button>
      )}
      {avisos.length > 1 && (
        <Button
          size="lg"
          variant="outline"
          className="pointer-events-auto w-full max-w-xl bg-superficie font-bold shadow-3"
          onClick={() => {
            setVerTodos(false);
            alQuitarTodos();
          }}
        >
          Entendido: quitar todos
        </Button>
      )}
    </div>
  );
}

function TarjetaDelAviso({
  aviso,
  alQuitar,
}: {
  readonly aviso: AvisoDeListo;
  readonly alQuitar: (aviso: AvisoDeListo) => void;
}) {
  const [desplazo, setDesplazo] = useState(0);
  const inicio = useRef<{ x: number; arrastro: boolean } | null>(null);
  const color = aviso.estacionColor ?? undefined;

  const soltar = (): void => {
    const gesto = inicio.current;
    inicio.current = null;
    if (gesto === null) return;
    if (Math.abs(desplazo) >= UMBRAL_DE_DESLIZAMIENTO) alQuitar(aviso);
    else if (!gesto.arrastro) alQuitar(aviso);
    setDesplazo(0);
  };

  return (
    <Superficie
      como="div"
      nivel={1}
      radio="lg"
      relleno={0}
      data-aviso={aviso.comandaId}
      data-estacion={nombreDeLaEstacion(aviso)}
      style={{
        touchAction: 'pan-y',
        transform: desplazo === 0 ? undefined : `translateX(${String(desplazo)}px)`,
        opacity: desplazo === 0 ? undefined : Math.max(0.3, 1 - Math.abs(desplazo) / 240),
        ...(color === undefined ? {} : { borderLeftColor: color }),
      }}
      className="pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-xl border-2 border-l-8 border-exito bg-exito p-(--espacio-3) text-exito-texto shadow-4 motion-safe:transition-transform motion-reduce:transition-none"
      onPointerDown={(evento) => {
        // Los botones de la tarjeta hacen lo suyo; el resto de la tarjeta se toca o se desliza.
        if ((evento.target as HTMLElement).closest('button') !== null) return;
        inicio.current = { x: evento.clientX, arrastro: false };
      }}
      onPointerMove={(evento) => {
        const gesto = inicio.current;
        if (gesto === null) return;
        const dx = evento.clientX - gesto.x;
        if (Math.abs(dx) > UMBRAL_DE_TOQUE) gesto.arrastro = true;
        if (gesto.arrastro) setDesplazo(dx);
      }}
      onPointerUp={soltar}
      onPointerCancel={() => {
        inicio.current = null;
        setDesplazo(0);
      }}
    >
      <p className="flex items-start gap-2 text-xl font-black leading-snug xl:text-2xl">
        <BellRing aria-hidden="true" className="mt-1 size-5 shrink-0" />
        <span>{fraseDelAviso(aviso)}</span>
      </p>
      <Button
        size="lg"
        variant="secondary"
        className="min-h-[max(2.75rem,var(--altura-control))] w-full font-bold"
        onClick={() => {
          alQuitar(aviso);
        }}
      >
        Entendido
      </Button>
    </Superficie>
  );
}
