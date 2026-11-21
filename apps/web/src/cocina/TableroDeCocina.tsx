'use client';

import { Aviso } from '@morphiqpos/ui/sistema';
import { useMemo } from 'react';

import { ColumnasDeCocina } from './ColumnasDeCocina';
import type { TarjetaDeCocinaProps } from './TarjetaDeCocina';
import type { InfoDeLaCuenta } from './encabezado-del-bloque';
import { ResumenDeProduccion } from './ResumenDeProduccion';
import { CLAVE_AMBAR, CLAVE_ROJA, umbralesDeCocina } from './espera';
import { bloquesPorColumna } from './platillos-del-tablero';
import { resumenDeProduccion } from './resumen-de-produccion';
import type { ComandaDeCocina, ItemDeCocina } from './tipos';

import { useAhora } from './use-ahora';
import { useModoCompacto } from './use-modo-compacto';

/**
 * DP-16 · 2.2 · EL TABLERO DE LA COCINA CON MUCHO VOLUMEN.
 *
 * Lo usa la pantalla `/cocina` (heredada), que sigue siendo dueña de las lecturas, los toques en
 * camino, la voz y el alcance por estación: aquí sólo se PINTA lo que ella ya decidió que se ve.
 * La tira de resumen, el modo compacto, las columnas con su propio desplazamiento, las tarjetas
 * por cuenta y el tiempo con color son de aquí.
 */

export interface TableroDeCocinaProps {
  /** Las comandas vivas que esta pantalla puede ver (ya filtradas por estación). */
  readonly comandas: readonly ComandaDeCocina[];
  /** La configuración del negocio: de ahí salen los umbrales de la espera. */
  readonly config: Readonly<Record<string, unknown>> | null | undefined;
  readonly cargando: boolean;
  /** Si la última lectura falló: se queda el último tablero conocido, con este aviso encima. */
  readonly error?: string | null;
  /** Mesero y mesa principal de cada cuenta, por `venta_id`. */
  readonly infoDeLasCuentas?: Readonly<Record<string, InfoDeLaCuenta>>;
  readonly onPlatillo: TarjetaDeCocinaProps['onPlatillo'];
  readonly onBloque: TarjetaDeCocinaProps['onBloque'];
  readonly onPedirQuitar: TarjetaDeCocinaProps['onPedirQuitar'];
  readonly onVerFicha: (item: ItemDeCocina) => void;
}

export function TableroDeCocina({
  comandas,
  config,
  cargando,
  error = null,
  ...acciones
}: TableroDeCocinaProps) {
  const ahora = useAhora();
  const [compacto, cambiarCompacto] = useModoCompacto();
  // La configuración llega como un objeto nuevo en cada lectura: importan sólo sus dos claves.
  const ambar = config?.[CLAVE_AMBAR];
  const roja = config?.[CLAVE_ROJA];
  const umbrales = useMemo(
    () => umbralesDeCocina({ [CLAVE_AMBAR]: ambar, [CLAVE_ROJA]: roja }),
    [ambar, roja],
  );

  const cuentas = useMemo(() => bloquesPorColumna(comandas), [comandas]);
  const resumen = useMemo(() => resumenDeProduccion(comandas), [comandas]);

  return (
    <div className="flex flex-col gap-(--espacio-2)">
      {error !== null && (
        <Aviso tono="peligro" titulo={error}>
          Se muestra el último tablero conocido.
        </Aviso>
      )}
      <ResumenDeProduccion renglones={resumen} compacto={compacto} onCompacto={cambiarCompacto} />
      <ColumnasDeCocina
        cuentas={cuentas}
        cargando={cargando}
        ahora={ahora}
        umbrales={umbrales}
        compacto={compacto}
        {...acciones}
      />
    </div>
  );
}
