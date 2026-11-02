'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dinero,
  ErrorDePantalla,
  EsqueletoDeLista,
  TablaAdaptable,
  Vacio,
  type ColumnaDeTabla,
} from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import type { CancelacionDelCorte } from './cancelaciones.ts';
import { cancelacionesRegistradas } from './cancelaciones-leidas.ts';
import { filtrarCancelaciones } from './filtrar-cancelaciones.ts';

/**
 * REGISTROS · LAS CUENTAS CANCELADAS Y LOS PLATILLOS ANULADOS (DP-12.4).
 *
 * Con el mesero cancelando desde su pantalla, el historial de ventas ya no basta: una cuenta
 * cancelada salía como una venta más, con la etiqueta «cancelada», y un platillo anulado no salía.
 * Aquí van las dos cosas, con lo que el dueño pregunta: qué se canceló, quién, cuándo, por qué y
 * cuánto, y si ya estaba preparado (pérdida, marcada con palabra y con icono además del tono de la
 * fila). Es la misma lectura del servidor que arma el corte (`caja/corte/cancelaciones.ts`).
 */

const FECHA_Y_HORA = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const cuentaDe = (c: CancelacionDelCorte): string =>
  [c.mesa, c.folio].filter((parte) => parte !== null && parte !== '').join(' · ') || '—';

const COLUMNAS: readonly ColumnaDeTabla<CancelacionDelCorte>[] = [
  {
    clave: 'cuenta',
    titulo: 'Cuenta',
    celda: (c) => <span className="font-semibold">{cuentaDe(c)}</span>,
  },
  {
    clave: 'cuando',
    titulo: 'Cuándo',
    celda: (c) => (c.hora === null ? '—' : FECHA_Y_HORA.format(new Date(c.hora))),
  },
  {
    clave: 'que',
    titulo: 'Qué',
    celda: (c) => (c.tipo === 'orden' ? 'Cuenta completa' : (c.producto ?? 'Platillo')),
  },
  { clave: 'quien', titulo: 'Quién canceló', celda: (c) => c.usuario ?? '—' },
  { clave: 'motivo', titulo: 'Motivo', celda: (c) => c.motivo ?? '—' },
  {
    clave: 'importe',
    titulo: 'Importe',
    numerica: true,
    celda: (c) => <Dinero centavos={Number(c.montoCentavos)} />,
  },
  {
    clave: 'perdida',
    titulo: 'Pérdida',
    celda: (c) =>
      c.perdida ? (
        <span className="inline-flex items-center gap-(--espacio-1) font-bold text-peligro">
          <TriangleAlert aria-hidden="true" className="size-4" />
          Pérdida · ya preparado
        </span>
      ) : (
        <span className="text-texto-sutil">Antes de prepararse</span>
      ),
  },
];

export function CancelacionesRegistradas({ busqueda }: { readonly busqueda: string }) {
  const [soloPerdidas, setSoloPerdidas] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['registros_cancelaciones', { dias: 90 }],
    queryFn: () => cancelacionesRegistradas(90),
    staleTime: 5000,
  });

  if (isPending) return <EsqueletoDeLista filas={5} />;
  if (isError) {
    return (
      <ErrorDePantalla
        titulo="No se pudieron cargar las cancelaciones"
        queHacer="Revisa la conexión y vuelve a intentarlo. No se perdió nada."
        reintentar={
          <Button
            variant="outline"
            onClick={() => {
              void refetch();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }

  const filas = filtrarCancelaciones(data, { busqueda, soloPerdidas });
  return (
    <div className="flex flex-col gap-(--espacio-3)">
      <div className="flex flex-wrap items-center gap-(--espacio-2)">
        <Button
          size="sm"
          variant={soloPerdidas ? 'outline' : 'default'}
          aria-pressed={!soloPerdidas}
          onClick={() => {
            setSoloPerdidas(false);
          }}
        >
          Todas ({data.length})
        </Button>
        <Button
          size="sm"
          variant={soloPerdidas ? 'default' : 'outline'}
          aria-pressed={soloPerdidas}
          onClick={() => {
            setSoloPerdidas(true);
          }}
        >
          Sólo pérdidas ({data.filter((c) => c.perdida).length})
        </Button>
        <span className="text-xs text-texto-sutil">Últimos 90 días</span>
      </div>
      <TablaAdaptable
        etiqueta="Cuentas canceladas y platillos anulados"
        principal="cuenta"
        columnas={COLUMNAS}
        filas={filas}
        claveDe={(c) =>
          `${c.tipo}-${c.hora ?? ''}-${cuentaDe(c)}-${c.producto ?? ''}-${c.montoCentavos}`
        }
        tonoDeFila={(c) => (c.perdida ? 'peligro' : undefined)}
        alto="max-h-none"
        vacio={
          <Vacio
            tamano="compacto"
            titulo="Sin cancelaciones"
            explicacion="Aquí aparecen las cuentas canceladas y los platillos anulados."
          />
        }
      />
    </div>
  );
}
