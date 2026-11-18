'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Dinero } from '@morphiqpos/ui/sistema';
import { Minus, Plus } from 'lucide-react';

import {
  DENOMINACIONES,
  MAXIMO_DE_PIEZAS,
  piezasDe,
  sumaDelConteo,
  type Denominacion,
  type PiezasContadas,
} from './conteo-por-denominacion';

/**
 * DP-D178 · «CONTAR POR BILLETES Y MONEDAS» en el cierre de la caja.
 *
 * Una fila por denominación, con su «−» y su «+» de 44 px y el número de piezas que también se
 * puede teclear (teclado numérico). Cada fila dice cuánto suma y abajo va el total, que es lo que
 * el cierre toma como efectivo contado: el conteo no puede no sumar. Controlado: quien lo monta
 * guarda las piezas.
 */

export interface ConteoPorDenominacionProps {
  readonly piezas: PiezasContadas;
  readonly onCambiar: (piezas: PiezasContadas) => void;
}

interface FilaProps {
  readonly denominacion: Denominacion;
  readonly n: number;
  readonly onPoner: (n: number) => void;
}

/** Una denominación: su nombre, «−», las piezas, «+» y lo que suma. */
function FilaDeDenominacion({ denominacion: d, n, onPoner }: FilaProps) {
  const id = `piezas-${String(d.centavos)}`;
  return (
    <li className="flex items-center gap-(--espacio-2)">
      <label htmlFor={id} className="w-28 text-sm font-semibold">
        {d.etiqueta}
        <span className="block text-xs font-normal text-texto-sutil">
          {d.tipo === 'billete' ? 'billetes' : 'monedas'}
        </span>
      </label>
      <Button
        type="button"
        variant="outline"
        className="size-(--altura-tactil) shrink-0 p-0"
        aria-label={`Una pieza menos de ${d.etiqueta}`}
        disabled={n <= 0}
        onClick={() => {
          onPoner(n - 1);
        }}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="h-(--altura-tactil) w-20 text-center text-lg font-bold tabular-nums"
        value={n === 0 ? '' : String(n)}
        placeholder="0"
        onFocus={(e) => {
          // Once filas son más alto que lo que el teclado en pantalla deja ver: el campo que se toca se
          // trae al centro para que no quede debajo del teclado.
          e.currentTarget.scrollIntoView({ block: 'center' });
        }}
        onChange={(e) => {
          onPoner(piezasDe(e.target.value));
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="size-(--altura-tactil) shrink-0 p-0"
        aria-label={`Una pieza más de ${d.etiqueta}`}
        onClick={() => {
          onPoner(n + 1);
        }}
      >
        <Plus aria-hidden="true" />
      </Button>
      <span className="ml-auto text-sm text-texto-sutil">
        <Dinero centavos={d.centavos * n} />
      </span>
    </li>
  );
}

export function ConteoPorDenominacion({ piezas, onCambiar }: ConteoPorDenominacionProps) {
  const poner = (centavos: number, n: number): void => {
    const siguiente = Math.max(0, Math.min(MAXIMO_DE_PIEZAS, n));
    onCambiar({ ...piezas, [centavos]: siguiente });
  };
  return (
    <div
      role="group"
      aria-label="Conteo por billetes y monedas"
      className="mt-(--espacio-3) flex flex-col gap-(--espacio-2)"
    >
      <ul className="flex flex-col gap-(--espacio-1)">
        {DENOMINACIONES.map((d) => (
          <FilaDeDenominacion
            key={d.centavos}
            denominacion={d}
            n={piezas[d.centavos] ?? 0}
            onPoner={(n) => {
              poner(d.centavos, n);
            }}
          />
        ))}
      </ul>
      <p className="flex items-center justify-between border-t pt-(--espacio-2) text-base font-black">
        <span>Total contado</span>
        <span data-total-del-conteo={sumaDelConteo(piezas)}>
          <Dinero centavos={sumaDelConteo(piezas)} />
        </span>
      </p>
    </div>
  );
}
