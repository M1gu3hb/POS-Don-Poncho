import { EstadosDelSistema } from '~/sistema/EstadosDelSistema';
import { PaginaDelSistema } from '~/sistema/PaginaDelSistema';

/**
 * La página viva del sistema de diseño.
 *
 * Va FUERA de `(interno)` y de `(modelos)` a propósito: no es una pantalla de un
 * negocio —no lee datos de nadie ni necesita sesión— y ninguno de los dos marcos le
 * sirve. Es donde se ve el lenguaje entero con el estilo y las cuatro perillas
 * cambiando en vivo, que es lo que Miguel enseña delante de un prospecto.
 *
 * `/sistema?estados` (DP-21, Bloque 15) enseña en cambio cada pieza de Radix en sus estados
 * abiertos y marcados, del sistema y heredada: la prueba del motor viejo las compara con el Chrome
 * de hoy. Sin ese parámetro, la página es la de siempre.
 *
 * La página es una línea a propósito — el componente vive en `apps/web/src/`, donde
 * el verificador de primitivas sí vigila los literales.
 */
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { estados } = await searchParams;
  return estados === undefined ? <PaginaDelSistema /> : <EstadosDelSistema />;
}
