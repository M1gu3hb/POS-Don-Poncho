import PreCuentaTicket from '@/components/tickets/PreCuentaTicket';
import {
  CODIGO_DE_EJEMPLO,
  detallesDeEjemplo,
  MESA_DE_EJEMPLO,
  RENGLONES_DEL_TICKET_CORTO,
  ventaDeEjemplo,
} from './datos-de-ejemplo';
import { ReglaDeCalibracion } from './ReglaDeCalibracion';

/**
 * LOS DOCUMENTOS DE EJEMPLO DEL LABORATORIO (DP-20). `PreCuentaTicket` es `.jsx`, así que estos
 * elementos se arman aquí y salen como funciones que devuelven un `ReactElement`.
 *
 * Datos inventados y fijos (folio «EJEMPLO»); la configuración real del negocio sólo pone el logo
 * y el nombre, como en `TicketViewerDialog`.
 */

/**
 * El ticket de ejemplo, en su lienzo térmico.
 *
 * @param {{
 *   config?: Record<string, unknown> | null | undefined,
 *   puntos: number,
 *   renglones?: number,
 *   conLogo?: boolean,
 *   soloLienzo?: boolean,
 * }} opciones
 * @returns {import('react').ReactElement}
 */
export function ticketDeEjemplo({
  config,
  puntos,
  renglones = RENGLONES_DEL_TICKET_CORTO,
  conLogo = true,
  soloLienzo = true,
}) {
  const detalles = detallesDeEjemplo(renglones);
  return (
    <PreCuentaTicket
      venta={ventaDeEjemplo(detalles)}
      detalles={detalles}
      mesa={MESA_DE_EJEMPLO}
      config={{ ...(config ?? {}), mostrar_logo_ticket: conLogo }}
      codigo={CODIGO_DE_EJEMPLO}
      puntos={puntos}
      soloLienzo={soloLienzo}
    />
  );
}

/**
 * La regla de calibración, lista para imprimir.
 *
 * @param {{ puntos: number, papelMm: 58 | 80 }} opciones
 * @returns {import('react').ReactElement}
 */
export function reglaDeEjemplo({ puntos, papelMm }) {
  return <ReglaDeCalibracion puntos={puntos} papelMm={papelMm} />;
}
