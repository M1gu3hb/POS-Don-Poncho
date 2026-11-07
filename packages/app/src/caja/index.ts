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
  entradaHojaDelCorte,
  hojaDelCorte,
  negocioDe,
  type ExtrasDelCorte,
  type HojaDelCorte,
  type NegocioDelCorte,
} from './corte/documento.ts';
