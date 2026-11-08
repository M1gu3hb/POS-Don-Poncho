/**
 * DP-15 · EL CIERRE DICE SI QUEDA OTRA CAJA ABIERTA (M4 de la auditoría 1).
 *
 * Con dos cajas, «Cierre del día» cerraba la de ESTE aparato (así es `caja.cerrar`: cada cajón se
 * cuenta donde está) y la otra seguía abierta sin que nadie lo dijera: el día parecía cerrado. Ahora,
 * si hay más de una abierta, el diálogo lo dice y el botón promete lo que hace: «cerrar esta caja».
 * El día queda cerrado cuando cierra la última. Si no se pudo saber cuántas hay, se dice lo seguro.
 */

export interface TextoDelCierre {
  readonly titulo: string;
  readonly aviso: string | null;
  readonly boton: string;
}

export function textoDelCierre(cajasAbiertas: number | null): TextoDelCierre {
  if (cajasAbiertas === null) {
    return {
      titulo: '¿Cerrar esta caja?',
      aviso:
        'No se pudo saber si hay otra caja abierta: este cierre cierra sólo la caja de este aparato.',
      boton: 'Sí, cerrar esta caja',
    };
  }
  const otras = cajasAbiertas - 1;
  if (otras > 0) {
    return {
      titulo: '¿Cerrar esta caja?',
      aviso: `${otras === 1 ? 'Hay otra caja abierta' : `Hay ${String(otras)} cajas abiertas más`}: este cierre cierra sólo la caja de este aparato. Ciérrala en su aparato; el día queda cerrado con la última.`,
      boton: 'Sí, cerrar esta caja',
    };
  }
  return { titulo: '¿Cerrar la caja?', aviso: null, boton: 'Sí, cerrar el día' };
}
