'use client';

import { Aviso, EsqueletoDeLista, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import { ChartNoAxesColumn } from 'lucide-react';
import { useState } from 'react';

import { invocarComando } from '~/cliente/api';

import {
  cantidadConUnidad,
  cuentasDichas,
  hayDevoluciones,
  losVisibles,
  pesosDe,
  PLATILLOS_VISIBLES,
  type LoMasVendidoDelServidor,
} from './lo-mas-vendido-del-servidor.ts';

/**
 * DP-22 · «LO MÁS VENDIDO» en Registros (DP-D160): para el periodo que se eligió arriba, qué platillos
 * dejaron más (piezas o kilos, e importe; lo devuelto resta) y quién vendió (cuentas, venta y propina).
 * Lo suma el SERVIDOR (`registros.lo_mas_vendido`): el periodo entero, sin tope de filas, por día del
 * negocio y sin lo anulado ni lo cancelado. La pantalla sólo pide y enseña.
 */

type Vista = 'platillos' | 'meseros';

const VISTAS: readonly (readonly [Vista, string])[] = [
  ['platillos', 'Por platillo'],
  ['meseros', 'Por mesero'],
];

const CLASE_DE_BOTON =
  'min-h-[max(2.75rem,var(--altura-control))] rounded-md border px-(--espacio-3) text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-anillo/60';

export function LoMasVendido({
  peticion,
}: {
  readonly peticion: { readonly desde: string; readonly hasta: string };
}) {
  const [vista, setVista] = useState<Vista>('platillos');
  const [verTodos, setVerTodos] = useState(false);
  const lectura = useQuery({
    queryKey: ['registros_lo_mas_vendido', peticion],
    queryFn: ({ signal }) =>
      invocarComando<LoMasVendidoDelServidor>('/api/registros/lo-mas-vendido', peticion, {
        signal,
      }),
    placeholderData: (anterior) => anterior,
  });
  const datos = lectura.data;

  return (
    <Superficie
      como="section"
      aria-labelledby="lo-mas-vendido-titulo"
      className="flex flex-col gap-(--espacio-3)"
    >
      <div className="flex flex-wrap items-center justify-between gap-(--espacio-2)">
        <h2 id="lo-mas-vendido-titulo" className="text-base font-semibold">
          Lo más vendido
        </h2>
        <div role="group" aria-label="Cómo verlo" className="flex gap-(--espacio-2)">
          {VISTAS.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={vista === id}
              onClick={() => {
                setVista(id);
              }}
              className={`${CLASE_DE_BOTON} ${vista === id ? 'border-primario bg-primario text-primario-texto' : 'border-borde-fuerte bg-superficie'}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-texto-sutil">
        Del periodo de arriba. No cuenta lo cancelado ni lo anulado; lo devuelto resta.
      </p>
      {lectura.isPending ? (
        <EsqueletoDeLista filas={4} />
      ) : lectura.isError || datos === undefined ? (
        <Aviso
          tono="peligro"
          titulo="No se pudo leer lo más vendido. Vuelve a elegir el periodo."
        />
      ) : vista === 'platillos' ? (
        <PorPlatillo datos={datos} verTodos={verTodos} onVerTodos={setVerTodos} />
      ) : (
        <PorMesero datos={datos} />
      )}
    </Superficie>
  );
}

function PorPlatillo({
  datos,
  verTodos,
  onVerTodos,
}: {
  readonly datos: LoMasVendidoDelServidor;
  readonly verTodos: boolean;
  readonly onVerTodos: (valor: boolean) => void;
}) {
  if (datos.platillos.length === 0)
    return (
      <Vacio
        tamano="compacto"
        icono={<ChartNoAxesColumn />}
        titulo="No hay ventas en este periodo."
      />
    );
  const conDevoluciones = hayDevoluciones(datos);
  const filas = losVisibles(datos.platillos, verTodos);
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <ol className="flex flex-col divide-y divide-borde" data-prueba="lo-mas-vendido-platillos">
        {filas.map((p, i) => (
          <li
            key={`${p.nombre}-${String(i)}`}
            className="flex items-baseline justify-between gap-(--espacio-3) py-(--espacio-2) text-sm"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">
                {i + 1}. {p.nombre}
              </span>
              <span className="text-xs text-texto-sutil">
                {cantidadConUnidad(p.cantidad, p.unidad)}
                {p.devueltoCentavos !== '0'
                  ? ` · devuelto ${cantidadConUnidad(p.devueltoCantidad, p.unidad)}`
                  : ''}
              </span>
            </span>
            <span className="shrink-0 text-right font-medium tabular-nums">
              {pesosDe(p.netoCentavos)}
            </span>
          </li>
        ))}
      </ol>
      {datos.platillos.length > PLATILLOS_VISIBLES && (
        <button
          type="button"
          onClick={() => {
            onVerTodos(!verTodos);
          }}
          className={`${CLASE_DE_BOTON} self-start border-borde-fuerte`}
        >
          {verTodos ? 'Ver los primeros' : `Ver los ${String(datos.platillos.length)}`}
        </button>
      )}
      <p className="text-xs text-texto-sutil">
        Vendido {pesosDe(datos.vendidoCentavos)}
        {conDevoluciones ? ` · devuelto ${pesosDe(datos.devueltoCentavos)}` : ''} · queda{' '}
        {pesosDe(datos.netoCentavos)}. La venta del periodo ({pesosDe(datos.cuentas.ventasCentavos)}
        ) suma además los descuentos e impuestos de las cuentas (
        {pesosDe(datos.cuentas.ajusteCentavos)}
        ).
      </p>
    </div>
  );
}

function PorMesero({ datos }: { readonly datos: LoMasVendidoDelServidor }) {
  if (datos.meseros.length === 0)
    return (
      <Vacio
        tamano="compacto"
        icono={<ChartNoAxesColumn />}
        titulo="No hay cuentas cobradas en este periodo."
      />
    );
  return (
    <ol className="flex flex-col divide-y divide-borde" data-prueba="lo-mas-vendido-meseros">
      {datos.meseros.map((m, i) => (
        <li
          key={`${m.nombre ?? 'sin'}-${String(i)}`}
          className="flex items-baseline justify-between gap-(--espacio-3) py-(--espacio-2) text-sm"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{m.nombre ?? 'Sin mesero'}</span>
            <span className="text-xs text-texto-sutil">
              {cuentasDichas(m.cuentas)} · propina {pesosDe(m.propinaCentavos)}
            </span>
          </span>
          <span className="shrink-0 text-right font-medium tabular-nums">
            {pesosDe(m.ventaCentavos)}
          </span>
        </li>
      ))}
    </ol>
  );
}
