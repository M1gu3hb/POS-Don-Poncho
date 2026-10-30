import { GraficaDeDona, Superficie, Vacio, dineroEnTexto } from '@morphiqpos/ui/sistema';
import type { ReactElement } from 'react';

import { ErrorDeLectura, EsqueletoDeFilas } from '~/cliente/EstadosDeCarga';

import type { MetodoConVentas } from './cifras-del-dia.ts';

/**
 * LA DONA DE MÉTODOS DE PAGO · de qué se compone lo cobrado hoy (DP-11.4).
 *
 * Reemplaza a la dona de recharts del tablero, que traía sus colores y su tooltip en hex
 * escritos en línea y dos versiones, una por modo. Esta es la dona del sistema: sus porciones
 * llevan `--grafico-1..6` del estilo activo, el total va al centro y cada porción dice su
 * importe al pasar el dedo o al leerla con un lector de pantalla.
 *
 * Las porciones son los métodos que cobraron algo (`metodosConVentas`); las tarjetas de arriba
 * llevan, por su lugar en esa misma lista, el color de la suya.
 */

export interface DonaDeMetodosDePagoProps {
  readonly metodos: readonly MetodoConVentas[];
  /** Las ventas aún no llegan: se espera con el alto que tendrá la dona. */
  readonly cargando: boolean;
  /** La lectura de las ventas falló y no hay ningún dato anterior. */
  readonly fallo: boolean;
  readonly alReintentar: () => void;
}

const TITULO = 'Métodos de pago — hoy';

export function DonaDeMetodosDePago({
  metodos,
  cargando,
  fallo,
  alReintentar,
}: DonaDeMetodosDePagoProps): ReactElement {
  return (
    <Superficie como="section" aria-labelledby="titulo-metodos-de-pago">
      <h2 id="titulo-metodos-de-pago" className="mb-(--espacio-3) text-sm font-semibold">
        {TITULO}
      </h2>
      {cargando ? (
        <EsqueletoDeFilas filas={5} />
      ) : fallo ? (
        <ErrorDeLectura queNoSePudoLeer="los métodos de pago" alReintentar={alReintentar} />
      ) : metodos.length === 0 ? (
        <Vacio tamano="compacto" titulo="Sin ventas hoy" />
      ) : (
        <GraficaDeDona
          titulo={TITULO}
          formato={dineroEnTexto}
          partes={metodos.map((metodo) => ({ etiqueta: metodo.etiqueta, valor: metodo.centavos }))}
        />
      )}
    </Superficie>
  );
}
