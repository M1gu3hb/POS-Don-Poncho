import type { EleccionDeLaBarra } from '~/tacto/barra-lateral';

/** Qué se le dice a quien mira la tarjeta «Barra lateral», según lo que este aparato recuerda. */
export function textoDeLaEleccion(eleccion: EleccionDeLaBarra | null): string {
  if (eleccion === 'abierta') return 'En este aparato la barra de navegación empieza abierta.';
  if (eleccion === 'plegada') return 'En este aparato la barra de navegación empieza plegada.';
  return 'Todavía no elegiste: este aparato decide solo (plegada en los teléfonos y en las pantallas de pocas secciones). Elige una para fijarla.';
}
