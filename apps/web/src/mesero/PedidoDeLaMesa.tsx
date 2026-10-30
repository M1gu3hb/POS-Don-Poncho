'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Dinero, Superficie, Tabla, Vacio, type ColumnaDeTabla } from '@morphiqpos/ui/sistema';
import { Receipt, Send } from 'lucide-react';
import { useMemo, type ReactElement, type ReactNode } from 'react';

import { centavosDe } from '../cliente/dinero-del-puente';

import type { AlmacenDelBorrador } from './almacen-del-borrador';
import { totalDelCarritoEnCentavos, type LineaDelBorrador } from './borrador-de-la-mesa';
import { textoDe } from './texto';
import { useBorrador } from './use-borrador-de-la-mesa';

/** Una línea de lo que la mesa ya mandó a cocina, tal como la sirve el puente. */
export interface LineaYaEnviada {
  readonly id?: string | null;
  readonly producto_nombre?: string | null;
  readonly cantidad?: number | null;
  /** En PESOS, como lo sirve el puente. */
  readonly subtotal?: number | null;
}

export interface PedidoDeLaMesaProps {
  readonly borrador: AlmacenDelBorrador;
  readonly yaEnviado: readonly LineaYaEnviada[];
  /** Hay una cuenta abierta para esta mesa. */
  readonly hayCuenta: boolean;
  readonly estadoDeLaMesa: string | null | undefined;
  /** Un envío o el pedido de la cuenta están en camino: nada se vuelve a tocar. */
  readonly ocupado: boolean;
  /** Es el envío a cocina el que está en camino (y no la cuenta): el botón lo dice. */
  readonly enviando: boolean;
  readonly colorear: boolean;
  /** Cómo se pinta una línea del pedido nuevo (con su nota, sus exclusiones y sus ±). */
  readonly renderizarLinea: (linea: LineaDelBorrador) => ReactNode;
  readonly alEnviar: () => void;
  readonly alPedirCuenta: () => void;
}

interface FilaEnviada {
  readonly clave: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly centavos: number;
}

const COLUMNAS: readonly ColumnaDeTabla<FilaEnviada>[] = [
  {
    clave: 'producto',
    titulo: 'Producto',
    celda: (fila) => (
      <span className="text-texto-sutil">
        {fila.nombre} ×{fila.cantidad}
      </span>
    ),
  },
  {
    clave: 'importe',
    titulo: 'Importe',
    numerica: true,
    celda: (fila) => <Dinero centavos={fila.centavos} tamano="xs" />,
  },
];

function filasEnviadas(lineas: readonly LineaYaEnviada[]): readonly FilaEnviada[] {
  return lineas.map((d, i) => ({
    clave: textoDe(d.id, `det-d-${String(i)}`),
    nombre: textoDe(d.producto_nombre, '—'),
    cantidad: d.cantidad ?? 0,
    centavos: centavosDe('DetalleVenta', 'subtotal', d.subtotal) ?? 0,
  }));
}

/** La clave de React de cada línea: el platillo y su número de orden entre las de su platillo. */
function clavesDeLasLineas(carrito: readonly LineaDelBorrador[]): readonly string[] {
  const vistas = new Map<string, number>();
  return carrito.map((linea) => {
    const n = vistas.get(linea.id) ?? 0;
    vistas.set(linea.id, n + 1);
    return `${linea.id}-${String(n)}`;
  });
}

/**
 * LA CUENTA DE LA MESA ABIERTA, a un lado (tableta y PC): lo que ya se mandó a cocina, lo que se
 * va armando, y «Enviar a Cocina» o «Solicitar cuenta».
 *
 * Es `Superficie` nivel 3: la cuenta FLOTA junto al catálogo, que es el piso. Las líneas del pedido
 * nuevo son tarjetas sólidas apiladas con un leve desplazamiento alterno. «Enviar a Cocina» es
 * el botón principal (halo del acento y tacto) y dice su estado mientras viaja. En el teléfono
 * esta columna no se ve: la cuenta es el carrito flotante.
 */
export function PedidoDeLaMesa({
  borrador,
  yaEnviado,
  hayCuenta,
  estadoDeLaMesa,
  ocupado,
  enviando,
  colorear,
  renderizarLinea,
  alEnviar,
  alPedirCuenta,
}: PedidoDeLaMesaProps): ReactElement {
  const carrito = useBorrador(borrador, (e) => e.carrito);
  const nota = useBorrador(borrador, (e) => e.nota);
  const totalNuevo = useMemo(() => totalDelCarritoEnCentavos(carrito), [carrito]);
  const filas = useMemo(() => filasEnviadas(yaEnviado), [yaEnviado]);
  const totalEnviado = filas.reduce((suma, fila) => suma + fila.centavos, 0);
  const claves = useMemo(() => clavesDeLasLineas(carrito), [carrito]);
  const puedePedirCuenta =
    hayCuenta && carrito.length === 0 && estadoDeLaMesa !== 'cuenta_solicitada';

  return (
    <Superficie
      nivel={3}
      relleno={0}
      radio="lg"
      className="hidden w-full shrink-0 flex-col overflow-hidden md:m-(--espacio-3) md:flex md:w-72"
    >
      {filas.length > 0 ? (
        <div className="border-b px-(--espacio-4) py-(--espacio-3)">
          <p className="mb-2 text-xs font-semibold text-texto-sutil">PEDIDO ACTUAL</p>
          <Tabla
            etiqueta="Pedido actual"
            columnas={COLUMNAS}
            filas={filas}
            claveDe={(fila) => fila.clave}
            alto="max-h-32"
            pie={{
              producto: <span className="font-bold">Total:</span>,
              importe: <Dinero centavos={totalEnviado} tamano="sm" />,
            }}
          />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-(--espacio-4) py-(--espacio-3)">
        <p className="mb-2 text-xs font-semibold text-texto-sutil">
          {filas.length > 0 ? 'AGREGAR AL PEDIDO' : 'NUEVO PEDIDO'}
        </p>
        {carrito.length === 0 ? (
          <Vacio tamano="compacto" titulo="Selecciona productos" />
        ) : (
          <ul className="flex flex-col gap-(--espacio-2)">
            {carrito.map((linea, indice) => (
              <li
                key={claves[indice]}
                className={indice % 2 === 0 ? 'mr-(--espacio-2)' : 'ml-(--espacio-2)'}
              >
                {renderizarLinea(linea)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t px-(--espacio-4) py-(--espacio-3)">
        {carrito.length > 0 ? (
          <>
            <Input
              value={nota}
              onChange={(evento) => {
                borrador.ponerNota(evento.target.value);
              }}
              placeholder="Nota para cocina..."
              className="text-xs"
            />
            <div className="flex items-baseline justify-between text-sm font-bold">
              <span>Nuevo</span>
              <Dinero
                centavos={totalNuevo}
                tamano="base"
                className={colorear ? 'text-primario' : 'text-texto'}
              />
            </div>
            <Button
              type="button"
              onClick={alEnviar}
              disabled={ocupado}
              cargando={enviando}
              data-principal=""
              data-tacto=""
              className="w-full"
            >
              <Send aria-hidden="true" />
              {enviando ? 'Enviando...' : 'Enviar a Cocina'}
            </Button>
          </>
        ) : null}
        {puedePedirCuenta ? (
          <Button
            type="button"
            onClick={alPedirCuenta}
            disabled={ocupado}
            variant="outline"
            className="w-full"
          >
            <Receipt aria-hidden="true" />
            Solicitar cuenta
          </Button>
        ) : null}
      </div>
    </Superficie>
  );
}
