'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso, Esqueleto, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { useEffect, useState, type ReactElement } from 'react';

import { ErrorApi, consultarPuente, invocarComando } from '~/cliente/api';

import { destinosDelCambio, preguntaDelCambio } from './cambiar-de-mesa-aqui';
import type { MesaElegible } from './mesas-elegibles';

/**
 * «CAMBIAR DE MESA», AHÍ MISMO (DP-21 · Bloque 10 · M24).
 *
 * El panel de la mesa del mesero abre este panel sin salir de `/mesero`: las mesas libres de la
 * zona en botones grandes (y, aparte, las del resto del salón), una pregunta antes de pasar
 * («¿Pasar la cuenta de la mesa 3 a la mesa 7?») y el comando de siempre
 * (`restaurante.cambiar_mesa`): la cuenta, lo comandado y la cocina se van con la mesa.
 *
 * El salón se lee al abrir —lo libre cambia cada minuto— y sólo el que está EN SERVICIO: una mesa
 * dada de baja sigue «libre» y no es destino.
 */

export interface CambiarDeMesaAquiProps {
  readonly mesa: { readonly id: string; readonly numero: number; readonly zona: string | null };
  readonly ordenId: string;
  readonly alCerrar: () => void;
  /** La cuenta ya está en la otra mesa: la pantalla avisa y vuelve al mapa. */
  readonly alPasar: (destino: MesaElegible) => void;
}

function mensajeDe(fallo: unknown, porOmision: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porOmision;
}

function useSalonEnServicio(): {
  readonly mesas: readonly MesaElegible[] | null;
  readonly fallo: string | null;
} {
  const [mesas, setMesas] = useState<readonly MesaElegible[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  useEffect(() => {
    const control = new AbortController();
    consultarPuente<MesaElegible>('Mesa', {
      filtro: { activo: true },
      limite: 200,
      signal: control.signal,
    })
      .then((filas) => {
        if (!control.signal.aborted) setMesas(filas);
      })
      .catch((error: unknown) => {
        if (!control.signal.aborted) setFallo(mensajeDe(error, 'No se pudo leer el salón.'));
      });
    return () => {
      control.abort();
    };
  }, []);
  return { mesas, fallo };
}

function BotonesDeMesas({
  mesas,
  ocupado,
  alTocar,
}: {
  readonly mesas: readonly MesaElegible[];
  readonly ocupado: boolean;
  readonly alTocar: (mesa: MesaElegible) => void;
}): ReactElement {
  return (
    <ul className="grid grid-cols-3 gap-(--espacio-2) sm:grid-cols-4">
      {mesas.map((mesa) => (
        <li key={mesa.id}>
          <Superficie
            como="button"
            type="button"
            interactiva
            relleno={3}
            disabled={ocupado}
            aria-label={`Mesa ${String(mesa.numero)}${mesa.zona === null || mesa.zona === '' ? '' : `, ${mesa.zona}`}`}
            onClick={() => {
              alTocar(mesa);
            }}
            className="flex min-h-20 w-full flex-col items-center justify-center gap-(--espacio-1)"
          >
            <span className="text-xs text-texto-sutil">Mesa</span>
            <span className="font-numeros text-2xl font-bold tabular-nums">
              {String(mesa.numero)}
            </span>
            <span className="text-xs text-texto-sutil">{mesa.zona ?? ''}</span>
          </Superficie>
        </li>
      ))}
    </ul>
  );
}

export function CambiarDeMesaAqui(props: CambiarDeMesaAquiProps): ReactElement {
  const { mesa, ordenId, alCerrar, alPasar } = props;
  const { mesas, fallo: falloDeLectura } = useSalonEnServicio();
  const [elegida, setElegida] = useState<MesaElegible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [verOtrasZonas, setVerOtrasZonas] = useState(false);
  const destinos = mesas === null ? null : destinosDelCambio(mesas, mesa);

  async function pasar(destino: MesaElegible): Promise<void> {
    if (enviando) return;
    setEnviando(true);
    setFallo(null);
    try {
      await invocarComando('/api/restaurante/cambiar-mesa', {
        ordenId,
        mesaDestinoId: destino.id,
        mesaOrigenId: mesa.id,
      });
      alPasar(destino);
    } catch (error: unknown) {
      setFallo(mensajeDe(error, 'No se pudo. La cuenta sigue en su mesa.'));
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !enviando) alCerrar();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar de mesa</DialogTitle>
          <DialogDescription>
            {elegida === null
              ? `La cuenta de la mesa ${String(mesa.numero)}, lo comandado y la cocina se van con ustedes.`
              : preguntaDelCambio(mesa.numero, elegida.numero)}
          </DialogDescription>
        </DialogHeader>

        {elegida !== null ? (
          <div className="flex flex-col gap-(--espacio-3)">
            {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
            <div className="flex flex-wrap gap-(--espacio-2)">
              <Button
                size="lg"
                disabled={enviando}
                cargando={enviando}
                onClick={() => {
                  void pasar(elegida);
                }}
              >
                Pasar
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={enviando}
                onClick={() => {
                  setElegida(null);
                  setFallo(null);
                }}
              >
                Elegir otra mesa
              </Button>
            </div>
          </div>
        ) : falloDeLectura !== null ? (
          <Aviso tono="peligro" titulo={falloDeLectura} />
        ) : destinos === null ? (
          <Esqueleto className="h-32 w-full rounded-lg" />
        ) : destinos.deLaZona.length === 0 && destinos.deOtrasZonas.length === 0 ? (
          <Vacio titulo="No hay mesas libres ahora." />
        ) : (
          <div className="flex flex-col gap-(--espacio-4)">
            {destinos.deLaZona.length === 0 ? (
              <p className="text-sm text-texto-sutil">
                {mesa.zona === null || mesa.zona.trim() === ''
                  ? 'No hay otra mesa libre sin zona.'
                  : `No hay otra mesa libre en ${mesa.zona}.`}
              </p>
            ) : (
              <BotonesDeMesas mesas={destinos.deLaZona} ocupado={enviando} alTocar={setElegida} />
            )}
            {destinos.deOtrasZonas.length === 0 ? null : verOtrasZonas ||
              destinos.deLaZona.length === 0 ? (
              <div className="flex flex-col gap-(--espacio-2)">
                <h3 className="text-sm font-semibold">Otras zonas</h3>
                <BotonesDeMesas
                  mesas={destinos.deOtrasZonas}
                  ocupado={enviando}
                  alTocar={setElegida}
                />
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setVerOtrasZonas(true);
                }}
              >
                Ver mesas de otras zonas ({String(destinos.deOtrasZonas.length)})
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
