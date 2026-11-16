import type { LineaDelCarrito } from '~/portal/carrito-compartido/carrito-de-la-mesa';

/**
 * DP-21 · «Teléfono 2 · 14:05»: lo que lee el mesero sobre cada grupo de platillos del carrito.
 *
 * El número y la hora salen del servidor (`telefono` y `agregadaEn` de cada línea): el teléfono
 * del comensal no los pone. La hora es la de lo PRIMERO que ese teléfono agregó, en la hora del
 * aparato del mesero. Sin hora (un servidor anterior), sólo el número.
 */

/** La hora más temprana de las líneas (ISO), o `null` si ninguna la trae. */
function primeraHora(lineas: readonly LineaDelCarrito[]): Date | null {
  let primera: Date | null = null;
  for (const linea of lineas) {
    if (linea.agregadaEn === undefined) continue;
    const fecha = new Date(linea.agregadaEn);
    if (Number.isNaN(fecha.getTime())) continue;
    if (primera === null || fecha < primera) primera = fecha;
  }
  return primera;
}

export function etiquetaDelTelefono(
  numero: number,
  lineas: readonly LineaDelCarrito[],
  zonaHoraria?: string,
): string {
  const hora = primeraHora(lineas);
  if (hora === null) return `Teléfono ${String(numero)}`;
  const texto = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(zonaHoraria === undefined ? {} : { timeZone: zonaHoraria }),
  }).format(hora);
  return `Teléfono ${String(numero)} · ${texto}`;
}
