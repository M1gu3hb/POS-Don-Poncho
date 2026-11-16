'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import {
  Aviso,
  Dinero,
  Esqueleto,
  GraficaDeBarras,
  Superficie,
  dineroEnTexto,
} from '@morphiqpos/ui/sistema';
import { BarChart3 } from 'lucide-react';

import { invocarComando } from '~/cliente/api';

import {
  detalleDeLaBarra,
  diferenciaEnPalabras,
  margenEnTexto,
  NOMBRE_DE_LA_REFERENCIA,
  PERIODOS_PARA_ELEGIR,
  seriesDeLaGrafica,
  type Periodo,
  type SerieDelServidor,
} from './serie-del-tablero.ts';

/**
 * «¿CÓMO VA TU SEMANA?» (DP-21 · Bloque 13 · M7 y M8): la gráfica del Tablero.
 *
 * Por omisión, las barras de lunes a domingo de esta semana con la semana pasada como referencia;
 * los días sin venta salen en cero. Los filtros Hoy (por hora), Este mes (por día) y Este año (por
 * mes) y el interruptor «Ver gastos y utilidad», apagado, con el desglose de antes.
 *
 * Todo lo suma el SERVIDOR (`tablero.serie`): centavos enteros y el día del negocio, sin traer filas
 * al navegador ni truncar. Los colores son los del estilo (`--grafico-n`: claro, oscuro y motor
 * viejo, sin `color-mix`), y no anima nada: en modo ligero tampoco hay qué apagar.
 */
