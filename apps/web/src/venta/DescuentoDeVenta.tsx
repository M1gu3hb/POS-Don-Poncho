'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, CampoDeDinero, Dinero, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';
import { BadgePercent, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';

import { PinDeSupervisor } from './PinDeSupervisor';

/**
 * EL DESCUENTO, CON LA CLAVE DE QUIEN LO AUTORIZA (F-205; DP-14.2, decisión DP-D61).
 *
 * La cajera escribe cuánto —en pesos o en porcentaje— y por qué, y un gerente, administrador o
 * dueño teclea SU PIN aquí mismo, sin cerrar la sesión de nadie: TODO descuento lo pide, aunque
 * sea de $1, y si quien tiene la sesión es gerente o dueño vuelve a teclear el suyo. El servidor
 * lo comprueba como al entrar y devuelve una autorización de dos minutos firmada para ESTA cuenta
 * y por ESTE monto: si la cajera cambia el monto, hay que autorizar otra vez. El límite es el
 * tope del puesto de quien autoriza, y el servidor lo vuelve a comprobar al aplicar.
 */

export interface DescuentoElegido {
  readonly centavos: number;
  readonly motivo: string;
  /** La autorización firmada (desde DP-14.2 la lleva todo descuento). */
  readonly autorizacion?: string;
  /** Quién la dio, para decirlo en la pantalla. */
  readonly autorizo?: string;
}

interface Tope {
  readonly topeCentavos: string;
  readonly topeBp: number;
  readonly quienesAutorizan: readonly { readonly empleoId: string; readonly nombre: string }[];
}

/** «10» o «12.5» por ciento a puntos base; `null` si no es un porcentaje. */
export function puntosBaseDe(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(limpio)) return null;
  const [entero = '0', decimal = ''] = limpio.split('.');
  const bp = Number(entero) * 100 + Number(decimal.padEnd(2, '0'));
  return bp > 0 && bp < 10_000 ? bp : null;
}

/** El porcentaje sobre la base, en centavos, redondeando la mitad hacia arriba. */
export function centavosDePorcentaje(base: number, bp: number): number {
  return Number((BigInt(base) * BigInt(bp) + 5_000n) / 10_000n);
}

function mensajeDe(fallo: unknown, porDefecto: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porDefecto;
}

export function DescuentoDeVenta({
  ordenId,
  base,
  onAplicar,
}: {
  /** DP-13.2 · La cuenta que se descuenta: la autorización del supervisor va atada a ella. */
  readonly ordenId: string;
  /** Lo que vale la venta antes del descuento, en centavos. */
  readonly base: number;
  readonly onAplicar: (descuento: DescuentoElegido) => void;
}) {
  const [tope, setTope] = useState<Tope | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [modo, setModo] = useState<'importe' | 'porcentaje'>('importe');
  const [importe, setImporte] = useState<number | null>(null);
  const [porcentaje, setPorcentaje] = useState('');
  const [motivo, setMotivo] = useState('');
  const [autorizacion, setAutorizacion] = useState<{ token: string; nombre: string } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    invocarComando<Tope>('/api/venta/tope-de-descuento', {}, { signal: control.signal })
      .then((leido) => {
        if (control.signal.aborted) return;
        setTope(leido);
      })
      .catch((error: unknown) => {
        if (!control.signal.aborted) setFallo(mensajeDe(error, 'No se pudo leer tu tope.'));
      });
    return () => {
      control.abort();
    };
  }, []);

  const bp = puntosBaseDe(porcentaje);
  const centavos =
    modo === 'importe' ? (importe ?? 0) : bp === null ? 0 : centavosDePorcentaje(base, bp);
  const valido = centavos > 0 && centavos < base;

  if (tope === null) {
    return fallo === null ? (
      <Esqueleto className="h-40 w-full rounded-lg" />
    ) : (
      <Aviso tono="peligro" titulo={fallo} />
    );
  }

  const listo = valido && motivo.trim().length >= 4 && autorizacion !== null;

  return (
    <form
      className="flex flex-col gap-(--espacio-3)"
      onSubmit={(evento) => {
        evento.preventDefault();
        // `listo` ya exige la autorización: TypeScript la sabe no nula aquí.
        if (!listo) return;
        onAplicar({
          centavos,
          motivo: motivo.trim(),
          autorizacion: autorizacion.token,
          autorizo: autorizacion.nombre,
        });
      }}
    >
      <div
        role="group"
        aria-label="Cómo se descuenta"
        className="grid grid-cols-2 gap-(--espacio-2)"
      >
        {(['importe', 'porcentaje'] as const).map((opcion) => (
          <Button
            key={opcion}
            type="button"
            size="sm"
            variant={modo === opcion ? 'default' : 'outline'}
            aria-pressed={modo === opcion}
            onClick={() => {
              setModo(opcion);
              setAutorizacion(null);
            }}
          >
            {opcion === 'importe' ? 'En pesos' : 'En porcentaje'}
          </Button>
        ))}
      </div>
      {modo === 'importe' ? (
        <div className="flex flex-col gap-(--espacio-1)">
          <Label htmlFor="descuento-importe">Cuánto se descuenta</Label>
          <CampoDeDinero
            id="descuento-importe"
            autoFocus
            centavos={importe}
            alCambiar={(valor) => {
              setImporte(valor);
              setAutorizacion(null);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-(--espacio-1)">
          <Label htmlFor="descuento-porcentaje">Porcentaje</Label>
          <Input
            id="descuento-porcentaje"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="10"
            value={porcentaje}
            onChange={(evento) => {
              setPorcentaje(evento.target.value);
              setAutorizacion(null);
            }}
          />
        </div>
      )}
      <p
        className="flex items-baseline justify-between gap-(--espacio-2) text-sm"
        aria-live="polite"
      >
        <span className="text-texto-sutil">Queda en</span>
        <Dinero centavos={base - (valido ? centavos : 0)} tamano="lg" />
      </p>
      <div className="flex flex-col gap-(--espacio-1)">
        <Label htmlFor="descuento-motivo">Por qué</Label>
        <Input
          id="descuento-motivo"
          placeholder="cliente frecuente · producto golpeado"
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-(--espacio-2)">
        <Aviso
          tono="atencion"
          titulo="Todo descuento lo autoriza un gerente, administrador o dueño con su PIN."
        />
        {tope.quienesAutorizan.length === 0 ? (
          <Vacio
            icono={<KeyRound />}
            titulo="No hay quién autorice."
            explicacion="Este negocio no tiene gerente, administrador ni dueño con PIN: no se puede descontar."
          />
        ) : !valido ? null : autorizacion === null ? (
          // DP-13.2 (D-5) y DP-14.2: firmada para ESTA cuenta, para un descuento y por ESTE monto.
          <PinDeSupervisor
            key={centavos}
            ordenId={ordenId}
            para="descuento"
            montoCentavos={centavos}
            quienesAutorizan={tope.quienesAutorizan}
            idDelCampo="descuento-pin"
            alAutorizar={setAutorizacion}
          />
        ) : (
          <Aviso tono="exito" titulo={`Autorizó ${autorizacion.nombre}.`} />
        )}
      </div>

      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}

      <Button type="submit" disabled={!listo}>
        <BadgePercent aria-hidden="true" />
        Aplicar el descuento
      </Button>
    </form>
  );
}
