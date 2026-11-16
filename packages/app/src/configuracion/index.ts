export {
  APARIENCIA_POR_OMISION,
  aparienciaDeLaOrganizacion,
  DENSIDADES,
  ELEVACIONES,
  ESTILOS_DISPONIBLES,
  MOVIMIENTOS,
  REDONDEOS,
  entradaFijarApariencia,
  fijarApariencia,
  normalizarEstilo,
  type AparienciaGuardada,
} from './apariencia.ts';

export {
  CLAVE_DE_EXPERIENCIA,
  EXPERIENCIA,
  EXPERIENCIA_POR_OMISION,
  experienciaDe,
  experienciaDeLaOrganizacion,
  TECLAS_DE_SONIDO,
  type Experiencia,
} from './experiencia.ts';

export {
  entradaGuardarConfiguracion,
  guardarConfiguracion,
  leerConfiguracion,
  type ConfiguracionOrganizacion,
} from './configuracion.ts';

export {
  CANDADO_DE_MANDO,
  CLAVE_DEL_CANDADO_DE_MANDO,
  candadoDeMandoEn,
  entradaFijarCandadoDeMando,
  fijarCandadoDeMando,
} from './candado-de-mando.ts';
export { entradaFijarImpuesto, fijarImpuesto } from './impuesto.ts';
export {
  CLAVE_DEL_IMPUESTO,
  IMPUESTO_DE_UN_NEGOCIO_NUEVO,
  TASAS_DE_IVA,
  esquemaDelImpuesto,
  impuestoEn,
  reglaDeImpuestoEn,
  type ImpuestoDelNegocio,
  type TasaDeIva,
} from './impuesto-del-negocio.ts';

export {
  entradaFijarModulo,
  entradaRestablecerModulo,
  fijarModulo,
  modulosDelNegocio,
  restablecerModulo,
  type ModulosDelNegocio,
  type ResultadoDeModulo,
  type ResultadoDeRestablecer,
} from './modulos.ts';

export {
  entradaFijarTermino,
  entradaRestablecerTermino,
  fijarTermino,
  restablecerTermino,
  terminosDeLaOrganizacion,
  terminosDelNegocio,
  vocabularioDelNegocio,
  type ResultadoDeRestablecerTermino,
  type ResultadoDeTermino,
  type TerminosDelNegocio,
} from './vocabulario.ts';

export { entradaFijarFolios, fijarFolios } from './folios.ts';
export {
  CLAVE_DE_FOLIOS,
  CLAVE_DE_OPERACION_DESDE,
  FOLIOS_DE_UN_NEGOCIO_NUEVO,
  PRIMER_FOLIO_MAXIMO,
  esquemaDeFolios,
  foliosEn,
  foliosIguales,
  operacionDesdeEn,
  type FoliosDelNegocio,
} from './folios-del-negocio.ts';