export function ComoVaTuSemana(): ReactElement {
  const titulo = useId();
  const idInterruptor = useId();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [conGastosYUtilidad, setConGastosYUtilidad] = useState(false);
  const consulta = useQuery({
    queryKey: ['tablero_serie', periodo],
    queryFn: ({ signal }) =>
      invocarComando<SerieDelServidor>('/api/tablero/serie', { periodo }, { signal }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const serie = consulta.data;

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-wrap items-center justify-between gap-(--espacio-3)">
        <h2 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <BarChart3 aria-hidden className="size-5 shrink-0 text-primario" />
          ¿Cómo va tu semana?
        </h2>
        <div role="group" aria-label="Periodo" className="flex flex-wrap gap-(--espacio-2)">
          {PERIODOS_PARA_ELEGIR.map((p) => (
            <Button
              key={p.clave}
              type="button"
              size="sm"
              variant={periodo === p.clave ? 'default' : 'outline'}
              aria-pressed={periodo === p.clave}
              onClick={() => {
                setPeriodo(p.clave);
              }}
            >
              {p.nombre}
            </Button>
          ))}
        </div>
      </div>

      {serie === undefined ? (
        consulta.isError ? (
          <Aviso tono="peligro" titulo="No se pudo leer el tablero.">
            <p>Recarga la página; si sigue igual, avisa a tu proveedor.</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-56 w-full rounded-lg" />
        )
      ) : (
        <Contenido
          serie={serie}
          conGastosYUtilidad={conGastosYUtilidad}
          idInterruptor={idInterruptor}
          alCambiarElInterruptor={setConGastosYUtilidad}
        />
      )}
    </Superficie>
  );
}

function Contenido({
  serie,
  conGastosYUtilidad,
  idInterruptor,
  alCambiarElInterruptor,
}: {
  readonly serie: SerieDelServidor;
  readonly conGastosYUtilidad: boolean;
  readonly idInterruptor: string;
  readonly alCambiarElInterruptor: (valor: boolean) => void;
}): ReactElement {
  const { ejes, series } = seriesDeLaGrafica(serie, conGastosYUtilidad);
  const nombreDeLaReferencia = NOMBRE_DE_LA_REFERENCIA[serie.periodo];
  const t = serie.totales;
  const margen = margenEnTexto(t);
  const diferenciaTotal =
    t.referencia === null
      ? null
      : diferenciaEnPalabras(
          String(Number(t.ventasCentavos) - Number(t.referencia.ventasCentavos)),
        );

  return (
    <>
      <ul className="flex flex-wrap gap-x-(--espacio-6) gap-y-(--espacio-2)">
        <li className="flex flex-col">
          <span className="text-xs text-texto-sutil">Ventas</span>
          <Dinero centavos={Number(t.ventasCentavos)} tamano="lg" />
        </li>
        <li className="flex flex-col">
          <span className="text-xs text-texto-sutil">Ticket promedio</span>
          <Dinero centavos={Number(t.ticketPromedioCentavos)} tamano="lg" />
        </li>
        <li className="flex flex-col">
          <span className="text-xs text-texto-sutil">Cuentas</span>
          <span className="text-lg font-semibold">{t.cuentas}</span>
        </li>
        {diferenciaTotal === null || nombreDeLaReferencia === null ? null : (
          <li className="flex flex-col">
            <span className="text-xs text-texto-sutil">{nombreDeLaReferencia}</span>
            <span className="text-sm font-medium" data-diferencia-total>
              {diferenciaTotal.replace('la referencia', nombreDeLaReferencia.toLowerCase())}
            </span>
          </li>
        )}
      </ul>

      <GraficaDeBarras
        titulo="Ventas por periodo, con la referencia"
        ejes={ejes}
        series={series}
        formato={(v) => dineroEnTexto(v)}
        detalle={(indiceSerie, columna) => {
          const fila = serie.filas[columna];
          const cual = series[indiceSerie];
          if (fila === undefined || cual === undefined) return '';
          if (cual.etiqueta === 'Gastos' || cual.etiqueta.startsWith('Utilidad')) {
            return `${cual.etiqueta} · ${fila.etiqueta}: ${dineroEnTexto(cual.valores[columna] ?? 0)}`;
          }
          return detalleDeLaBarra(
            serie,
            fila,
            cual.etiqueta,
            cual.etiqueta === nombreDeLaReferencia,
          );
        }}
      />

      <div className="flex items-center gap-(--espacio-3)">
        <Switch
          id={idInterruptor}
          checked={conGastosYUtilidad}
          onCheckedChange={alCambiarElInterruptor}
        />
        <label htmlFor={idInterruptor} className="text-sm font-medium">
          Ver gastos y utilidad
        </label>
      </div>

      {conGastosYUtilidad ? (
        <section aria-label="Gastos y utilidad" className="flex flex-col gap-(--espacio-3)">
          <ul className="grid grid-cols-2 gap-(--espacio-3) sm:grid-cols-3 lg:grid-cols-6">
            <Cifra rotulo="Ventas" valor={<Dinero centavos={Number(t.ventasCentavos)} />} />
            <Cifra
              rotulo="Costo"
              valor={t.sinCostoConocido ? '—' : <Dinero centavos={Number(t.costoCentavos)} />}
            />
            <Cifra
              rotulo="Utilidad bruta"
              valor={
                t.sinCostoConocido ? '—' : <Dinero centavos={Number(t.utilidadBrutaCentavos)} />
              }
            />
            <Cifra rotulo="Gastos" valor={<Dinero centavos={Number(t.gastosCentavos)} />} />
            <Cifra
              rotulo="Utilidad neta"
              valor={
                t.sinCostoConocido ? '—' : <Dinero centavos={Number(t.utilidadNetaCentavos)} />
              }
            />
            <Cifra rotulo="Margen" valor={margen ?? '—'} />
          </ul>
          {t.sinReceta + t.recetaIncompleta > 0 ? (
            <p className="text-xs text-texto-sutil" data-ventas-sin-receta>
              {t.sinReceta + t.recetaIncompleta} cuentas sin costo completo (sin receta o con receta
              incompleta): su importe está en «Ventas», pero no entra en el costo, la utilidad ni el
              margen.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Cifra({
  rotulo,
  valor,
}: {
  readonly rotulo: string;
  readonly valor: ReactElement | string;
}): ReactElement {
  return (
    <li className="flex flex-col rounded-lg border border-borde p-(--espacio-2)">
      <span className="text-xs text-texto-sutil">{rotulo}</span>
      <span className="text-sm font-semibold">{valor}</span>
    </li>
  );
}
