export {
  aplicarPrecioSugerido,
  entradaPrecioSugerido,
  type ResultadoPrecioSugerido,
} from './precio-sugerido.ts';

export { entradaBuscarProductos, listarProductos } from './consulta.ts';
export { consultarInicioProduccion } from './inicio.ts';
export type { PaginaProductos, ProductoResumen } from './consulta.ts';
export {
  actualizarProducto,
  archivarProducto,
  asignarCodigoBarras,
  cambiarPrecioProducto,
  crearProducto,
} from './productos.ts';
export { crearModificadorProducto } from './modificadores.ts';
export {
  entradaActualizarProducto,
  entradaArchivarProducto,
  entradaAsignarCodigo,
  entradaCambiarPrecio,
  entradaCrearModificador,
  entradaCrearProducto,
} from './esquemas.ts';

export {
  guardarModificadores,
  entradaGuardarModificadores,
  type ResultadoGuardarModificadores,
} from './modificadores-guardar.ts';
export {
  asignarGruposAlProducto,
  entradaAsignarGrupos,
  entradaGuardarGrupo,
  guardarGrupoDeOpciones,
} from './grupos-de-opciones.ts';
export {
  gruposDeOpciones,
  type GrupoDeLaBiblioteca,
  type OpcionDeLaBiblioteca,
} from './grupos-de-opciones-lectura.ts';

export {
  asignarFiscalMasivo,
  entradaFiscalMasivo,
  type ProductoSinLitros,
  type ResultadoFiscalMasivo,
} from './fiscal-masivo.ts';

export {
  entradaMarcarAgotado,
  marcarAgotado,
  QUIEN_MARCA_AGOTADO,
  type ResultadoMarcarAgotado,
} from './agotado.ts';
