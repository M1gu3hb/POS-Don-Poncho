'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { useEffect, useState } from 'react';

import { atenderLaSolicitud, motivoDelFallo } from './atender-solicitud';
import {
  esTipoDeSolicitud,
  globosDeLaMesa,
  TIPOS_DE_SOLICITUD,
  type SolicitudPendiente,
} from './globos-de-solicitud';
import { crearGloboSostenido } from './globo-sostenido';
import { IconoDeSolicitud } from './IconoDeSolicitud';

/**
 * Dónde va la pila: ENCIMA de la mesa en el plano; DEBAJO si la mesa está pegada al borde de
 * arriba del lienzo, que recorta lo que sobresale; EN LÍNEA sobre la tarjeta del teléfono, que es
 * un botón y no puede llevar otro botón adentro.
 */
export type LugarDeLosGlobos = 'arriba' | 'abajo' | 'en-linea';

const LUGARES: Readonly<Record<LugarDeLosGlobos, string>> = {
  arriba:
    'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 flex-col items-center',
  abajo:
    'pointer-events-none absolute top-full left-1/2 z-10 mt-2 flex -translate-x-1/2 flex-col-reverse items-center',
  'en-linea': 'flex flex-wrap items-center justify-center',
};

/**
 * Los globos de las solicitudes pendientes de UNA mesa (DP-9.2). Van encima de la mesa; tocar
 * uno atiende la solicitud (`restaurante.atender_solicitud`) sin abrir la mesa, y el mapa relee.
 * Un mesero que atiende el aviso de una mesa sin responsable se queda con ella y con su cuenta.
 *
 * DP-13.4 · Mantenerlo presionado hace lo mismo que tocarlo (`globo-sostenido.ts`) y NO abre el
 * menú de la mesa: la pila lleva `data-globo-de-solicitud` y la pulsación larga del mapa
 * (`mesaDeLaPulsacion`) no cuenta nada de lo que cuelga de ella.
 */
export function GlobosDeSolicitud({
  solicitudes,
  mesaNumero,
  alAtender,
  lugar = 'arriba',
}: {
  readonly solicitudes: readonly SolicitudPendiente[];
  readonly mesaNumero: number;
  /** Después de atenderla. DP-12.2: con la solicitud, para abrir el pedido si es uno listo. */
  readonly alAtender: (solicitud: SolicitudPendiente) => void;
  readonly lugar?: LugarDeLosGlobos;
}) {
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [sostenido] = useState(crearGloboSostenido);
  // Si el globo se va (otro la atendió) a media pulsación, el reloj no atiende lo que ya no está.
  useEffect(() => sostenido.cancelar, [sostenido]);
  const { visibles, restantes } = globosDeLaMesa(solicitudes);
  if (visibles.length === 0) return null;

  async function atender(solicitud: SolicitudPendiente): Promise<void> {
    if (enCurso !== null) return;
    setEnCurso(solicitud.id);
    setFallo(null);
    try {
      await atenderLaSolicitud(solicitud.id);
      alAtender(solicitud);
    } catch (error: unknown) {
      setFallo(motivoDelFallo(error));
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <div data-globo-de-solicitud className={`${LUGARES[lugar]} gap-(--espacio-1)`}>
      {visibles.map((solicitud) => {
        if (!esTipoDeSolicitud(solicitud.tipo)) return null;
        const tipo = TIPOS_DE_SOLICITUD[solicitud.tipo];
        return (
          <Button
            key={solicitud.id}
            type="button"
            disabled={enCurso !== null}
            aria-label={`Mesa ${String(mesaNumero)}: ${tipo.completo}. Tocar para atender.`}
            onPointerDown={(evento) => {
              if (evento.button !== 0) return;
              sostenido.bajar(evento.clientX, evento.clientY, () => void atender(solicitud));
            }}
            onPointerMove={(evento) => {
              sostenido.mover(evento.clientX, evento.clientY);
            }}
            onPointerUp={sostenido.cancelar}
            onPointerCancel={sostenido.cancelar}
            onContextMenu={(evento) => {
              // El menú del navegador (y el «copiar» del teléfono) no tienen nada que hacer aquí.
              evento.preventDefault();
            }}
            onClick={(evento) => {
              evento.stopPropagation();
              // Si mantenerlo ya la atendió, este clic (el de soltar) no la atiende otra vez.
              if (sostenido.tirarElClic()) return;
              void atender(solicitud);
            }}
            className="pointer-events-auto h-auto gap-(--espacio-1) rounded-full bg-texto py-1 pr-(--espacio-3) pl-1 text-sm font-bold text-fondo shadow-3 ring-2 ring-fondo hover:bg-texto/90"
          >
            <IconoDeSolicitud tipo={solicitud.tipo} tamano="globo" />
            {enCurso === solicitud.id ? 'Atendiendo…' : tipo.corto}
          </Button>
        );
      })}
      {restantes > 0 ? (
        <span className="rounded-full bg-texto px-2 py-0.5 text-xs font-bold text-fondo">
          +{restantes} más
        </span>
      ) : null}
      {fallo !== null ? (
        <div className="pointer-events-auto max-w-56">
          <Aviso tono="peligro" titulo={fallo} />
        </div>
      ) : null}
      {/* La cola de la burbuja: apunta a la mesa (arriba o abajo de la pila). */}
      {lugar === 'en-linea' ? null : (
        <span
          aria-hidden
          className={`size-3 rotate-45 bg-texto ${lugar === 'arriba' ? '-mt-2' : '-mb-2'}`}
        />
      )}
    </div>
  );
}
