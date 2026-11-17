import type { Rol } from '@morphiqpos/contracts';

/**
 * Quién registra una compra y quién la paga del cajón (A5). Puro.
 *
 * El almacén recibe la mercancía, así que registra la compra (proveedor, líneas y costo). Pero una
 * compra en efectivo SALE DEL CAJÓN de la caja abierta (DP-D115): ese dinero es de quien lleva la
 * caja. El almacén la registra por transferencia o tarjeta; en efectivo, que la registre la
 * gerencia. El servidor lo exige; la pantalla sólo lo refleja (`puestos.js`).
 */
export const ROLES_QUE_REGISTRAN_COMPRAS = [
  'dueno',
  'administrador',
  'gerente',
  'almacen',
] as const satisfies readonly Rol[];

export const ROLES_QUE_PAGAN_DEL_CAJON = [
  'dueno',
  'administrador',
  'gerente',
] as const satisfies readonly Rol[];

export const MENSAJE_COMPRA_EN_EFECTIVO_SIN_CAJA =
  'Una compra en efectivo sale del cajón, y eso lo registra quien lleva la caja. ' +
  'Regístrala con transferencia o tarjeta, o pide que la registre la gerencia.';

export function puedePagarDelCajon(rol: Rol): boolean {
  return (ROLES_QUE_PAGAN_DEL_CAJON as readonly Rol[]).includes(rol);
}
