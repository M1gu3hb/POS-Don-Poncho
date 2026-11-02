import type { CancelacionDelCorte } from './cancelaciones.ts';

/**
 * QUÉ FILAS DE CANCELACIONES SE ENSEÑAN en Registros (DP-12.4): el buscador universal de la página
 * (por mesa, folio, platillo, quién canceló o motivo) y el interruptor «sólo pérdidas». Puro, para
 * probarlo sin navegador.
 */

export interface FiltroDeCancelaciones {
  readonly busqueda: string;
  readonly soloPerdidas: boolean;
}

const quitarAcentos = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function filtrarCancelaciones(
  filas: readonly CancelacionDelCorte[],
  filtro: FiltroDeCancelaciones,
): readonly CancelacionDelCorte[] {
  const buscado = quitarAcentos(filtro.busqueda.trim());
  return filas.filter((c) => {
    if (filtro.soloPerdidas && !c.perdida) return false;
    if (buscado === '') return true;
    const pajar = quitarAcentos(
      [c.mesa, c.folio, c.producto, c.usuario, c.motivo, c.tipo === 'orden' ? 'cuenta' : 'platillo']
        .filter((parte): parte is string => parte !== null)
        .join(' '),
    );
    return pajar.includes(buscado);
  });
}
