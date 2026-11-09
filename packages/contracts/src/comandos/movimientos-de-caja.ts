/**
 * DP-15.1 · Lo que servidor y pantalla de Caja → Movimientos deben decir igual.
 *
 * El motivo de un retiro: «gas» o «.» no dicen a dónde fue el dinero, y el retiro es la salida del
 * cajón que más fácil esconde un faltante. Cinco letras (sin contar los espacios de los lados) ya
 * obligan a escribir «hielo» o «al banco». El servidor lo exige (`caja.movimiento`) y la pantalla lo
 * avisa antes de mandar: los dos leen ESTE número, para que no se separen.
 */
export const LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO = 5;
