import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie, Tabla, Vacio, type ColumnaDeTabla } from '@morphiqpos/ui/sistema';
import { AlertTriangle, ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { StockStatusBadge } from '@/components/common/StatusBadge';
import { ErrorDeLectura, EsqueletoDeFilas } from '~/cliente/EstadosDeCarga';

/**
 * LAS ALERTAS DE INVENTARIO · lo que se acaba, en una tabla (DP-11.4).
 *
 * Eran filas hechas a mano con un fondo gris por fila; ahora es la `Tabla` del sistema, que
 * ya trae cabecera fija, cifras tabulares y su propio scroll. El estado de cada ingrediente
 * sigue diciéndose con su etiqueta —«Agotado», «Crítico», «Bajo»— además de su color.
 */

/** Un ingrediente en alerta: lo que el tablero ya calculó con `getStockStatus`. */
export interface IngredienteEnAlerta {
  readonly id: string;
  readonly nombre: string;
  readonly stock_actual: number;
  readonly unidad_base: string;
  /** `agotado`, `critico` o `bajo`. */
  readonly stockStatus: string;
}

const COLUMNAS: readonly ColumnaDeTabla<IngredienteEnAlerta>[] = [
  {
    clave: 'nombre',
    titulo: 'Ingrediente',
    celda: (ingrediente) => <span className="font-medium">{ingrediente.nombre}</span>,
  },
  {
    clave: 'existencia',
    titulo: 'Existencia',
    numerica: true,
    // La existencia se enseña tal cual la lleva el inventario, sin redondearla.
    celda: (ingrediente) => (
      <span className="font-numeros tabular-nums">
        {ingrediente.stock_actual} {ingrediente.unidad_base}
      </span>
    ),
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    celda: (ingrediente) => <StockStatusBadge status={ingrediente.stockStatus} />,
  },
];

export interface AlertasDeInventarioProps {
  readonly ingredientes: readonly IngredienteEnAlerta[];
  readonly cargando: boolean;
  /** La lectura de los ingredientes falló y no hay ningún dato anterior. */
  readonly fallo: boolean;
  readonly alReintentar: () => void;
}

export function AlertasDeInventario({
  ingredientes,
  cargando,
  fallo,
  alReintentar,
}: AlertasDeInventarioProps): ReactElement {
  return (
    <Superficie como="section" aria-labelledby="titulo-alertas-de-inventario">
      <div className="mb-(--espacio-3) flex items-center justify-between gap-(--espacio-2)">
        <h2
          id="titulo-alertas-de-inventario"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <AlertTriangle className="size-4 text-advertencia" aria-hidden="true" />
          Alertas de inventario
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inventario">
            Ver todo <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {cargando ? (
        <EsqueletoDeFilas filas={3} />
      ) : fallo ? (
        <ErrorDeLectura queNoSePudoLeer="el inventario" alReintentar={alReintentar} />
      ) : ingredientes.length === 0 ? (
        <Vacio
          tamano="compacto"
          tono="exito"
          icono={<Package />}
          titulo="Inventario en buen estado"
        />
      ) : (
        <Tabla
          etiqueta="Ingredientes agotados, críticos o bajos"
          columnas={COLUMNAS}
          filas={ingredientes}
          claveDe={(ingrediente) => ingrediente.id}
          alto="max-h-60"
        />
      )}
    </Superficie>
  );
}
