export {
  purgarSeccionDelHistorico,
  purgarVentas,
  reiniciarPruebas,
  reiniciarTodo,
  vaciarMesas,
  type ResultadoMantenimiento,
} from './comandos.ts';
export { claveDeTexto, exigirNombreDelNegocio } from './confirmacion.ts';
export {
  SECCIONES,
  SECCIONES_DEL_HISTORICO,
  TABLAS_DEL_CATALOGO,
  TABLAS_POR_SECCION,
  type Conteos,
  type Seccion,
} from './purgas.ts';
export {
  claveDePlataforma,
  listaResultante,
  type AccionDePlataforma,
  type PlanDePlataforma,
} from './clave-de-plataforma.ts';
export {
  CLAVE_DE_PLATAFORMA,
  MAXIMO_DE_PLATAFORMA,
  empleosDePlataforma,
  exigirPlataforma,
  leerEsDePlataforma,
  marcarPlataforma,
  type ResultadoMarcarPlataforma,
} from './plataforma.ts';
export {
  quitarMarcaDeEmpleo,
  quitarPlataforma,
  type ResultadoQuitarPlataforma,
} from './plataforma-cambios.ts';
