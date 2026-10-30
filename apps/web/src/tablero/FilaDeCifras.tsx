import {
  AlertTriangle,
  Banknote,
  CreditCard,
  DollarSign,
  Receipt,
  Scissors,
  Smartphone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ReactElement } from 'react';

import { ErrorDeLectura, EsqueletoDeCifras } from '~/cliente/EstadosDeCarga';
import { formatPercent } from '@/utils/financialUtils';

import { CifraDelTablero } from './CifraDelTablero';
import { metodosConVentas, type CifrasDelDia, type ClaveDeMetodo } from './cifras-del-dia.ts';

/**
 * LAS CIFRAS DEL DÍA · dos hileras de tarjetas (DP-11.4).
 *
 * La primera dice cómo va el día (ventas —la más grande—, costo, utilidad, ticket); la segunda,
 * con qué se cobró y qué costó operar. Mientras la lectura no llega reserva el lugar de las dos
 * con esqueletos —nadie lee un `$0.00` que no es—, y si falló lo dice con su «Volver a intentar».
 *
 * Devuelve las dos hileras como hermanas, sin envoltorio: el tablero las separa con el mismo
 * ritmo que a todo lo demás.
 */

/** Las clases, escritas enteras: Tailwind no ve las que se arman con texto. */
const PRIMERA_HILERA = { con: 'lg:grid-cols-4', sin: 'lg:grid-cols-2' } as const;
const SEGUNDA_HILERA = { con: 'lg:grid-cols-5', sin: 'lg:grid-cols-3' } as const;

/** El color de la gráfica de cada método, por su lugar en la dona (`metodosConVentas`). */
const MUESTRAS = ['bg-grafico-1', 'bg-grafico-2', 'bg-grafico-3'] as const;

export interface FilaDeCifrasProps {
  readonly cifras: CifrasDelDia;
  /** El paquete incluye costos básicos: se enseñan el costo, las utilidades y los gastos. */
  readonly conCostos: boolean;
  /** `colorear_importes_monetarios` del negocio. */
  readonly colorearImportes: boolean;
  readonly cargando: boolean;
  /** Hay una caja abierta: la espera lo dice con palabras además del esqueleto. */
  readonly hayCaja: boolean;
  /** La lectura de ventas o gastos falló y no hay ningún dato anterior que enseñar. */
  readonly fallo: boolean;
  readonly alReintentar: () => void;
}

/**
 * «Inventario crítico»: cuántos ingredientes requieren atención, en su propia tarjeta. Es una
 * cuenta y no un importe, así que lleva `Cifra` y no `Dinero`.
 */
export function CifraDeInventarioCritico({
  cantidad,
  colorearImportes,
}: {
  readonly cantidad: number;
  readonly colorearImportes: boolean;
}): ReactElement {
  return (
    <CifraDelTablero
      titulo="Inventario crítico"
      icono={AlertTriangle}
      tono="peligro"
      cantidad={cantidad}
      unidad="ingredientes"
      detalle="Requieren atención"
      colorearImporte={colorearImportes}
    />
  );
}

export function FilaDeCifras({
  cifras,
  conCostos,
  colorearImportes,
  cargando,
  hayCaja,
  fallo,
  alReintentar,
}: FilaDeCifrasProps): ReactElement {
  if (cargando) {
    return (
      <>
        {hayCaja ? (
          <p role="status" className="text-sm text-texto-sutil">
            Sincronizando datos del dashboard…
          </p>
        ) : null}
        <EsqueletoDeCifras cantidad={conCostos ? 4 : 2} />
        <EsqueletoDeCifras cantidad={conCostos ? 5 : 3} />
      </>
    );
  }
  if (fallo) {
    return <ErrorDeLectura queNoSePudoLeer="las cifras del día" alReintentar={alReintentar} />;
  }

  const orden = metodosConVentas(cifras).map((metodo) => metodo.clave);
  const muestraDe = (clave: ClaveDeMetodo): string | undefined => MUESTRAS[orden.indexOf(clave)];
  const utilidadNeta = cifras.utilidadNetaCentavos;

  return (
    <>
      <div
        className={`grid grid-cols-2 gap-(--espacio-3) ${conCostos ? PRIMERA_HILERA.con : PRIMERA_HILERA.sin}`}
      >
        <CifraDelTablero
          titulo="Ventas hoy"
          icono={DollarSign}
          tono="primario"
          centavos={cifras.ventasCentavos}
          detalle={`${String(cifras.tickets)} tickets`}
          principal
          colorearImporte={colorearImportes}
          className="col-span-2 lg:col-span-1"
        />
        {conCostos ? (
          <CifraDelTablero
            titulo="Costo de ventas"
            icono={Receipt}
            centavos={cifras.costoCentavos}
            colorearImporte={colorearImportes}
          />
        ) : null}
        {conCostos ? (
          <CifraDelTablero
            titulo="Utilidad bruta"
            icono={TrendingUp}
            centavos={cifras.utilidadBrutaCentavos}
            detalle={`${formatPercent(cifras.margen)} margen`}
            colorearImporte={colorearImportes}
          />
        ) : null}
        <CifraDelTablero
          titulo="Ticket promedio"
          icono={CreditCard}
          centavos={cifras.ticketPromedioCentavos}
          colorearImporte={colorearImportes}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div
        className={`grid grid-cols-2 gap-(--espacio-3) ${conCostos ? SEGUNDA_HILERA.con : SEGUNDA_HILERA.sin}`}
      >
        <CifraDelTablero
          titulo="Efectivo"
          icono={Banknote}
          centavos={cifras.efectivoCentavos}
          muestra={muestraDe('efectivo')}
          colorearImporte={colorearImportes}
        />
        <CifraDelTablero
          titulo="Tarjeta"
          icono={CreditCard}
          centavos={cifras.tarjetaCentavos}
          muestra={muestraDe('tarjeta')}
          colorearImporte={colorearImportes}
        />
        <CifraDelTablero
          titulo="Transferencia"
          icono={Smartphone}
          centavos={cifras.transferenciaCentavos}
          muestra={muestraDe('transferencia')}
          colorearImporte={colorearImportes}
        />
        {conCostos ? (
          <CifraDelTablero
            titulo="Gastos operativos"
            icono={Scissors}
            centavos={cifras.gastosCentavos}
            colorearImporte={colorearImportes}
          />
        ) : null}
        {conCostos ? (
          <CifraDelTablero
            titulo="Utilidad neta est."
            icono={Wallet}
            tono={utilidadNeta >= 0 ? 'exito' : 'peligro'}
            centavos={utilidadNeta}
            colorearImporte={colorearImportes}
          />
        ) : null}
      </div>
    </>
  );
}
