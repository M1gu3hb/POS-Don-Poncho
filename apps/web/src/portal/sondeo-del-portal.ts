/**
 * Cada cuánto el portal del comensal vuelve a leer su estado completo (negocio, mesa, menú y
 * cuenta). Antes eran 4 s; con el menú completo en cada lectura, 10 teléfonos abiertos la jornada
 * entera pasaban el crédito de Vercel (docs/infra/CAPACIDAD.md). El carrito compartido tiene su
 * propio sondeo ligero.
 */
export const SONDEO_DEL_PORTAL_MS = 12_000;
