/**
 * DP-16 · LOS FONDOS DE LA TARJETA SIN FOTO del menú digital del comensal.
 *
 * Lista CERRADA: el valor se guarda en `productos.fondo_tarjeta` y el portal lo pinta con una clase
 * de su hoja de estilos, nunca como CSS escrito por alguien. Lo que no está aquí no se acepta al
 * guardar (el puente lo rechaza) ni se pinta (el portal cae al de omisión). Los colores salen de los
 * tokens del estilo del negocio: cambiar el estilo cambia las tarjetas sin tocar un producto.
 */

export interface OpcionDeFondo {
  readonly valor: string;
  readonly nombre: string;
  readonly tipo: 'color' | 'degradado' | 'ilustracion';
}

export const FONDOS_DE_TARJETA = [
  { valor: 'color:crema', nombre: 'Crema', tipo: 'color' },
  { valor: 'color:marca', nombre: 'Color de la marca', tipo: 'color' },
  { valor: 'color:tierra', nombre: 'Tierra', tipo: 'color' },
  { valor: 'color:carbon', nombre: 'Carbón', tipo: 'color' },
  { valor: 'degradado:atardecer', nombre: 'Atardecer', tipo: 'degradado' },
  { valor: 'degradado:papel', nombre: 'Papel', tipo: 'degradado' },
  { valor: 'ilustracion:papel-picado', nombre: 'Papel picado', tipo: 'ilustracion' },
  { valor: 'ilustracion:talavera', nombre: 'Talavera', tipo: 'ilustracion' },
  { valor: 'ilustracion:milpa', nombre: 'Milpa', tipo: 'ilustracion' },
] as const satisfies readonly OpcionDeFondo[];

export type FondoDeTarjeta = (typeof FONDOS_DE_TARJETA)[number]['valor'];

/** El de omisión: una tarjeta sin foto y sin fondo elegido. */
export const FONDO_DE_OMISION: FondoDeTarjeta = 'color:crema';

const VALORES: ReadonlySet<string> = new Set(FONDOS_DE_TARJETA.map((f) => f.valor));

export function esFondoDeTarjeta(valor: unknown): valor is FondoDeTarjeta {
  return typeof valor === 'string' && VALORES.has(valor);
}
