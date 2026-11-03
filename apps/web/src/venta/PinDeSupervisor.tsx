'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';
import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';

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
}

function mensajeDe(fallo: unknown, porDefecto: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porDefecto;
}

export function PinDeSupervisor({
  ordenId,
  para,
  quienesAutorizan,
  idDelCampo,
  alAutorizar,
}: {
  readonly ordenId: string;
  readonly para: 'descuento' | 'cancelacion';
  readonly quienesAutorizan?: readonly QuienAutoriza[];
  /** El `id` del campo del PIN: dos formularios en una pantalla no lo comparten. */
  readonly idDelCampo: string;
  readonly alAutorizar: (autorizada: Autorizada) => void;
}) {
  const [leidos, setLeidos] = useState<readonly QuienAutoriza[] | null>(null);
  const lista = quienesAutorizan ?? leidos;
  const [elegido, setElegido] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const supervisor = elegido ?? lista?.[0]?.empleoId ?? null;

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
    if (supervisor === null || pin.length < 4) return;
    setOcupado(true);
    setFallo(null);
    try {
      const respuesta = await invocarComando<{ autorizacion: string }>(
        '/api/identidad/supervisor',
        { empleoId: supervisor, pin, ordenId, para },
      );
      const nombre = lista?.find((q) => q.empleoId === supervisor)?.nombre ?? '';
      alAutorizar({ token: respuesta.autorizacion, nombre });
    } catch (error: unknown) {
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
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={ocupado || supervisor === null || pin.length < 4}
          cargando={ocupado}
          onClick={() => {
            void autorizar();
          }}
        >
          <KeyRound aria-hidden="true" />
          Autorizar
        </Button>
      </div>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}
