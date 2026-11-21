/**
 * QUIÉN VE LOS BOTONES QUE HACEN DESAPARECER UN IMPORTE, sin pantalla (día completo del
 * restaurante, 2.4).
 *
 * ── El defecto que esto arregla ──────────────────────────────────────────────
 * La mesa activa es la pantalla del MESERO, y le ofrecía «Anular» en cada línea y «Dividir
 * cuenta», dos acciones que el servidor le negaba: `restaurante.anular_linea` y
 * `restaurante.dividir_cuenta` eran de caja y de dirección, porque quitar un platillo o repartir
 * una cuenta hace desaparecer dinero y «esa separación es control interno, no capricho de
 * interfaz» (`04-INTERFAZ`). Cada toque terminaba en «Tu rol no puede hacer eso»: un botón
 * que se ofrece para fallar es peor que uno que no está, y en hora pico es un toque perdido.
 *
 * DP-24 · Quitar un platillo ya enviado y cancelar una cuenta son de la caja (siempre con el PIN de
 * un gerente) y de la gerencia (sin PIN): el MESERO ya no los ve (`puedeCancelarPedidos`), porque
 * el servidor se los niega; lo que todavía no manda a cocina lo quita de su carrito. Repartir una
 * cuenta (`puedeAjustarLaCuenta`) sigue siendo de caja y de dirección.
 *
 * Esto es lo que se ENSEÑA, no lo que se permite: la autorización vive en el servidor
 * (`comando()` revisa el rol en cada escritura) y sigue siendo la única que cuenta (R11).
 *
 * Los roles son los de la barra lateral del cliente (`heredado/lib/constants.js`): `caja` es la
 * cajera, y `administrador` es dueño, administrador y gerente (`puente/roles.ts`). Falla
 * CERRADO: mientras no se sabe quién es, no se ofrece lo que quita dinero.
 */
export function puedeAjustarLaCuenta(rol: string | null): boolean {
  return rol === 'administrador' || rol === 'caja';
}

/**
 * DP-24 · Quién ve «Quitar un platillo» y «Cancelar la cuenta»: la caja y la dirección —los mismos
 * cuatro roles del servidor, `cajero`, `gerente`, `administrador` y `dueno`, con los nombres de
 * la sesión—. El mesero, cocina, almacén y quien aún no se sabe quién es, no.
 */
export function puedeCancelarPedidos(rol: string | null): boolean {
  return rol === 'administrador' || rol === 'caja';
}

/** DP-24 · La caja quita y cancela SIEMPRE con el PIN de un gerente: se pide de entrada, no tras el rechazo. */
export function pideElPinSiempre(rol: string | null): boolean {
  return rol === 'caja';
}

/** DP-24 · La gerencia (gerente, administrador y dueño) nunca teclea PIN para quitar o cancelar. */
export function nuncaPideElPin(rol: string | null): boolean {
  return rol === 'administrador';
}
