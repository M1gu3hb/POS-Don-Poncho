import 'server-only';

/** Los comandos de caja (F1.1-A-08 y C-10). */

export { abrirCaja, cerrarCaja, registrarMovimientoCaja, type ResultadoCorte } from './sesion.ts';

export {
  descuentosDelCorte,
  descuentosDelCorteComando,
  entradaDescuentosDelCorte,
  type DescuentoDelCorte,
  type DescuentosDelCorte,
} from './corte/descuentos-del-corte.ts';

export {
  MAXIMO_DE_CAJAS,
  cajasSimultaneas,
  entradaCajasSimultaneas,
  entradaFijarCajasSimultaneas,
  fijarCajasSimultaneas,
  type CajasALaVez,
} from './cajas-a-la-vez.ts';

export { eliminarCorte, entradaEliminarCorte, type ResultadoEliminarCorte } from './eliminacion.ts';

export {
  entradaEstadoCaja,
  estadoDeCaja,
  type EstadoCaja,
  type MovimientoVisible,
} from './consulta.ts';

export { corteDeTurno, entradaCorteTurno, type ResultadoCorteTurno } from './turno.ts';

export {
  entradaTraerCaja,
  traerCaja,
  type CajaEnOtraTerminal,
  type ResultadoTraerCaja,
} from './traer.ts';

export { encolarSincronizacionCorte, entradaEncolarSincronizacionCorte } from './sincronizacion.ts';

export {
  PULSO_CAJON,
  abrirCajon,
  cajasAbiertas,
  entradaAbrirCajon,
  entradaCajasAbiertas,
  type CajaAbierta,
  type ResultadoCajas,
  type ResultadoCajon,
} from './multiples.ts';

export {
  documentoDeCorte,
  entradaDocumentoDeCorte,
  type DocumentoDeCorte,
  type MovimientoDelCorte,
  type RenglonDeCorte,
} from './documento.ts';

export {
  entradaDeCambio,
  registrarEntradaDeCambio,
  type ResultadoEntradaCambio,
} from './entrada-cambio.ts';

export {
  cancelacionesDelCorteComando,
  cancelacionesRegistradasComando,
  entradaCancelacionesDelCorte,
  entradaCancelacionesRegistradas,
  type CancelacionesLeidas,
} from './corte/lectura-de-cancelaciones.ts';

export {
  entradaVentasDelDia,
  ventasDelDiaDelCorte,
  type VentasDelDia,
} from './corte/ventas-del-dia.ts';
export {
  entradaHojaDelCorte,
  hojaDelCorte,
  negocioDe,
  type ExtrasDelCorte,
  type HojaDelCorte,
  type NegocioDelCorte,
} from './corte/documento.ts';
export {
  entradaNombrarTerminal,
  entradaTerminales,
  nombrarTerminal,
  terminalesDeLaSucursal,
  type TerminalDeLaSucursal,
} from './terminales.ts';

export {
  entradaFijarUmbralDeRetiro,
  fijarUmbralDeRetiro,
  type ResultadoUmbralDeRetiro,
} from './retiro-con-pin.ts';

// DP-20 · El cajón que se abre al cobrar (a la auditoría) y las copias del ticket, la precuenta y el corte.
export {
  cajonPorCobro,
  entradaCajonPorCobro,
  type ResultadoCajonPorCobro,
} from './cajon-por-cobro.ts';
export {
  CLAVE_COPIAS_DE_IMPRESION,
  COPIAS_POR_OMISION,
  copiasDeImpresionEn,
  entradaFijarCopiasDeImpresion,
  fijarCopiasDeImpresion,
  type CopiasDeImpresion,
} from './copias-de-impresion.ts';

export {
  CLAVE_NOMBRES_DE_CAJAS,
  LUGARES_MAXIMOS,
  cajaConSuAparato,
  entradaNombrarCajas,
  leerNombresDeCajas,
  lugarParaAbrir,
  lugaresLibres,
  nombrarCajas,
  nombreDeLaCaja,
  nombresDeCajasEn,
  type CajasNombradas,
} from './lugares.ts';
export type { LugarLibre } from './traer.ts';
