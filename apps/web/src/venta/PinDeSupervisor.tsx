'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';
import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';

import type { TopeDelPin } from './tope-de-quien-autoriza';

/**
 * EL PIN DE QUIEN AUTORIZA, en la misma pantalla (F-205; DP-13.2).
 *
 * Lo que el descuento ya hacía —elegir al gerente o al dueño y que teclee SU PIN sin cerrar la
 * sesión de nadie—, ahora también para cancelar una cuenta ya pedida. La autorización que vuelve
 * va atada a ESTA cuenta (`ordenId`) y a lo que se autoriza (`para`): D-5, la del descuento de la
 * mesa 3 ya no sirve en la mesa 6, ni para cancelar.
 *
 * Sin `quienesAutorizan` la lista se lee del servidor (la misma del tope de descuento).
 */

export interface QuienAutoriza {
  readonly empleoId: string;
  readonly nombre: string;
}

export interface Autorizada {
  readonly token: string;
  readonly nombre: string;
  /** Ronda 2 · Hasta cuánto llega ese PIN, como lo dice el servidor (puede faltar). */
  readonly tope?: TopeDelPin;
}

function mensajeDe(fallo: unknown, porDefecto: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porDefecto;
}

/**
 * DP-14.6 · Cuántos segundos dice el servidor que hay que esperar: el PIN se bloqueó por intentos
 * (429). `null` si el fallo es otro.
 */
export function esperaDelBloqueo(fallo: unknown): number | null {
  if (!(fallo instanceof ErrorApi) || fallo.estado !== 429) return null;
  const segundos = fallo.error.datos?.['esperaSegundos'];
  return typeof segundos === 'number' && segundos > 0 ? Math.ceil(segundos) : null;
}

export function PinDeSupervisor({
  ordenId,
  para,
  quienesAutorizan,
  idDelCampo,
  montoCentavos,
  alAutorizar,
}: {
  /** La cuenta a la que se ata la autorización; el retiro no tiene cuenta, va por su monto. */
  readonly ordenId?: string;
  readonly para: 'descuento' | 'cancelacion' | 'retiro';
  readonly quienesAutorizan?: readonly QuienAutoriza[];
  /** El `id` del campo del PIN: dos formularios en una pantalla no lo comparten. */
  readonly idDelCampo: string;
  /**
   * DP-14.2 · El descuento exacto que se autoriza, en centavos: la firma lo lleva y el servidor
   * no la acepta para otro monto.
   */
  readonly montoCentavos?: number;
  readonly alAutorizar: (autorizada: Autorizada) => void;
}) {
  const [leidos, setLeidos] = useState<readonly QuienAutoriza[] | null>(null);
  const lista = quienesAutorizan ?? leidos;
  const [elegido, setElegido] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  // DP-14.6 · Con el PIN bloqueado, cuánto falta: el botón no se puede tocar hasta entonces.
  const [restan, setRestan] = useState(0);
  const supervisor = elegido ?? lista?.[0]?.empleoId ?? null;

  useEffect(() => {
    if (restan <= 0) return undefined;
    const reloj = window.setTimeout(() => {
      setRestan((n) => n - 1);
    }, 1_000);
    return () => {
      window.clearTimeout(reloj);
    };
  }, [restan]);

  useEffect(() => {
    if (quienesAutorizan !== undefined) return;
    const control = new AbortController();
    invocarComando<{ readonly quienesAutorizan: readonly QuienAutoriza[] }>(
      '/api/venta/tope-de-descuento',
      {},
      { signal: control.signal },
    )
      .then((leido) => {
        if (!control.signal.aborted) setLeidos(leido.quienesAutorizan);
      })
      .catch((error: unknown) => {
        if (!control.signal.aborted) {
          setFallo(mensajeDe(error, 'No se pudo leer quién autoriza.'));
          setLeidos([]);
        }
      });
    return () => {
      control.abort();
    };
  }, [quienesAutorizan]);

  async function autorizar(): Promise<void> {
    if (supervisor === null || pin.length < 4 || restan > 0 || ocupado) return;
    setOcupado(true);
    setFallo(null);
    try {
      const respuesta = await invocarComando<{
        autorizacion: string;
        topeCentavos?: string;
        topeBp?: number;
      }>('/api/identidad/supervisor', {
        empleoId: supervisor,
        pin,
        ...(ordenId === undefined ? {} : { ordenId }),
        para,
        ...(montoCentavos === undefined ? {} : { montoCentavos }),
      });
      const nombre = lista?.find((q) => q.empleoId === supervisor)?.nombre ?? '';
      alAutorizar({
        token: respuesta.autorizacion,
        nombre,
        ...(respuesta.topeCentavos === undefined || respuesta.topeBp === undefined
          ? {}
          : { tope: { topeCentavos: respuesta.topeCentavos, topeBp: respuesta.topeBp } }),
      });
    } catch (error: unknown) {
      const espera = esperaDelBloqueo(error);
      if (espera !== null) setRestan(espera);
      setFallo(mensajeDe(error, 'No se pudo autorizar.'));
    } finally {
      setPin('');
      setOcupado(false);
    }
  }

  if (lista === null) return <Esqueleto className="h-24 w-full rounded-lg" />;
  if (lista.length === 0) {
    return (
      <Vacio
        icono={<KeyRound />}
        titulo="No hay quién autorice."
        explicacion={fallo ?? 'Este negocio no tiene gerente ni dueño con PIN.'}
      />
    );
  }
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <fieldset>
        <legend className="mb-(--espacio-2) text-sm font-medium">Quién autoriza</legend>
        <div className="flex flex-wrap gap-(--espacio-2)">
          {lista.map((q) => (
            <Button
              key={q.empleoId}
              type="button"
              size="sm"
              variant={supervisor === q.empleoId ? 'default' : 'outline'}
              aria-pressed={supervisor === q.empleoId}
              onClick={() => {
                setElegido(q.empleoId);
              }}
            >
              {q.nombre}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-end gap-(--espacio-2)">
        <div className="flex flex-1 flex-col gap-(--espacio-1)">
          <Label htmlFor={idDelCampo}>PIN de quien autoriza</Label>
          <Input
            id={idDelCampo}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(evento) => {
              setPin(evento.target.value.replace(/\D/g, ''));
            }}
            onKeyDown={(evento) => {
              // DP-14.6 · Enter envía, como en la pantalla de entrar. No es un `form`: este campo
              // vive dentro del formulario del descuento, y Enter lo aplicaría sin autorización.
              if (evento.key !== 'Enter') return;
              evento.preventDefault();
              void autorizar();
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={ocupado || supervisor === null || pin.length < 4 || restan > 0}
          cargando={ocupado}
          onClick={() => {
            void autorizar();
          }}
        >
          <KeyRound aria-hidden="true" />
          Autorizar
        </Button>
      </div>
      {fallo === null ? null : (
        <Aviso tono="peligro" titulo={fallo}>
          {restan > 0 ? `Se puede intentar otra vez en ${String(restan)} s.` : null}
        </Aviso>
      )}
    </div>
  );
}
